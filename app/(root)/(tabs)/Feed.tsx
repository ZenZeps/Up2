import { getCategoriesByValues, getEventEmoji } from '@/constants/categories';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getFriendsTravelAnnouncements } from '@/lib/api/travel';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { account, config, databases } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { batchProcess, createOptimizedQuery, dbConnectionPool } from '@/lib/utils/dbOptimization';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Linking, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EnhancedCard from '@/components/ui/EnhancedCard';
import EnhancedButton from '@/components/ui/EnhancedButton';
import EnhancedFAB from '@/components/ui/EnhancedFAB';
import LoadingIndicator from '@/components/ui/LoadingIndicator';

import icons from '@/constants/icons';
import images from '@/constants/images';
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
      const travelData = await getFriendsTravelAnnouncements(friendIds);

      // Filter for upcoming/current travel only (not past travel)
      const now = new Date();
      const upcomingTravelData = travelData.filter(travel => new Date(travel.endDate) > now);

      // Fetch user names and photos for each travel announcement
      const travelWithUserInfo = await Promise.all(
        upcomingTravelData.map(async (travel) => {
          const userProfile = await getUserProfile(travel.userId);
          const userPhotoUrl = await getUserProfilePhotoUrl(travel.userId);

          return {
            ...travel,
            userName: userDisplayUtils.getFullName(userProfile || {}, 'Unknown User'),
            userPhotoUrl,
          } as TravelAnnouncementWithUserInfo;
        })
      );

      setTravelAnnouncements(travelWithUserInfo);
    } catch (error) {
      console.error('Error fetching travel announcements:', error);
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
    <EnhancedCard variant="elevated" style={{ marginHorizontal: 16, marginBottom: 16 }}>
      {/* Event Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <UserAvatar
          photoUrl={creatorPhotoUrls[item.creatorId] || null}
          name={item.creatorName}
          size={40}
          className="mr-3"
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
            {item.creatorName || 'Unknown Creator'}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            {dayjs(item.startTime).fromNow()}
          </Text>
        </View>
      </View>

      {/* Event Emoji Container */}
      <View style={{ 
        width: '100%', 
        height: 120, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginBottom: 12
      }}>
        <Text style={{ fontSize: 48 }}>{getEventEmoji(item.tags)}</Text>
      </View>

      {/* Event Details */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
          {item.title}
        </Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Image source={icons.location} style={{ width: 16, height: 16, marginRight: 8, tintColor: colors.textSecondary }} />
          <TouchableOpacity onPress={() => openInMaps(item.location)}>
            <Text style={{ color: colors.primary, fontSize: 14, textDecorationLine: 'underline' }}>
              {item.location}
            </Text>
          </TouchableOpacity>
        </View>
        
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>
          {dayjs(item.startTime).format('MMM D, YYYY h:mm A')} - {dayjs(item.endTime).format('h:mm A')}
        </Text>

        {/* Display event tags */}
        {item.tags && item.tags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
            {getCategoriesByValues(item.tags).map((category) => (
              <View key={category.value} style={{ 
                backgroundColor: colors.primaryLight + '20',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 16,
                marginRight: 4,
                marginBottom: 4,
                flexDirection: 'row',
                alignItems: 'center'
              }}>
                <Text style={{ fontSize: 12, marginRight: 4 }}>{category.emoji}</Text>
                <Text style={{ fontSize: 12, color: colors.primary }}>{category.label}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{item.description}</Text>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {item.isAttending ? (
          <EnhancedButton
            title="Not Attending"
            onPress={() => handleNotAttend(item)}
            variant="outline"
            size="medium"
            style={{ flex: 1 }}
          />
        ) : (
          <EnhancedButton
            title="Attend"
            onPress={() => handleAttend(item)}
            variant="primary"
            size="medium"
            style={{ flex: 1 }}
          />
        )}
      </View>
    </EnhancedCard>
  );

  const renderTravelItem = ({ item }: { item: TravelAnnouncementWithUserInfo }) => (
    <EnhancedCard variant="elevated" style={{ marginHorizontal: 16, marginBottom: 16 }}>
      {/* Travel Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <UserAvatar
          photoUrl={item.userPhotoUrl}
          name={item.userName}
          size={40}
          className="mr-3"
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{item.userName}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{dayjs(item.createdAt).fromNow()}</Text>
        </View>
      </View>

      {/* Travel Image - Using a travel/destination placeholder */}
      <Image
        source={images.onboarding}
        style={{ width: '100%', height: 192, borderRadius: 12, marginBottom: 12 }}
        resizeMode="cover"
      />

      {/* Travel Details */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
          ✈️ {item.destination}
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
          {dayjs(item.startDate).format('MMM D')} - {dayjs(item.endDate).format('MMM D, YYYY')}
        </Text>
        {item.description && (
          <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{item.description}</Text>
        )}
      </View>

      {/* Travel Actions */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <EnhancedButton
          title="View Details"
          onPress={() => Linking.openURL(`https://maps.google.com/search/${encodeURIComponent(item.destination)}`)}
          variant="outline"
          size="medium"
          style={{ flex: 1 }}
        />
        <EnhancedButton
          title="Message"
          onPress={() => Alert.alert('Message', `Send a message to ${item.userName} about their trip!`)}
          variant="secondary"
          size="medium"
          style={{ flex: 1 }}
        />
      </View>
    </EnhancedCard>
  );

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    if (item.type === 'event') {
      return renderEventItem({ item: item as AppEvent & { creatorName?: string } });
    } else {
      return renderTravelItem({ item: item as TravelAnnouncementWithUserInfo });
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b" style={{ backgroundColor: colors.background, borderBottomColor: colors.border }}>
        <Text className="text-2xl font-rubik-extrabold" style={{ color: colors.text }}>Up2 You</Text>
        <View className="flex-row space-x-3">
          <TouchableOpacity onPress={() => setTravelFormVisible(true)} className="p-2 rounded-lg" style={{ backgroundColor: colors.card }}>
            <Image source={icons.location} className="w-8 h-8" resizeMode="contain" style={{ tintColor: colors.text }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFormVisible(true)} className="p-2 rounded-lg" style={{ backgroundColor: colors.card }}>
            <Image source={icons.edit} className="w-8 h-8" resizeMode="contain" style={{ tintColor: colors.text }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Event Feed with Pull-to-Refresh for scalability */}
      <FlatList
        data={feedItems}
        keyExtractor={(item) => `${item.type}-${item.$id}`}
        renderItem={renderFeedItem}
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 70 + insets.bottom }}
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

      {/* Enhanced Action Buttons */}
      <View style={{ position: 'absolute', bottom: 80 + insets.bottom, right: 16, gap: 12 }}>
        <EnhancedFAB
          onPress={() => setTravelFormVisible(true)}
          icon="✈️"
          size="medium"
          position={{ bottom: 60, right: 0 }}
        />
        <EnhancedFAB
          onPress={() => setFormVisible(true)}
          icon="+"
          size="large"
          position={{ bottom: 0, right: 0 }}
        />
      </View>

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
