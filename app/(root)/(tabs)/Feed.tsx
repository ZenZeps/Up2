import EventImage from '@/components/EventImage';
import TopPicks from '@/components/feed/TopPicks';
import { Background } from '@/components/ui/Background';
import { getCategoriesByValues } from '@/constants/categories';
import { addEventAttendee, getEventAttendeesFor, getUserAttendingEvents, removeEventAttendee } from '@/lib/api/event';
import { getUserFriends } from '@/lib/api/friendship';
import { getUserGroups } from '@/lib/api/group';

import { getFriendsTravelAnnouncements } from '@/lib/api/travel';
import { getUsersByIds } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { useActionTracker } from '@/lib/hooks/useOptimizedData';
import { useRealTimeUI } from '@/lib/hooks/useRealTimeUI';
import { useUserLocation } from '@/lib/hooks/useUserLocation';
import { useCreatorInfo } from '@/lib/utils/creatorInfoManager';
import { cacheScreenData } from '@/lib/utils/dataFetchingOptimizer';
import { batchProcess, dbConnectionPool } from '@/lib/utils/dbOptimization';
import { realTimeUI } from '@/lib/utils/realTimeUI';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
// header will be plain white
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import UserAvatar from '../components/UserAvatar';

import { Event as AppEvent } from '@/lib/types/Events';
import { TravelAnnouncement } from '@/lib/types/Travel';
import EventForm from '../components/forms/EventForm';
import TravelForm from '../components/forms/TravelForm';
import { useEvents } from '../context/EventContext';

dayjs.extend(relativeTime);

// Extended types for Feed
interface TravelAnnouncementWithUserInfo extends TravelAnnouncement {
  userName?: string;
  userPhotoUrl?: string;
}

// Combined feed item type
// Local extended event type used in the UI layer during migration. This keeps the runtime shape
// (attendees/inviteeIds may be present temporarily) without changing the central Event type.
type ExtendedEvent = AppEvent & { attendees?: string[]; inviteeIds?: string[]; isAttending?: boolean; attendeeCount?: number; creatorName?: string };

type FeedItem = (ExtendedEvent & { type: 'event' }) | (TravelAnnouncementWithUserInfo & { type: 'travel' });

