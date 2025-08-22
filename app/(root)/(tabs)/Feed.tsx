import { getCategoriesByValues, getEventEmoji } from '@/constants/categories';
import { addEventAttendee, getEventAttendees, isUserAttendingEvent, removeEventAttendee } from '@/lib/api/event';
import { getUserFriends } from '@/lib/api/friendship';
import { getUserGroups } from '@/lib/api/group';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getFriendsTravelAnnouncements } from '@/lib/api/travel';
import { getUsersByIds } from '@/lib/api/user';
import { config, databases } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { batchProcess, dbConnectionPool } from '@/lib/utils/dbOptimization';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { LinearGradient } from 'expo-linear-gradient';
// header will be plain white
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const { user: globalUser } = useGlobalContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [eventsWithCreatorNames, setEventsWithCreatorNames] = useState<AppEvent[]>([]);
  const [travelAnnouncements, setTravelAnnouncements] = useState<TravelAnnouncementWithUserInfo[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<any[]>([]);
  const [friendPhotoUrls, setFriendPhotoUrls] = useState<Record<string, string | null>>({});
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
      if (!globalUser?.$id) return;

      setCurrentUserId(globalUser.$id);

      // Use proper junction table approach to get friends
      const userFriends = await getUserFriends(globalUser.$id);
      setFriends(userFriends);

      // Batch fetch friend profiles and photos for the friends bubble bar
      if (userFriends.length > 0) {
        try {
          const friendProfilesBatches = await batchProcess(
            userFriends,
            async (batch) => await getUsersByIds(batch),
            25
          );
          const flatFriendProfiles = friendProfilesBatches.flat();
          setFriendProfiles(flatFriendProfiles || []);

          // Fetch friend photos
          const friendPhotoMap: Record<string, string | null> = {};
          await Promise.all(flatFriendProfiles.map(async (p: any) => {
            try {
              friendPhotoMap[p.$id] = await getUserProfilePhotoUrl(p.$id);
            } catch {
              friendPhotoMap[p.$id] = null;
            }
          }));
          setFriendPhotoUrls(friendPhotoMap);
        } catch (err) {
          console.error('Feed: failed to load friend profiles', err);
          setFriendProfiles([]);
          setFriendPhotoUrls({});
        }
      }

      console.log('Feed: User friends loaded:', userFriends.length);

      // Also get user's groups to show events from groups
      const userGroups = await getUserGroups(globalUser.$id);
      const userGroupIds = userGroups.map(group => group.$id);

      console.log('Feed: User groups loaded:', userGroupIds.length);

      if (userFriends.length > 0 || userGroupIds.length > 0) {
        // Fetch ALL events and filter for friends' events and group events
        console.log('Feed: Fetching events from friends and groups');

        const allEvents = await databases.listDocuments(
          config.databaseID!,
          config.eventsCollectionID!,
          [
            // Query.greaterThan('endTime', new Date().toISOString()), // Only upcoming events
            // Query.orderDesc('$createdAt'), // Most recent first
            // Query.limit(100) // Reasonable limit
          ]
        );

        console.log('Feed: Total events fetched:', allEvents.documents.length);

        // Filter events created by friends OR events from user's groups
        const relevantEvents = {
          documents: allEvents.documents.filter(event =>
            userFriends.includes(event.creatorId) || // Events from friends
            (event.groupId && userGroupIds.includes(event.groupId)) // Events from user's groups
          )
        };

        console.log('Feed: Events from friends and groups:', relevantEvents.documents.length);

        // Batch process creator profiles for better performance
        const uniqueCreatorIds = [...new Set(relevantEvents.documents.map((event: any) => event.creatorId))];
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
          uniqueCreatorIds.map(async (creatorId: string) => {
            try {
              const photoUrl = await getUserProfilePhotoUrl(creatorId);
              creatorPhotoMap[creatorId] = photoUrl;
            } catch (error) {
              creatorPhotoMap[creatorId] = null;
            }
          })
        );
        setCreatorPhotoUrls(creatorPhotoMap);

        // Build mapped events with creator names and filter out events the user is already attending
        const filteredAndMappedEvents = await Promise.all(
          relevantEvents.documents
            .filter((event: any) => {
              const eventDate = new Date(event.endTime || event.date);
              return eventDate >= new Date(); // upcoming
            })
            .map(async (event: any) => {
              const isAttending = await isUserAttendingEvent(globalUser.$id, event.$id);

              // Normalize attendee data: prefer optimized attendeeCount, fall back to attendees array,
              // and as a last resort query the junction table via getEventAttendees
              let attendeesList: string[] = Array.isArray(event.attendees) ? event.attendees : [];
              let attendeeCount: number | undefined = typeof event.attendeeCount === 'number' ? event.attendeeCount : (attendeesList.length > 0 ? attendeesList.length : undefined);

              if ((attendeeCount === undefined || attendeeCount === 0) && !Array.isArray(event.attendees)) {
                try {
                  const junctionAttendees = await getEventAttendees(event.$id);
                  attendeesList = Array.isArray(junctionAttendees) ? junctionAttendees : [];
                  attendeeCount = attendeesList.length;
                } catch (err) {
                  // ignore and fallback to 0
                  attendeeCount = attendeeCount ?? 0;
                }
              }

              return {
                ...(event as unknown as AppEvent),
                creatorName: creatorMap.get(event.creatorId) || 'Unknown Creator',
                isAttending,
                attendees: attendeesList,
                attendeeCount: attendeeCount ?? 0,
              } as AppEvent & { isAttending?: boolean; attendeeCount?: number };
            })
        );

        const nonAttendingEvents = filteredAndMappedEvents.filter((e: any) => !e.isAttending);
        setEventsWithCreatorNames(nonAttendingEvents as AppEvent[]);

        // Fetch travel announcements with connection pooling
        await dbConnectionPool.acquire(async () => {
          await fetchTravelAnnouncements(userFriends);
        });
      } else {
        // No friends or groups - show empty feed
        setEventsWithCreatorNames([]);
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
      // Use updateEvent function to ensure all required fields are included
      await addEventAttendee(event.$id, currentUserId);
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
      // Use updateEvent function to ensure all required fields are included
      await removeEventAttendee(event.$id, currentUserId);
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

  // Group upcoming events by primary category (derived from tags) and sort groups by soonest event
  const groupedByCategory = (() => {
    const map = new Map<string, { key: string; label: string; emoji: string; events: AppEvent[] }>();

    upcomingEvents.forEach(ev => {
      const cats = getCategoriesByValues(ev.tags || []);
      const primary = cats.length > 0 ? cats[0] : { value: 'other', label: 'Other', emoji: '📅' } as any;
      const key = primary.value || 'other';

      if (!map.has(key)) {
        map.set(key, { key, label: primary.label || 'Other', emoji: primary.emoji || '📅', events: [] });
      }
      map.get(key)!.events.push(ev);
    });

    const sections = Array.from(map.values()).map(section => {
      section.events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      return section;
    });

    sections.sort((s1, s2) => {
      const t1 = s1.events.length > 0 ? new Date(s1.events[0].startTime).getTime() : Infinity;
      const t2 = s2.events.length > 0 ? new Date(s2.events[0].startTime).getTime() : Infinity;
      return t1 - t2;
    });

    return sections;
  })();

  // Compact horizontal card used in category lists
  const renderHorizontalEventCard = ({ item }: { item: AppEvent }) => (
    // Use explicit dark-mode palette for event minicards so they look identical in light and dark themes
    (() => {
      const darkCard = {
        card: '#2c2c2e',
        border: '#333333',
        surface: '#1e1e1e',
        text: '#ffffff',
        textSecondary: '#8e8e93',
        primary: '#FFFFFF',
      };

      return (
        <TouchableOpacity
          style={[styles.eventMiniCard, { backgroundColor: darkCard.card, borderColor: darkCard.border }]}
          onPress={() => router.push(`/(root)/event/${item.$id}?from=feed` as any)}
        >
          <LinearGradient colors={['#FF6B6B', '#FFD166']} style={styles.eventMiniEmoji}>
            <Text style={styles.eventEmojiSmall}>{getEventEmoji(item.tags)}</Text>
          </LinearGradient>
          <View style={styles.eventMiniContent}>
            <Text style={[styles.eventMiniTitle, { color: darkCard.text }]} numberOfLines={2}>{item.title}</Text>
            <Text style={[styles.eventMiniMeta, { color: darkCard.textSecondary }]}>{dayjs(item.startTime).fromNow()}</Text>
          </View>
          <TouchableOpacity style={styles.goIconSmall} onPress={() => router.push(`/(root)/event/${item.$id}?from=feed` as any)}>
            <MaterialIcons name="arrow-forward" size={18} color={darkCard.primary} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    })()
  );

  // Friend bubbles bar (horizontal scroll) - friends with new events ordered first
  const renderFriendBubble = (friend: any) => (
    <TouchableOpacity key={friend.$id} style={styles.friendBubble} onPress={() => router.push(`/(root)/UserProfile/${friend.$id}` as any)}>
      <UserAvatar photoUrl={friendPhotoUrls[friend.$id] || null} name={userDisplayUtils.getFullName(friend)} size={48} />
    </TouchableOpacity>
  );

  const renderEventItem = ({ item }: { item: AppEvent & { creatorName?: string } }) => {
    return (
      <TouchableOpacity
        onPress={() => router.push(`/(root)/event/${item.$id}?from=feed` as any)}
        style={[styles.feedRowCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <LinearGradient colors={["#FF6B6B", "#FFD166"]} style={styles.feedThumb}>
          <Text style={styles.eventEmojiThumb}>{getEventEmoji(item.tags)}</Text>
        </LinearGradient>

        <View style={styles.feedBody}>
          <Text style={[styles.feedTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>

          <View style={styles.feedMetaRow}>
            <MaterialIcons name="calendar-today" size={12} color={colors.textSecondary} />
            <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginLeft: 6 }]}>{dayjs(item.startTime).format('DD MMM, YYYY')}</Text>
            <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginHorizontal: 8 }]}>•</Text>
            <MaterialIcons name="location-on" size={12} color={colors.textSecondary} />
            <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginLeft: 6, flexShrink: 1 }]} numberOfLines={1} ellipsizeMode='tail'>{item.location || ''}</Text>
          </View>

          <View style={styles.feedSubRow}>
            <UserAvatar photoUrl={creatorPhotoUrls[item.creatorId] || null} name={item.creatorName} size={28} />
            <Text style={[styles.smallCreatorName, { color: colors.text, marginLeft: 8 }]} numberOfLines={1}>{item.creatorName || 'Unknown'}</Text>
          </View>
        </View>

        <View style={styles.feedRightCol}>
          {((item as any).price !== undefined && (item as any).price !== null) ? (
            <View style={styles.pricePill}>
              <Text style={styles.priceText}>${(item as any).price}</Text>
            </View>
          ) : null}

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{(typeof item.attendeeCount === 'number' ? item.attendeeCount : (item.attendees?.length || 0))} attending</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
      {/* Improved gradient header */}
      <LinearGradient colors={["#FF6B6B", "#FFD166"]} style={[styles.headerGradient]}>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: '#fff' }]}>UP2 YOU</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setTravelFormVisible(true)} style={styles.headerActionButton}>
              <MaterialIcons name="flight" size={18} color={'#fff'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFormVisible(true)} style={styles.headerActionButton}>
              <MaterialIcons name="add" size={18} color={'#fff'} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Event Feed as a single vertical FlatList with pull-to-refresh */}
      <View style={[styles.feedContent, { paddingBottom: 70 + insets.bottom }]}>
        {/* Compact friends summary (replaces large friend bubble bar) */}
        {friendProfiles.length > 0 && (
          <TouchableOpacity
            style={[styles.feedFriendSummary, { backgroundColor: colors.background }]}
            onPress={() => router.push('/Friends' as any)}
          >
            <View style={styles.friendOverlapRow}>
              {friendProfiles.slice(0, 4).map((f, idx) => (
                <View key={f.$id} style={[styles.friendOverlap, { marginLeft: idx === 0 ? 0 : -12 }]}>
                  <UserAvatar photoUrl={friendPhotoUrls[f.$id] || null} name={userDisplayUtils.getFullName(f)} size={40} />
                </View>
              ))}
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{friendProfiles.length} friends</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>See events from your friends</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Main events FlatList (condensed chronological list) */}
        <FlatList
          data={eventsWithCreatorNames}
          keyExtractor={(item) => item.$id}
          renderItem={renderEventItem}
          ListEmptyComponent={() => (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary }}>No events yet. Pull to refresh.</Text>
            </View>
          )}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={{ paddingHorizontal: 0, paddingBottom: 70 + insets.bottom }}
        />

        {/* Travel announcements (kept below the main feed) */}
        {travelAnnouncements.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.sectionHeaderTitle, { color: colors.text, marginLeft: 16 }]}>Travel Announcements</Text>
            <FlatList
              data={travelAnnouncements}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(t) => t.$id}
              renderItem={({ item }) => (
                <View style={[styles.feedCard, { width: 300, marginHorizontal: 12, backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <UserAvatar photoUrl={item.userPhotoUrl || null} name={item.userName} size={40} />
                    <View style={styles.headerText}>
                      <Text style={[styles.creatorName, { color: colors.text }]}>{item.userName}</Text>
                      <Text style={[styles.timeAgo, { color: colors.textSecondary }]}>{dayjs(item.startDate).fromNow()}</Text>
                    </View>
                    <TouchableOpacity style={styles.moreButton} onPress={() => router.push(`/(root)/event/${item.$id}?from=feed` as any)}>
                      <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          </View>
        )}
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
  categorySection: {
    marginBottom: 18,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  horizontalList: {
    paddingLeft: 12,
    paddingRight: 12,
  },
  eventMiniCard: {
    width: 220,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventMiniEmoji: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventEmojiSmall: {
    fontSize: 28,
  },
  eventMiniContent: {
    flex: 1,
  },
  eventMiniTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  eventMiniMeta: {
    fontSize: 12,
    marginTop: 6,
  },
  goIconSmall: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 8,
  },
  goIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  // Friend bubble bar
  friendBarContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e6e6',
  },
  friendBar: {
    paddingLeft: 12,
    paddingRight: 12,
    alignItems: 'center',
  },
  friendBubble: {
    marginRight: 12,
  },
  // Condensed event card (vertical feed)
  condensedCard: {
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  // New condensed feed card styles
  condensedFeedCard: {
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emojiContainerCondensed: {
    width: '100%',
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventEmojiCondensed: {
    fontSize: 48,
  },
  cardContentCondensed: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  eventTitleCondensed: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  eventMetaCondensed: {
    marginBottom: 6,
  },
  cardFooterCondensed: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
  },
  smallCreatorName: {
    fontSize: 13,
    fontWeight: '600',
  },
  // New horizontal feed row styles
  feedRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  feedThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventEmojiThumb: {
    fontSize: 28,
  },
  feedBody: {
    flex: 1,
    justifyContent: 'center',
  },
  feedTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  feedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedMetaText: {
    fontSize: 12,
  },
  feedSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  feedRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 72,
  },
  pricePill: {
    backgroundColor: '#fff0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  priceText: {
    color: '#d64545',
    fontWeight: '700',
  },
  joinButton: {
    backgroundColor: '#1f6feb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  // Compact friends summary styles
  feedFriendSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  friendOverlapRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendOverlap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)'
  },
});
