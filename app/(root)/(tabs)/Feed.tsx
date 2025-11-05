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
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Linking, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  // Apply filtered events only when content actually changes - deep optimized
  useEffect(() => {
    if (filteredEvents !== eventsWithCreatorNames) {
      // Prevent unnecessary updates if arrays have same content
      const currentIds = eventsWithCreatorNames?.map(e => e.$id).sort().join(',') || '';
      const newIds = filteredEvents?.map(e => e.$id).sort().join(',') || '';

      if (currentIds !== newIds) {
        console.log('🍽️ Feed setting filtered events', { count: filteredEvents?.length || 0 });
        setEventsWithCreatorNames(filteredEvents);
      }
    }
  }, [filteredEvents, eventsWithCreatorNames]);

  const [travelAnnouncements, setTravelAnnouncements] = useState<TravelAnnouncementWithUserInfo[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const lastFeedFetch = useRef<number>(0);
  const fetchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MIN_FETCH_INTERVAL = 5 * 1000; // Reduced to 5s for better responsiveness
  const attendingCache = useRef<Map<string, { ids: Set<string>; ts: number }>>(new Map());
  const ATTENDING_CACHE_TTL = 2 * 60 * 1000; // Reduced to 2 minutes
  const isInitialMount = useRef<boolean>(true);

  // Optimized single-path fetch function
  const fetchFeedData = useCallback(async (force: boolean = false) => {
    if (!globalUser?.$id || isFetching) return;

    // Rate limit automatic fetches
    if (!force && Date.now() - lastFeedFetch.current < MIN_FETCH_INTERVAL) {
      console.log('Feed: skipping fetch - rate limited');
      return;
    }

    setIsFetching(true);
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
          cacheManager.set('all-events', allEvents, 3 * 60 * 1000); // Reduced to 3 min cache
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

      console.log(`✅ Feed: Loaded ${mappedEvents.length} events successfully (${Date.now() - lastFeedFetch.current}ms)`);

    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setRefreshing(false);
      setIsFetching(false);
      isInitialMount.current = false;
    }
  }, [globalUser?.$id, getScreenEvents, setScreenEvents, markScreenLoadedFromDb]);

  // Debounced fetch to prevent rapid successive calls
  const debouncedFetchFeedData = useCallback((force: boolean = false) => {
    if (fetchTimeout.current) {
      clearTimeout(fetchTimeout.current);
    }

    fetchTimeout.current = setTimeout(() => {
      fetchFeedData(force);
    }, 100); // 100ms debounce
  }, [fetchFeedData]);

  // Initial load - simplified single path with proper dependency management
  useEffect(() => {
    if (initialLoadComplete || !globalUser?.$id || isInitialMount.current === false) return;

    const init = async () => {
      console.log('🚀 Feed: Initial load starting');
      await fetchFeedData(false); // Use cache on initial load
      setInitialLoadComplete(true);
      isInitialMount.current = false;
    };
    init();
  }, [globalUser?.$id]); // Removed fetchFeedData from deps to prevent re-runs

  // Simple focus effect for refresh check with debounce
  useFocusEffect(
    useCallback(() => {
      if (!initialLoadComplete) return;

      // Check if we have recent cached data
      const lastFetch = lastFeedFetch.current;
      const cacheAge = Date.now() - lastFetch;
      const shouldRefresh = cacheAge > 5 * 60 * 1000; // 5 minutes

      // Only refresh if cache is stale and we have existing data
      if (shouldRefresh && eventsWithCreatorNames?.length > 0) {
        console.log('Feed: Focus refresh - cache is stale');
        debouncedFetchFeedData(false); // Use debounced version
      } else if (shouldRefresh && (!eventsWithCreatorNames || eventsWithCreatorNames.length === 0)) {
        console.log('Feed: Focus refresh - no data available');
        debouncedFetchFeedData(true); // Force if no data
      }
    }, [initialLoadComplete, eventsWithCreatorNames?.length]) // Only depend on data availability
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeout.current) {
        clearTimeout(fetchTimeout.current);
        fetchTimeout.current = null;
      }
    };
  }, []);

  const fetchTravelAnnouncements = async (friendIds: string[]) => {
    try {
      console.log('🧳 Feed: Loading travel announcements for', friendIds.length, 'friends');
      console.log('🧳 Feed: Friend IDs:', friendIds.slice(0, 3).map(id => id.substring(0, 8) + '...'));

      const travelData = await getFriendsTravelAnnouncements(friendIds, 30, true, currentUserId || undefined);

      console.log('🧳 Feed: Travel query returned:', {
        count: travelData.length,
        sampleIds: travelData.slice(0, 3).map(t => t.$id.substring(0, 8) + '...'),
        sampleDestinations: travelData.slice(0, 3).map(t => t.destination)
      });

      if (travelData.length === 0) {
        console.log('🧳 Feed: No travel data found, setting empty array');
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

  // Create combined feed items (events + travel announcements) sorted chronologically
  const combinedFeedItems = useMemo((): FeedItem[] => {
    const eventItems: FeedItem[] = upcomingEvents.map(event => ({
      ...event,
      type: 'event' as const
    }));

    const travelItems: FeedItem[] = travelAnnouncements.map(travel => ({
      ...travel,
      type: 'travel' as const
    }));

    // Combine and sort by creation time (most recent first)
    const allItems = [...eventItems, ...travelItems];
    const sortedItems = allItems.sort((a, b) => {
      const timeA = a.type === 'event' ? new Date(a.startTime).getTime() : new Date(a.startDate).getTime();
      const timeB = b.type === 'event' ? new Date(b.startTime).getTime() : new Date(b.startDate).getTime();
      return timeA - timeB; // Ascending order (soonest first)
    });

    // Debug logging
    console.log('🧳 Feed: Combined timeline items:', {
      totalItems: sortedItems.length,
      eventCount: eventItems.length,
      travelCount: travelItems.length,
      sampleItems: sortedItems.slice(0, 3).map(item => ({
        type: item.type,
        title: item.type === 'event' ? item.title : `Travel to ${item.destination}`,
        date: item.type === 'event' ? item.startTime : item.startDate
      }))
    });

    return sortedItems;
  }, [upcomingEvents, travelAnnouncements]);

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
            gradientColors={["#667eea", "#764ba2"]}
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

  const handleShareEvent = async (item: AppEvent) => {
    try {
      const result = await Share.share({
        message: `Check out "${item.title}" on Up2! Join us ${dayjs(item.startTime).format('MMM DD, YYYY')} at ${item.location || 'TBA'}`,
        title: item.title,
      });
    } catch (error) {
      console.error('Error sharing event:', error);
    }
  };

  const renderEventItem = ({ item }: { item: AppEvent & { creatorName?: string } }) => {
    const { formattedDistance } = getEventDistance(item.location || '');

    return (
      <View style={[styles.modernPostCard, { backgroundColor: colors.card }]}>
        {/* Event Title and Location */}
        <View style={styles.eventTitleContainer}>
          <Text style={[styles.eventTitle, { color: colors.text }]}>
            {item.title}
          </Text>
          <Text style={[styles.eventLocation, { color: colors.textSecondary }]}>
            {item.location || 'Location not specified'}
          </Text>
        </View>

        {/* Event Image - Only clickable element */}
        <TouchableOpacity
          onPress={() => router.push(`/(root)/events/${item.$id}?from=feed` as any)}
          style={styles.postImageContainer}
        >
          <EventImage
            photoId={(item as any).photoId}
            tags={item.tags}
            size={400}
            style={styles.postImage}
          />
          {/* Creator Overlay - Top Left */}
          <View style={styles.creatorOverlay}>
            <UserAvatar
              photoUrl={getCreatorPhotoUrl(item.creatorId)}
              name={getCreatorName(item.creatorId)}
              size={28}
            />
            <Text style={styles.creatorOverlayText}>
              {getCreatorName(item.creatorId)}
            </Text>
          </View>
          {/* Event Date Overlay */}
          <View style={styles.dateOverlay}>
            <Text style={styles.dateOverlayText}>
              {dayjs(item.startTime).format('MMM DD')}
            </Text>
            <Text style={styles.timeOverlayText}>
              {dayjs(item.startTime).format('h:mm A')}
            </Text>
          </View>
          {/* Attending Count Overlay */}
          <View style={styles.attendingOverlay}>
            <Text style={styles.attendingOverlayText}>
              {(item as any).attendeeCount ?? 0} Attending
            </Text>
          </View>
        </TouchableOpacity>

        {/* Post Actions */}
        <View style={styles.postActions}>
          <View style={styles.leftActions}>
            <TouchableOpacity style={styles.actionButton}>
              <MaterialIcons name="favorite-border" size={26} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleShareEvent(item)}
            >
              <MaterialIcons name="share" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.attendPostButtonGrey}
          >
            <MaterialIcons name="person-add" size={20} color="white" />
            <Text style={styles.attendPostButtonGreyText}>Attend</Text>
          </TouchableOpacity>
        </View>

        {/* Post Content - Reduced padding */}
        <View style={styles.postContentMinimal}>
          {/* Event Details - Only distance and price */}
          <View style={styles.eventDetails}>
            {formattedDistance && (
              <View style={styles.eventDetailRow}>
                <MaterialIcons name="location-on" size={16} color={colors.primary} />
                <Text style={[styles.eventDetailText, { color: colors.textSecondary }]}>
                  {formattedDistance} away
                </Text>
              </View>
            )}
            {((item as any).price !== undefined && (item as any).price !== null) && (
              <View style={styles.eventDetailRow}>
                <MaterialIcons name="attach-money" size={16} color={colors.primary} />
                <Text style={[styles.eventDetailText, { color: colors.primary, fontWeight: '600' }]}>
                  ${(item as any).price}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
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
        <TouchableOpacity style={styles.cardActionButton}>
          <MaterialIcons name="favorite-border" size={20} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>Like</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cardActionButton}>
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
        {/* Modern Instagram-style Header */}
        {isColorful ? (
          <LinearGradient colors={["#667eea", "#764ba2"]} style={[styles.modernHeader]}>
            <View style={styles.headerContent}>
              <Text style={[styles.modernHeaderTitle, { color: '#ffffff' }]}>Up2</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => setTravelFormVisible(true)} style={styles.modernHeaderButton}>
                  <MaterialIcons name="flight" size={22} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFormVisible(true)} style={styles.modernHeaderButton}>
                  <MaterialIcons name="add-box" size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        ) : (
          <View style={[styles.modernHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <View style={styles.headerContent}>
              <Text style={[styles.modernHeaderTitle, { color: colors.text }]}>Up2</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => setTravelFormVisible(true)} style={styles.modernHeaderButton}>
                  <MaterialIcons name="flight" size={22} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFormVisible(true)} style={styles.modernHeaderButton}>
                  <MaterialIcons name="add-box" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Combined Feed Timeline (Events + Travel) */}
        <View style={[styles.feedContent, { flex: 1 }]}>
          <FlatList
            data={combinedFeedItems}
            keyExtractor={(item) => `${item.type}-${item.$id}`}
            renderItem={renderFeedItem}
            ListHeaderComponent={useMemo(() => () => (
              <View>
                {/* Top Picks */}
                <View style={{ marginTop: 8 }}>
                  <TopPicks
                    allEvents={allEventsForTopPicks}
                    userFriends={friends}
                    currentUserId={currentUserId || undefined}
                    maxPicks={8}
                  />
                </View>
              </View>
            ), [allEventsForTopPicks, friends, currentUserId, colors])}
            ListEmptyComponent={() => (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>No events yet. Pull to refresh.</Text>
              </View>
            )}
            refreshing={refreshing}
            onRefresh={onRefresh}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 70 + insets.bottom }}
            showsVerticalScrollIndicator={false}
          />


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
    letterSpacing: -0.5,
  },
  // Modern Instagram-style post card styles
  modernPostCard: {
    backgroundColor: 'white',
    marginBottom: 16,
    borderRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  postHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  postUsername: {
    fontSize: 16,
    fontWeight: '600',
  },
  postLocation: {
    fontSize: 12,
    marginTop: 2,
  },
  postMoreButton: {
    padding: 8,
  },
  postImageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
  },
  postImage: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  dateOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  dateOverlayText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  timeOverlayText: {
    color: 'white',
    fontSize: 11,
    marginTop: 2,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8, // Reduced from 12 to 8
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 16,
    padding: 4,
  },
  attendPostButton: {
    backgroundColor: '#0095f6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  attendPostButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  postContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  postLikes: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  postCaption: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 12,
  },
  postCaptionUsername: {
    fontWeight: '600',
  },
  eventDetails: {
    marginVertical: 8,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventDetailText: {
    fontSize: 13,
    marginLeft: 8,
  },
  postTime: {
    fontSize: 12,
    marginTop: 8,
  },
  // Event title container - prominent position
  eventTitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  eventLocation: {
    fontSize: 14,
    marginTop: 4,
  },
  // Creator overlay on image - top left
  creatorOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  creatorOverlayText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Attending count overlay on image
  attendingOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  attendingOverlayText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // Dark grey attend button
  attendPostButtonGrey: {
    backgroundColor: '#6B7280',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  attendPostButtonGreyText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Minimal post content with less padding
  postContentMinimal: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  // Creator info section - below image
  postCreatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dbdbdb',
  },
  creatorInfoText: {
    flex: 1,
    marginLeft: 12,
  },
  creatorUsername: {
    fontSize: 14,
    fontWeight: '600',
  },
  creatorLocation: {
    fontSize: 12,
    marginTop: 2,
  },
  creatorMoreButton: {
    padding: 4,
  },
  // Modern header styles
  modernHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dbdbdb',
  },
  modernHeaderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Billabong', // Instagram-style font (fallback to system)
  },
  modernHeaderButton: {
    padding: 6,
    marginLeft: 0, // Removed extra margin since gap handles spacing
  },
  // Stories section styles
  storiesSection: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dbdbdb',
  },
  storiesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 16,
    marginBottom: 12,
  },
  storiesContainer: {
    paddingHorizontal: 16,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  storyAvatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    padding: 2,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyName: {
    fontSize: 12,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8, // Reduced from 12 to 8
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
  cardActionButton: {
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

  smallCreatorName: {
    fontSize: 13,
    fontWeight: '600',
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
