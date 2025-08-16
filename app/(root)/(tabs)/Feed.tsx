import { getCategoriesByValues, getEventEmoji } from '@/constants/categories';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getFriendsTravelAnnouncements } from '@/lib/api/travel';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { account, config, databases } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { batchProcess, createOptimizedQuery, dbConnectionPool } from '@/lib/utils/dbOptimization';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import UserAvatar from '../components/UserAvatar';

import { Event as AppEvent } from '@/lib/types/Events';
import { TravelAnnouncementWithUserInfo } from '@/lib/types/Travel';
import EventForm from '../components/EventForm';
import TravelForm from '../components/TravelForm';
import { useEvents } from '../context/EventContext';

dayjs.extend(relativeTime);

// Combined feed item type
type FeedItem = (AppEvent & { type: 'event'; creatorName?: string }) | (TravelAnnouncementWithUserInfo & { type: 'travel' });
export default function Feed() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { events, refetchEvents } = useEvents();
  const params = useLocalSearchParams();
  const [eventsWithCreatorNames, setEventsWithCreatorNames] = useState<AppEvent[]>([]);
  const [travelAnnouncements, setTravelAnnouncements] = useState<TravelAnnouncementWithUserInfo[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [travelFormVisible, setTravelFormVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [creatorPhotoUrls, setCreatorPhotoUrls] = useState<Record<string, string | null>>({});

  // Optimized fetch function for scalability
  const fetchFeedData = useCallback(async () => {
    try {
      const user = await account.get();
      if (!user?.$id) return;

      setCurrentUserId(user.$id);
      const profile = await getUserProfile(user.$id);
      const userFriends = profile?.friends ?? [];
      setFriends(userFriends);

      if (userFriends.length > 0) {
        // Use optimized queries and connection pooling for scalability
        const friendEvents = await dbConnectionPool.acquire(async () => {
          return await databases.listDocuments(
            config.databaseID!,
            config.eventsCollectionID!,
            createOptimizedQuery.events.friendEvents(userFriends, 50)
          );
        });

        // Batch process creator profiles for better performance
        const uniqueCreatorIds = [...new Set(friendEvents.documents.map(event => event.creatorId))];
        const creatorProfiles = await batchProcess(
          uniqueCreatorIds,
          async (batch) => await getUsersByIds(batch),
          25 // Optimal batch size
        );

        const creatorMap = new Map(
          creatorProfiles.flat().map(profile => [profile.$id, userDisplayUtils.getFullName(profile)])
        );

        // Fetch creator profile photos
        const creatorPhotoMap: Record<string, string | null> = {};
        await Promise.all(
          uniqueCreatorIds.map(async (creatorId) => {
            try {
              const photoUrl = await getUserProfilePhotoUrl(creatorId);
              creatorPhotoMap[creatorId] = photoUrl;
            } catch (error) {
              creatorPhotoMap[creatorId] = null;
            }
          })
        );
        setCreatorPhotoUrls(creatorPhotoMap);

        const filteredAndMappedEvents = friendEvents.documents
          .filter(event => {
            // Only show upcoming events that the user is NOT attending
            const eventDate = new Date(event.date);
            const now = new Date();
            const isUpcoming = eventDate >= now;
            const isNotAttending = !event.attendees?.includes(user.$id ?? '');
            return isUpcoming && isNotAttending;
          })
          .map(event => ({
            ...(event as unknown as AppEvent),
            creatorName: creatorMap.get(event.creatorId) || 'Unknown Creator',
            isAttending: event.attendees?.includes(user.$id ?? ''),
          }));
        setEventsWithCreatorNames(filteredAndMappedEvents as AppEvent[]);

        // Fetch travel announcements with connection pooling
        await dbConnectionPool.acquire(async () => {
          await fetchTravelAnnouncements(userFriends);
        });
      }
    } catch (err: any) {
      if (err?.message?.includes('missing scope (account)')) return;
      console.error('Error fetching feed data:', err);
    }
  }, []);

  // Pull-to-refresh handler for Instagram-like functionality
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchFeedData();
      await refetchEvents(); // Also refresh events context
    } catch (error) {
      console.error('Error refreshing feed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchFeedData, refetchEvents]);

  // Initial load - happens once per session for scalability
  useEffect(() => {
    if (!initialLoadComplete) {
      const init = async () => {
        await fetchFeedData();
        await refetchEvents();
        setInitialLoadComplete(true);
      };
      init();
    }
  }, [fetchFeedData, refetchEvents, initialLoadComplete]);

  const fetchTravelAnnouncements = async (friendIds: string[]) => {
    try {
      // SCALABILITY FIX: Use the now-optimized getFriendsTravelAnnouncements with limits
      const travelData = await getFriendsTravelAnnouncements(friendIds, 30); // Limit to 30 travel announcements

      // Filter for upcoming/current travel only (not past travel)
      const now = new Date();
      const upcomingTravelData = travelData.filter(travel => new Date(travel.endDate) > now);

      if (upcomingTravelData.length === 0) {
        setTravelAnnouncements([]);
        return;
      }

      // SCALABILITY FIX: Batch process user profiles instead of sequential calls
      const uniqueUserIds = [...new Set(upcomingTravelData.map(travel => travel.userId))];

      // Batch fetch user profiles (max 25 at once)
      const BATCH_SIZE = 25;
      const userProfileBatches: any[][] = [];
      const photoUrlBatches: (string | null)[][] = [];

      for (let i = 0; i < uniqueUserIds.length; i += BATCH_SIZE) {
        const batch = uniqueUserIds.slice(i, i + BATCH_SIZE);

        // Process profiles and photos in parallel batches
        const [profiles, photoUrls] = await Promise.all([
          getUsersByIds(batch),
          Promise.all(batch.map(async (userId) => {
            try {
              return await getUserProfilePhotoUrl(userId);
            } catch {
              return null;
            }
          }))
        ]);

        userProfileBatches.push(profiles);
        photoUrlBatches.push(photoUrls);
      }

      // Create lookup maps for O(1) access
      const profileMap = new Map();
      const photoMap = new Map();

      userProfileBatches.flat().forEach((profile, index) => {
        if (profile) {
          profileMap.set(profile.$id, profile);
        }
      });

      uniqueUserIds.forEach((userId, index) => {
        const batchIndex = Math.floor(index / BATCH_SIZE);
        const indexInBatch = index % BATCH_SIZE;
        const photoUrl = photoUrlBatches[batchIndex]?.[indexInBatch] || null;
        photoMap.set(userId, photoUrl);
      });

      // Map travel announcements with cached user data
      const travelWithUserInfo = upcomingTravelData.map((travel) => {
        const userProfile = profileMap.get(travel.userId);
        const userPhotoUrl = photoMap.get(travel.userId);

        return {
          ...travel,
          userName: userDisplayUtils.getFullName(userProfile || {}, 'Unknown User'),
          userPhotoUrl,
        } as TravelAnnouncementWithUserInfo;
      });

      setTravelAnnouncements(travelWithUserInfo);
      console.log(`Feed: Loaded ${travelWithUserInfo.length} travel announcements with batched user data`);
    } catch (error) {
      console.error('Error fetching travel announcements:', error);
      setTravelAnnouncements([]); // Ensure UI doesn't break
    }
  };

  const openInMaps = (location: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    Linking.openURL(url);
  };

  const handleAttend = async (event: AppEvent) => {
    if (!currentUserId) return;
    if (event.attendees?.includes(currentUserId)) {
      Alert.alert('Info', 'You are already attending this event.');
      return;
    }

    try {
      const updatedAttendees = [...(event.attendees || []), currentUserId];
      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        event.$id,
        {
          attendees: updatedAttendees,
        }
      );
      // Update the local state to reflect the change
      setEventsWithCreatorNames(prevEvents =>
        prevEvents.map(e =>
          e.$id === event.$id ? { ...e, attendees: updatedAttendees, isAttending: true } : e
        )
      );
      Alert.alert('Success', 'You are now attending this event!');
      refetchEvents();
    } catch (err) {
      console.error('Attend event error:', err);
      Alert.alert('Error', 'Failed to attend event');
    }
  };

  const handleNotAttend = async (event: AppEvent) => {
    if (!currentUserId) return;

    try {
      const updatedAttendees = (event.attendees || []).filter((id: string) => id !== currentUserId);
      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        event.$id,
        {
          attendees: updatedAttendees,
        }
      );
      // Update the local state to reflect the change
      setEventsWithCreatorNames(prevEvents =>
        prevEvents.map(e =>
          e.$id === event.$id ? { ...e, attendees: updatedAttendees, isAttending: false } : e
        )
      );
      Alert.alert('Success', 'You are no longer attending this event.');
      refetchEvents();
    } catch (err) {
      console.error('Not attend event error:', err);
      Alert.alert('Error', 'Failed to un-attend event');
    }
  };

  // Filter for upcoming events only and combine with travel announcements for the feed
  const now = new Date();
  const upcomingEvents = eventsWithCreatorNames.filter(event => new Date(event.endTime) > now);

  const feedItems: FeedItem[] = [
    ...upcomingEvents.map(event => ({ ...event, type: 'event' as const })),
    ...travelAnnouncements.map(travel => ({ ...travel, type: 'travel' as const }))
  ].sort((a, b) => {
    // Sort by creation time (most recent first)
    // For events, use startTime as proxy for creation time since $createdAt may not be available
    const aDate = a.type === 'event' ? new Date(a.startTime) : new Date(a.createdAt);
    const bDate = b.type === 'event' ? new Date(b.startTime) : new Date(b.createdAt);
    return bDate.getTime() - aDate.getTime();
  });

  const renderEventItem = ({ item }: { item: AppEvent & { creatorName?: string } }) => (
    <View style={[styles.feedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Event Header */}
      <View style={styles.cardHeader}>
        <UserAvatar
          photoUrl={creatorPhotoUrls[item.creatorId] || null}
          name={item.creatorName}
          size={48}
        />
        <View style={styles.headerText}>
          <Text style={[styles.creatorName, { color: colors.text }]}>
            {item.creatorName || 'Unknown Creator'}
          </Text>
          <Text style={[styles.timeAgo, { color: colors.textSecondary }]}>
            {dayjs(item.startTime).fromNow()}
          </Text>
        </View>
        <TouchableOpacity style={styles.moreButton}>
          <MaterialIcons name="more-horiz" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Event Emoji Container */}
      <View style={[styles.emojiContainer, { backgroundColor: colors.surface }]}>
        <Text style={styles.eventEmoji}>{getEventEmoji(item.tags)}</Text>
      </View>

      {/* Event Details */}
      <View style={styles.cardContent}>
        <Text style={[styles.eventTitle, { color: colors.text }]}>{item.title}</Text>

        <View style={styles.eventMeta}>
          <View style={styles.metaRow}>
            <MaterialIcons name="location-on" size={16} color={colors.primary} />
            <TouchableOpacity onPress={() => openInMaps(item.location)}>
              <Text style={[styles.metaText, { color: colors.primary, textDecorationLine: 'underline' }]}>
                {item.location}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.metaRow}>
            <MaterialIcons name="access-time" size={16} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {dayjs(item.startTime).format('MMM D, YYYY h:mm A')} - {dayjs(item.endTime).format('h:mm A')}
            </Text>
          </View>
        </View>

        {/* Display event tags */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {getCategoriesByValues(item.tags).map((category) => (
              <View key={category.value} style={[styles.tag, { backgroundColor: colors.surface }]}>
                <Text style={styles.tagEmoji}>{category.emoji}</Text>
                <Text style={[styles.tagText, { color: colors.text }]}>{category.label}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.eventDescription, { color: colors.text }]}>{item.description}</Text>
      </View>

      {/* Actions */}
      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        {item.isAttending ? (
          <TouchableOpacity
            onPress={() => handleNotAttend(item)}
            style={styles.actionButton}
          >
            <MaterialIcons name="event-busy" size={20} color="#FF3B30" />
            <Text style={[styles.actionText, { color: '#FF3B30' }]}>Not Attending</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => handleAttend(item)}
            style={styles.actionButton}
          >
            <MaterialIcons name="event-available" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Attend</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionButton}>
          <MaterialIcons name="share" size={20} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTravelItem = ({ item }: { item: TravelAnnouncementWithUserInfo }) => (
    <View style={[styles.feedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Travel Header */}
      <View style={styles.cardHeader}>
        <UserAvatar
          photoUrl={item.userPhotoUrl}
          name={item.userName}
          size={48}
        />
        <View style={styles.headerText}>
          <Text style={[styles.creatorName, { color: colors.text }]}>{item.userName}</Text>
          <Text style={[styles.timeAgo, { color: colors.textSecondary }]}>
            {dayjs(item.createdAt).fromNow()}
          </Text>
        </View>
        <TouchableOpacity style={styles.moreButton}>
          <MaterialIcons name="more-horiz" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Travel Image - Using a travel/destination placeholder */}
      <View style={[styles.travelImageContainer, { backgroundColor: colors.surface }]}>
        <MaterialIcons name="flight" size={80} color={colors.primary} />
      </View>

      {/* Travel Details */}
      <View style={styles.cardContent}>
        <View style={styles.travelHeader}>
          <MaterialIcons name="flight-takeoff" size={20} color={colors.primary} />
          <Text style={[styles.travelTitle, { color: colors.primary }]}>
            Traveling to {item.destination}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <MaterialIcons name="date-range" size={16} color={colors.primary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {dayjs(item.startDate).format('MMM D')} - {dayjs(item.endDate).format('MMM D, YYYY')}
          </Text>
        </View>

        {item.description && (
          <Text style={[styles.eventDescription, { color: colors.text }]}>{item.description}</Text>
        )}
      </View>

      {/* Travel Actions */}
      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialIcons name="favorite-border" size={20} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>Like</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => Alert.alert('Message', 'Messaging feature coming soon!')}
        >
          <MaterialIcons name="chat-bubble-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>Message</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <MaterialIcons name="share" size={20} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    if (item.type === 'event') {
      return renderEventItem({ item: item as AppEvent & { creatorName?: string } });
    } else {
      return renderTravelItem({ item: item as TravelAnnouncementWithUserInfo });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Enhanced Header with Black Gradient */}
      <View style={styles.header}>
        <LinearGradient
          colors={['#000000', '#1a1a1a', '#2d2d2d']}
          start={[0, 0]}
          end={[1, 1]}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Up2 You</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => setTravelFormVisible(true)}
                style={styles.headerButton}
              >
                <MaterialIcons name="flight" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFormVisible(true)}
                style={styles.headerButton}
              >
                <MaterialIcons name="add" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Event Feed with Pull-to-Refresh for scalability */}
      <FlatList
        data={feedItems}
        keyExtractor={(item) => `${item.type}-${item.$id}`}
        renderItem={renderFeedItem}
        contentContainerStyle={[styles.feedContent, { paddingBottom: 70 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />

      {/* Event Form Modal */}
      {formVisible && (
        <EventForm
          visible={formVisible}
          onClose={() => setFormVisible(false)}
          currentUserId={currentUserId ?? ''}
          friends={friends}
          selectedDateTime={new Date().toISOString()}
        />
      )}

      {/* Travel Form Modal */}
      {travelFormVisible && (
        <TravelForm
          visible={travelFormVisible}
          onClose={() => setTravelFormVisible(false)}
          onSuccess={() => {
            // Refresh travel announcements
            if (friends.length > 0) {
              fetchTravelAnnouncements(friends);
            }
          }}
          currentUserId={currentUserId ?? ''}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  feedContent: {
    paddingVertical: 16,
  },
  feedCard: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeAgo: {
    fontSize: 12,
    marginTop: 2,
  },
  moreButton: {
    padding: 4,
  },
  emojiContainer: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventEmoji: {
    fontSize: 80,
  },
  travelImageContainer: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  eventMeta: {
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
  },
  tagEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventDescription: {
    fontSize: 16,
    lineHeight: 22,
  },
  travelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  travelTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