export default function Feed() {
  const { colors, isColorful } = useTheme();
  const insets = useSafeAreaInsets();
  const { events, refetchEvents, hasInitialLoad, getScreenEvents, setScreenEvents, markScreenLoadedFromDb, getScreenLoadedFromDb } = useEvents();
  const { user: globalUser } = useGlobalContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const recordAction = useActionTracker();
  const { getEventDistance } = useUserLocation();

  const [formVisible, setFormVisible] = useState(false);
  const [travelFormVisible, setTravelFormVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [baseEventsWithCreatorNames, setBaseEventsWithCreatorNames] = useState<ExtendedEvent[]>([]);
  const [eventsWithCreatorNames, setEventsWithCreatorNames] = useState<ExtendedEvent[]>([]);
  const [allEventsForTopPicks, setAllEventsForTopPicks] = useState<AppEvent[]>([]);

  // Extract creator IDs for unified creator info management
  const creatorIds = useMemo(() => {
    if (!baseEventsWithCreatorNames || baseEventsWithCreatorNames.length === 0) return [];
    const ids = baseEventsWithCreatorNames
      .map((event) => event.creatorId)
      .filter(Boolean);
    return [...new Set(ids)] as string[];
  }, [baseEventsWithCreatorNames]);

  // Use unified creator info management
  const { getCreatorName, getCreatorPhotoUrl, creatorNames, creatorPhotos } = useCreatorInfo(creatorIds, 20);

  // Re-render when real-time UI pending actions change
  const rtTick = useRealTimeUI();

  // Memoize the filtered events to prevent unnecessary recalculations
  const filteredEvents = useMemo(() => {
    if (!Array.isArray(baseEventsWithCreatorNames) || !currentUserId) {
      return baseEventsWithCreatorNames;
    }

    const pendingAttendIds = new Set(realTimeUI.getEventIdsByAction('attend'));
    const pendingUnattendIds = new Set(realTimeUI.getEventIdsByAction('unattend'));

    // Feed shows non-attending events
    // Remove events with pending 'attend' (user is joining)
    let filtered = baseEventsWithCreatorNames.filter(ev => !pendingAttendIds.has(ev.$id));

    // Add back events with pending unattend (from global context if available)
    if (pendingUnattendIds.size > 0) {
      try {
        const additionalEvents = events.filter((ev: any) => pendingUnattendIds.has(ev.$id));
        const eventsMap = new Map(filtered.map(e => [e.$id, e]));
        additionalEvents.forEach((ev: any) => {
          if (!eventsMap.has(ev.$id)) {
            eventsMap.set(ev.$id, ev as ExtendedEvent);
          }
        });
        filtered = Array.from(eventsMap.values());
      } catch (e) {
        // Context not available, continue with filtered events
      }
    }

    return filtered;
  }, [baseEventsWithCreatorNames, currentUserId, rtTick, events]);

  // Apply filtered events only when they actually change
  useEffect(() => {
    console.log('🍽️ Feed setting filtered events', { count: filteredEvents?.length || 0 });
    setEventsWithCreatorNames(filteredEvents);
  }, [filteredEvents]);

  const [travelAnnouncements, setTravelAnnouncements] = useState<TravelAnnouncementWithUserInfo[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const lastFeedFetch = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 30 * 1000; // 30s rate limit for automatic fetches
  const attendingCache = useRef<Map<string, { ids: Set<string>; ts: number }>>(new Map());
  const ATTENDING_CACHE_TTL = 60 * 1000; // 60s
  const isInitialMount = useRef<boolean>(true);

  // Optimized single-path fetch function
  const fetchFeedData = useCallback(async (force: boolean = false) => {
    if (!globalUser?.$id) return;

    // Rate limit automatic fetches
    if (!force && Date.now() - lastFeedFetch.current < MIN_FETCH_INTERVAL) {
      console.log('Feed: skipping fetch - rate limited');
      return;
    }

    setRefreshing(true);
    setCurrentUserId(globalUser.$id);
    lastFeedFetch.current = Date.now();

    try {
      // Load social graph in parallel
      const [userFriends, userGroups] = await Promise.all([
        getUserFriends(globalUser.$id),
        getUserGroups(globalUser.$id)
      ]);

      setFriends(userFriends);
      const userGroupIds = userGroups.map(g => g.$id);

      // If no social graph, show empty feed
      if (userFriends.length === 0 && userGroupIds.length === 0) {
        setBaseEventsWithCreatorNames([]);
        setTravelAnnouncements([]);
        return;
      }

      // Single API call for events (use cache if available)
      const { getPublicEvents } = await import('@/lib/api/event');
      const { cacheManager } = await import('@/lib/debug/cacheManager');

      let allEvents;
      const cachedEvents = cacheManager.get('all-events');
      if (!force && cachedEvents && Array.isArray(cachedEvents)) {
        allEvents = cachedEvents;
        console.log('Feed: Using cached events', allEvents.length);
      } else {
        allEvents = await getPublicEvents(false, globalUser.$id);
        if (allEvents?.length > 0) {
          cacheManager.set('all-events', allEvents, 15 * 60 * 1000); // 15 min cache
        }
        console.log('Feed: Fetched fresh events', allEvents.length);
      }

      setAllEventsForTopPicks(allEvents);

      // Filter to relevant events for user's social graph
      const now = new Date();
      const relevantEvents = allEvents
        .filter((ev: any) => userFriends.includes(ev.creatorId) || (ev.groupId && userGroupIds.includes(ev.groupId)))
        .filter((ev: any) => new Date(ev.endTime || ev.date) >= now);

      // Single API call for attending events (with caching)
      let attendingIds = new Set<string>();
      const cached = attendingCache.current.get(globalUser.$id);
      if (cached && Date.now() - cached.ts < ATTENDING_CACHE_TTL) {
        attendingIds = cached.ids;
      } else {
        const attendingEvents = await getUserAttendingEvents(globalUser.$id);
        attendingIds = new Set(attendingEvents.map((a: any) => a.$id));
        attendingCache.current.set(globalUser.$id, { ids: attendingIds, ts: Date.now() });
      }

      // Filter out attending events (Feed shows non-attending)
      const nonAttendingEvents = relevantEvents.filter(ev => !attendingIds.has(ev.$id));

      // Batch fetch attendees for all events at once
      const eventIds = nonAttendingEvents.map((ev: any) => ev.$id);
      const attendeesMap = await getEventAttendeesFor(eventIds);

      // Map events with attendance data
      const mappedEvents = nonAttendingEvents.map((event: any) => {
        const junctionAttendees = Array.isArray(attendeesMap[event.$id]) ? attendeesMap[event.$id] : [];
        const attendeesList = junctionAttendees.length > 0 ? junctionAttendees : (Array.isArray(event.attendees) ? event.attendees : []);
        const attendeeCount = junctionAttendees.length > 0 ? junctionAttendees.length : (typeof event.attendeeCount === 'number' ? event.attendeeCount : attendeesList.length);

        return {
          ...(event as unknown as AppEvent),
          isAttending: false, // Feed only shows non-attending events
          attendees: attendeesList,
          attendeeCount: attendeeCount ?? 0,
        } as ExtendedEvent;
      });

      setBaseEventsWithCreatorNames(mappedEvents);

      // Cache the processed feed data
      try {
        setScreenEvents('feed', mappedEvents);
        await cacheScreenData('feed', mappedEvents);
        markScreenLoadedFromDb?.('feed', true);
      } catch (err) {
        console.warn('Feed: failed to persist feed cache', err);
      }

      // Load travel announcements
      await dbConnectionPool.acquire(async () => {
        await fetchTravelAnnouncements(userFriends);
      });

      console.log(`Feed: Loaded ${mappedEvents.length} events successfully`);

    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setRefreshing(false);
      isInitialMount.current = false;
    }
  }, [globalUser?.$id, getScreenEvents, setScreenEvents, markScreenLoadedFromDb]);

  // Initial load - simplified single path
  useEffect(() => {
    if (initialLoadComplete || !globalUser?.$id) return;

    const init = async () => {
      await fetchFeedData();
      setInitialLoadComplete(true);
    };
    init();
  }, [initialLoadComplete, globalUser?.$id, fetchFeedData]);

  // Simple focus effect for refresh check
  useFocusEffect(
    useCallback(() => {
      if (!initialLoadComplete) return;

      // Simple 5-minute cache check
      const lastFetch = lastFeedFetch.current;
      const shouldRefresh = Date.now() - lastFetch > 5 * 60 * 1000; // 5 minutes

      if (shouldRefresh) {
        fetchFeedData(true);
      }
    }, [initialLoadComplete, fetchFeedData])
  );

  const fetchTravelAnnouncements = async (friendIds: string[]) => {
    try {
      console.log('🧳 Feed: Loading travel announcements for', friendIds.length, 'friends');

      const travelData = await getFriendsTravelAnnouncements(friendIds, 30);

      if (travelData.length === 0) {
        setTravelAnnouncements([]);
        return;
      }

      // Filter for upcoming travel only
      const now = new Date();
      const upcomingTravel = travelData.filter(travel => new Date(travel.endDate) > now);

      if (upcomingTravel.length === 0) {
        setTravelAnnouncements([]);
        return;
      }

      // Batch fetch user profiles for travel announcements
      const uniqueUserIds = [...new Set(upcomingTravel.map(travel => travel.userId))];
      const userProfiles = await batchProcess(uniqueUserIds, async (batch: string[]) => await getUsersByIds(batch), 25);
      const profileMap = new Map(userProfiles.flat().map((profile: any) => [profile.$id, profile]));

      // Map travel with user info (no photos for simplicity)
      const travelWithUserInfo = upcomingTravel.map((travel) => {
        const userProfile = profileMap.get(travel.userId);
        return {
          ...travel,
          userName: userDisplayUtils.getFullName(userProfile || {}, 'Unknown User'),
          userPhotoUrl: undefined, // Simplified - no photo loading for travel announcements
        } as TravelAnnouncementWithUserInfo;
      });

      setTravelAnnouncements(travelWithUserInfo);
      console.log(`Feed: Loaded ${travelWithUserInfo.length} travel announcements`);
    } catch (error) {
      console.error('Error fetching travel announcements:', error);
      setTravelAnnouncements([]);
    }
  };

  const openInMaps = (location: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    Linking.openURL(url);
  };

  const handleAttend = async (event: ExtendedEvent) => {
    if (!currentUserId) return;

    // Simple local check - if event not in feed, user is already attending
    if (eventsWithCreatorNames.findIndex(e => e.$id === event.$id) === -1) {
      Alert.alert('Info', 'You are already attending this event.');
      return;
    }

    // Apply immediate UI feedback - the reactive overlay will handle list updates
    realTimeUI.applyAction(event.$id, 'attend');

    try {
      // Perform the actual database update
      await addEventAttendee(event.$id, currentUserId);
      Alert.alert('Success', 'You are now attending this event!');

      // Clear the pending action since it succeeded
      realTimeUI.clearAction(event.$id);
    } catch (err) {
      console.error('Attend event error:', err);
      Alert.alert('Error', 'Failed to attend event');

      // Clear the pending action on failure too
      realTimeUI.clearAction(event.$id);
    }
  };

  // Pull-to-refresh handler used by FlatList
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchFeedData();
    } catch (err) {
      console.error('Error on manual refresh:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleNotAttend = async (event: ExtendedEvent) => {
    if (!currentUserId) return;

    // Apply immediate UI feedback - the reactive overlay will handle list updates
    realTimeUI.applyAction(event.$id, 'unattend');

    try {
      // Perform the actual database update
      await removeEventAttendee(event.$id, currentUserId);
      Alert.alert('Success', 'You are no longer attending this event.');

      // Clear the pending action since it succeeded
      realTimeUI.clearAction(event.$id);
    } catch (err) {
      console.error('Not attend event error:', err);
      Alert.alert('Error', 'Failed to un-attend event');

      // Clear the pending action on failure too
      realTimeUI.clearAction(event.$id);
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
        <View
          style={[styles.eventMiniCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <EventImage
            photoId={(item as any).photoId}
            tags={item.tags}
            size={48}
            style={styles.eventMiniEmoji}
            gradientColors={["#c78aa5", "#db7d95", "#f2948f", "#f6b793", "#fbf4be"]}
          />
          <View style={styles.eventMiniContent}>
            <Text style={[styles.eventMiniTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
            <Text style={[styles.eventMiniMeta, { color: colors.textSecondary }]}>{dayjs(item.startTime).fromNow()}</Text>
          </View>
          <View style={styles.goIconSmall}>
            <MaterialIcons name="arrow-forward" size={18} color={darkCard.primary} />
          </View>
        </View>
      );
    })()
  );

  // Friend bubbles bar (horizontal scroll) - simplified without photos
  const renderFriendBubble = (friend: any) => (
    <View key={friend.$id} style={styles.friendBubble}>
      <UserAvatar photoUrl={null} name={userDisplayUtils.getFullName(friend)} size={48} />
    </View>
  );

  const renderEventItem = ({ item }: { item: AppEvent & { creatorName?: string } }) => {
    const { formattedDistance } = getEventDistance(item.location || '');

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(root)/events/${item.$id}?from=feed` as any)}
        style={[styles.feedRowCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <EventImage
          photoId={(item as any).photoId}
          tags={item.tags}
          size={72}
          style={styles.feedThumb}
        />

        <View style={styles.feedBody}>
          <Text style={[styles.feedTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>

          <View style={styles.feedMetaRow}>
            <MaterialIcons name="calendar-today" size={12} color={colors.textSecondary} />
            <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginLeft: 6 }]}>{dayjs(item.startTime).format('DD MMM, YYYY')}</Text>
            <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginHorizontal: 8 }]}>•</Text>
            <MaterialIcons name="location-on" size={12} color={colors.textSecondary} />
            <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginLeft: 6, flexShrink: 1 }]} numberOfLines={1} ellipsizeMode='tail'>{item.location || ''}</Text>
            {formattedDistance && (
              <>
                <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginHorizontal: 8 }]}>•</Text>
                <Text style={[styles.feedMetaText, { color: '#4A90E2', marginLeft: 0, fontWeight: '500' }]}>{formattedDistance}</Text>
              </>
            )}
          </View>

          <View style={styles.feedSubRow}>
            <UserAvatar photoUrl={getCreatorPhotoUrl(item.creatorId)} name={getCreatorName(item.creatorId)} size={28} />
            <Text style={[styles.smallCreatorName, { color: colors.text, marginLeft: 8 }]} numberOfLines={1}>{getCreatorName(item.creatorId)}</Text>
          </View>
        </View>

        <View style={styles.feedRightCol}>
          {((item as any).price !== undefined && (item as any).price !== null) ? (
            <View style={styles.pricePill}>
              <Text style={styles.priceText}>${(item as any).price}</Text>
            </View>
          ) : null}

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{(item as any).attendeeCount ?? 0} attending</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{(item as any).inviteCount ?? 0} invited</Text>
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
    <Background>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        {/* Conditional Header - gradient only in colorful mode */}
        {isColorful ? (
          <View style={[styles.headerGradient, { backgroundColor: 'transparent' }]}>
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
          </View>
        ) : (
          <View style={[styles.headerGradient, { backgroundColor: colors.background }]}>
            <View style={styles.headerContent}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>UP2 YOU</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => setTravelFormVisible(true)} style={styles.headerActionButton}>
                  <MaterialIcons name="flight" size={18} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFormVisible(true)} style={styles.headerActionButton}>
                  <MaterialIcons name="add" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Event Feed as a single vertical FlatList with pull-to-refresh */}
        <View style={[styles.feedContent, { flex: 1 }]}>
          {/* Main events FlatList (condensed chronological list) */}
          <FlatList
            data={eventsWithCreatorNames}
            keyExtractor={(item) => item.$id}
            renderItem={renderEventItem}
            ListHeaderComponent={useMemo(() => () => (
              <TopPicks
                allEvents={allEventsForTopPicks}
                userFriends={friends}
                currentUserId={currentUserId || undefined}
                maxPicks={8}
              />
            ), [allEventsForTopPicks, friends, currentUserId])}
            ListEmptyComponent={() => (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>No events yet. Pull to refresh.</Text>
              </View>
            )}
            refreshing={refreshing}
            onRefresh={onRefresh}
            style={{ flex: 1 }}
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
                      <TouchableOpacity style={styles.moreButton} onPress={() => router.push(`/(root)/events/${item.$id}?from=feed` as any)}>
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
            onClose={async (eventWasModified?: boolean) => {
              setFormVisible(false);
              // If an event was created or updated, record the action
              if (eventWasModified) {
                await recordAction('create', 'feed_event_created');
              }
            }}
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
            userFriends={friends}
          />
        )}
      </SafeAreaView>
    </Background>
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
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
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
    paddingTop: 0, // Remove top padding to bring TopPicks closer to header
    paddingBottom: 8,
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
    padding: 8,
    marginHorizontal: 12,
    marginBottom: 8,
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
