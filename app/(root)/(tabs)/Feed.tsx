import EventImage from '@/components/EventImage';
import TopPicks from '@/components/feed/TopPicks';
import { Background } from '@/components/ui/Background';
import { getCategoriesByValues } from '@/constants/categories';
import { addEventAttendee, getEventAttendeesFor, getUserAttendingEvents, removeEventAttendee } from '@/lib/api/event';
import { getUserFriends } from '@/lib/api/friendship';
import { getUserGroups } from '@/lib/api/group';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getFriendsTravelAnnouncements } from '@/lib/api/travel';
import { getUsersByIds } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { useActionTracker } from '@/lib/hooks/useOptimizedData';
import { useRealTimeUI } from '@/lib/hooks/useRealTimeUI';
import { useUserLocation } from '@/lib/hooks/useUserLocation';
import { useCreatorInfo } from '@/lib/utils/creatorInfoManager';
import { cacheScreenData, shouldFetchData } from '@/lib/utils/dataFetchingOptimizer';
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

  const [friendProfiles, setFriendProfiles] = useState<any[]>([]);
  const [friendPhotoUrls, setFriendPhotoUrls] = useState<Record<string, string | null>>({});
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [creatorPhotoUrls, setCreatorPhotoUrls] = useState<Record<string, string | null>>({});
  const backgroundRevalidating = useRef(false);
  const lastFeedFetch = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 30 * 1000; // 30s rate limit for automatic fetches
  const attendingCache = useRef<Map<string, { ids: Set<string>; ts: number }>>(new Map());
  const ATTENDING_CACHE_TTL = 60 * 1000; // 60s
  const isInitialMount = useRef<boolean>(true);

  // Optimized fetch function for scalability (clean SWR-first implementation)
  const fetchFeedData = useCallback(async (force: boolean = false) => {
    if (!globalUser?.$id) return;

    // Check if we should fetch from database or use cache
    const strategy = force ?
      { shouldFetch: true, reason: 'forced', cacheStrategy: 'database' as const } :
      await shouldFetchData('feed', isInitialMount.current);

    console.log(`Feed: Fetch strategy - ${strategy.cacheStrategy} (${strategy.reason})`);

    if (!strategy.shouldFetch) {
      // Use cached data
      if (strategy.cacheStrategy === 'memory' && getScreenEvents) {
        const cachedEvents = getScreenEvents('feed') || [];
        if (cachedEvents.length > 0) {
          const now = new Date();
          const mapped = (cachedEvents as ExtendedEvent[])
            .filter(e => {
              const end = (e as any).endTime || (e as any).date || (e as any).startTime;
              return new Date(end) >= now;
            })
            .map(e => ({
              ...(e as ExtendedEvent),
              creatorName: (e as any).creatorName || undefined,
              isAttending: (e as any).isAttending ?? false,
              attendeeCount: typeof (e as any).attendeeCount === 'number' ? (e as any).attendeeCount : 0,
            } as ExtendedEvent));

          setBaseEventsWithCreatorNames(mapped);
          setInitialLoadComplete(true);
          console.log(`Feed: Loaded ${mapped.length} events from ${strategy.cacheStrategy} cache`);
          return;
        }
      }
    }

    // Rate limit automatic fetches to avoid repeated DB reads  
    if (!force && Date.now() - lastFeedFetch.current < MIN_FETCH_INTERVAL) {
      console.log('Feed: skipping fetch - rate limited');
      return;
    }

    setRefreshing(true);
    setCurrentUserId(globalUser.$id);

    try {
      // Load friends (profiles and photos will be loaded asynchronously to avoid blocking the feed render)
      const userFriends = await getUserFriends(globalUser.$id);
      setFriends(userFriends);

      // Load groups
      const userGroups = await getUserGroups(globalUser.$id);
      const userGroupIds = userGroups.map(g => g.$id);

      // If no social graph, nothing to show
      if (userFriends.length === 0 && userGroupIds.length === 0) {
        setBaseEventsWithCreatorNames([]);
        setTravelAnnouncements([]);
        // No need to refetch global EventContext for empty feed
        return;
      }

      // SWR: try cached read first
      const { cacheManager } = await import('@/lib/debug/cacheManager');
      const eventsCacheKey = `all-events`;
      const cachedEntry = cacheManager.getEntry<any[]>(eventsCacheKey);

      if (cachedEntry && Array.isArray(cachedEntry.data)) {
        try {
          const cachedArray = cachedEntry.data;
          const now = new Date();
          // Filter to relevant events (friends/groups) and upcoming only
          const relevantCached = cachedArray
            .filter(e => (userFriends.includes(e.creatorId) || (e.groupId && userGroupIds.includes(e.groupId))))
            .filter((ev: any) => new Date(ev.endTime || ev.date) >= now);

          // Initialize attendance checking and filter using attendance data
          let attendingIds: Set<string>;
          try {
            const cached = attendingCache.current.get(globalUser.$id || '');
            if (cached && Date.now() - cached.ts < ATTENDING_CACHE_TTL) {
              attendingIds = new Set(cached.ids);
            } else {
              const attendingEventsForUser = await getUserAttendingEvents(globalUser.$id);
              attendingIds = new Set(attendingEventsForUser.map((a: any) => a.$id));
              attendingCache.current.set(globalUser.$id || '', { ids: attendingIds, ts: Date.now() });
            }
          } catch (err) {
            console.warn('Feed: failed to load attending events for cached flow', err);
            attendingIds = new Set(); // Default to empty if fetch fails
          }

          // Filter out events the user is attending (Feed shows non-attending events)
          const nonAttendingEvents = relevantCached.filter(ev => !attendingIds.has(ev.$id));

          setBaseEventsWithCreatorNames(nonAttendingEvents);
          console.log('Feed: Showing cached feed with', nonAttendingEvents.length, 'items (filtered by attendance)');

          // Asynchronously populate creator names and a limited set of profile photos
          (async () => {
            try {
              const uniqueCreatorIds = [...new Set(nonAttendingEvents.map((ev: any) => ev.creatorId))] as string[];
              if (uniqueCreatorIds.length === 0) return;

              const creatorProfiles = await batchProcess(uniqueCreatorIds, async (batch: string[]) => await getUsersByIds(batch), 25);
              const creatorMap = new Map(creatorProfiles.flat().map((p: any) => [p.$id, userDisplayUtils.getFullName(p)]));

              const PHOTO_FETCH_LIMIT = 20;
              const creatorPhotoMap: Record<string, string | null> = {};
              const creatorIdsForPhotos = uniqueCreatorIds.slice(0, PHOTO_FETCH_LIMIT);
              await Promise.all(creatorIdsForPhotos.map(async (creatorId: string) => {
                try {
                  creatorPhotoMap[creatorId] = await getUserProfilePhotoUrl(creatorId);
                } catch {
                  creatorPhotoMap[creatorId] = null;
                }
              }));
              uniqueCreatorIds.forEach(id => { if (!Object.prototype.hasOwnProperty.call(creatorPhotoMap, id)) creatorPhotoMap[id] = null; });

              // Merge creator names into events and update state
              setBaseEventsWithCreatorNames((prev) => prev.map(ev => ({ ...(ev as any), creatorName: creatorMap.get(ev.creatorId) || 'Unknown Creator' })) as ExtendedEvent[]);
              setCreatorPhotoUrls(creatorPhotoMap);
            } catch (err) {
              console.warn('Feed: failed to populate creator info for cached feed', err);
            }
          })();
        } catch (err) {
          console.warn('Feed: failed to map cached feed', err);
        }

        // Kick off background revalidation (don't await). Guard so we don't run multiple times
        if (!backgroundRevalidating.current) {
          backgroundRevalidating.current = true;
          (async () => {
            try {
              console.log('Feed: Background revalidation of events started');
              const { getPublicEvents } = await import('@/lib/api/event');
              const freshAllEvents = await getPublicEvents(false, globalUser?.$id);

              // Store all events for top picks (not just friend/group events)
              setAllEventsForTopPicks(freshAllEvents);

              const relevantFresh = freshAllEvents.filter((event: any) => userFriends.includes(event.creatorId) || (event.groupId && userGroupIds.includes(event.groupId)));

              const uniqueCreatorIds = [...new Set(relevantFresh.map((ev: any) => ev.creatorId))] as string[];
              const creatorProfiles = await batchProcess(uniqueCreatorIds, async (batch: string[]) => await getUsersByIds(batch), 25);
              const creatorMap = new Map(creatorProfiles.flat().map((profile: any) => [profile.$id, userDisplayUtils.getFullName(profile)]));

              // Limit profile photo fetches to a small number to avoid many DB reads
              const creatorPhotoMap: Record<string, string | null> = {};
              const PHOTO_FETCH_LIMIT = 20;
              const creatorIdsForPhotos = uniqueCreatorIds.slice(0, PHOTO_FETCH_LIMIT);
              await Promise.all(creatorIdsForPhotos.map(async (creatorId: string) => {
                try {
                  creatorPhotoMap[creatorId] = await getUserProfilePhotoUrl(creatorId);
                } catch {
                  creatorPhotoMap[creatorId] = null;
                }
              }));
              // Ensure remaining creators have explicit null to avoid undefined lookups
              uniqueCreatorIds.forEach(id => { if (!Object.prototype.hasOwnProperty.call(creatorPhotoMap, id)) creatorPhotoMap[id] = null; });
              setCreatorPhotoUrls(creatorPhotoMap);

              // Optimize attendance checks: fetch all attending event IDs once and use a Set for lookups
              // Fetch attending IDs with cache to avoid repeated DB reads
              let attendingIds = new Set<string>();
              try {
                const cached = attendingCache.current.get(globalUser.$id || '');
                if (cached && Date.now() - cached.ts < ATTENDING_CACHE_TTL) {
                  attendingIds = new Set(cached.ids);
                } else {
                  const attendingEventsForUser = await getUserAttendingEvents(globalUser.$id);
                  attendingIds = new Set(attendingEventsForUser.map((a: any) => a.$id));
                  attendingCache.current.set(globalUser.$id || '', { ids: attendingIds, ts: Date.now() });
                }
              } catch (err) {
                console.warn('Feed: failed to load attending events during revalidation', err);
              }

              // Batch fetch attendees for all relevant events to avoid per-event DB calls
              const eventIds = relevantFresh.map((ev: any) => ev.$id);
              const attendeesMap = await getEventAttendeesFor(eventIds as string[]);

              const filteredAndMappedEvents = await Promise.all(relevantFresh
                .filter((ev: any) => new Date(ev.endTime || ev.date) >= new Date())
                .map(async (event: any) => {
                  const isAttending = attendingIds.has(event.$id);
                  // Prefer junction table attendees when available, otherwise fallback to legacy in-document attendees
                  let attendeesList: string[] = [];
                  const junctionAttendees = Array.isArray(attendeesMap[event.$id]) ? attendeesMap[event.$id] : [];
                  if (junctionAttendees.length > 0) {
                    attendeesList = junctionAttendees;
                  } else {
                    // Do not treat legacy in-document attendees as primary source; use only as a guarded fallback
                    attendeesList = Array.isArray(event.attendees) ? event.attendees : [];
                  }
                  let attendeeCount: number | undefined = typeof event.attendeeCount === 'number' ? event.attendeeCount : (junctionAttendees.length > 0 ? junctionAttendees.length : (Array.isArray(event.attendees) ? event.attendees.length : undefined));
                  return {
                    ...(event as unknown as AppEvent),
                    creatorName: creatorMap.get(event.creatorId) || 'Unknown Creator',
                    isAttending,
                    attendees: attendeesList,
                    attendeeCount: attendeeCount ?? 0,
                  } as AppEvent & { isAttending?: boolean; attendeeCount?: number };
                }));

              const nonAttendingEvents = filteredAndMappedEvents.filter((e: any) => !e.isAttending);
              setBaseEventsWithCreatorNames(nonAttendingEvents as AppEvent[]);
              try {
                // Persist to EventContext's per-screen feed cache so Feed can restore from
                // its own session memory without relying on Home's list.
                setScreenEvents('feed', nonAttendingEvents as AppEvent[]);
                await cacheScreenData('feed', nonAttendingEvents);
                // Mark feed as loaded from DB for this session
                try { markScreenLoadedFromDb?.('feed', true); } catch { }
              } catch (err) {
                console.warn('Feed: failed to persist feed cache', err);
              }
              console.log('Feed: Background revalidation updated feed with', nonAttendingEvents.length, 'items');

              await dbConnectionPool.acquire(async () => {
                await fetchTravelAnnouncements(userFriends);
              });

              // Background revalidation complete - no need to refetch EventContext
              // since Feed manages its own state locally
            } catch (err) {
              console.error('Feed: Background revalidation error:', err);
            } finally {
              backgroundRevalidating.current = false;
            }
          })();
        }
        // Start loading friend profiles/photos asynchronously (non-blocking)
        (async () => {
          if (userFriends.length === 0) return;
          try {
            const friendProfilesBatches = await batchProcess(userFriends, async (batch: string[]) => await getUsersByIds(batch), 25);
            const flatFriendProfiles = friendProfilesBatches.flat();
            setFriendProfiles(flatFriendProfiles || []);

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
        })();

        // Done for cached flow - background revalidation will refresh context
        return;
      }

      // No cache: fetch synchronously and map
      const { getPublicEvents } = await import('@/lib/api/event');
      const allEvents = await getPublicEvents(false, globalUser?.$id);

      // Store all events for top picks (not just friend/group events)
      setAllEventsForTopPicks(allEvents);

      const relevantEvents = allEvents.filter((ev: any) => userFriends.includes(ev.creatorId) || (ev.groupId && userGroupIds.includes(ev.groupId)));

      const uniqueCreatorIdsSync = [...new Set(relevantEvents.map((ev: any) => ev.creatorId))] as string[];
      const creatorProfilesSync = await batchProcess(uniqueCreatorIdsSync, async (batch: string[]) => await getUsersByIds(batch), 25);
      const creatorMapSync = new Map(creatorProfilesSync.flat().map((p: any) => [p.$id, userDisplayUtils.getFullName(p)]));

      const creatorPhotoMapSync: Record<string, string | null> = {};
      const PHOTO_FETCH_LIMIT = 20;
      const creatorIdsForPhotosSync = uniqueCreatorIdsSync.slice(0, PHOTO_FETCH_LIMIT);
      await Promise.all(creatorIdsForPhotosSync.map(async (creatorId: string) => {
        try {
          creatorPhotoMapSync[creatorId] = await getUserProfilePhotoUrl(creatorId);
        } catch {
          creatorPhotoMapSync[creatorId] = null;
        }
      }));
      uniqueCreatorIdsSync.forEach(id => { if (!Object.prototype.hasOwnProperty.call(creatorPhotoMapSync, id)) creatorPhotoMapSync[id] = null; });
      setCreatorPhotoUrls(creatorPhotoMapSync);

      // Optimize attendance checks for synchronous fetch as well
      // Use cache for attending IDs in synchronous flow
      let attendingIdsSync = new Set<string>();
      try {
        const cached = attendingCache.current.get(globalUser.$id || '');
        if (cached && Date.now() - cached.ts < ATTENDING_CACHE_TTL) {
          attendingIdsSync = new Set(cached.ids);
        } else {
          const attendingEventsForUserSync = await getUserAttendingEvents(globalUser.$id);
          attendingIdsSync = new Set(attendingEventsForUserSync.map((a: any) => a.$id));
          attendingCache.current.set(globalUser.$id || '', { ids: attendingIdsSync, ts: Date.now() });
        }
      } catch (err) {
        console.warn('Feed: failed to load attending events for sync flow', err);
      }

      // Batch fetch attendees for relevant events
      const eventIdsSync = relevantEvents.map((ev: any) => ev.$id);
      const attendeesMapSync = await getEventAttendeesFor(eventIdsSync as string[]);

      const mappedEvents = await Promise.all(relevantEvents
        .filter((ev: any) => new Date(ev.endTime || ev.date) >= new Date())
        .map(async (event: any) => {
          const isAttending = attendingIdsSync.has(event.$id);
          // Prefer junction table attendees when available, otherwise fallback to legacy in-document attendees
          let attendeesList: string[] = [];
          const junctionAttendees = Array.isArray(attendeesMapSync[event.$id]) ? attendeesMapSync[event.$id] : [];
          if (junctionAttendees.length > 0) {
            attendeesList = junctionAttendees;
          } else {
            attendeesList = Array.isArray(event.attendees) ? event.attendees : [];
          }
          let attendeeCount: number | undefined = typeof event.attendeeCount === 'number' ? event.attendeeCount : (junctionAttendees.length > 0 ? junctionAttendees.length : (Array.isArray(event.attendees) ? event.attendees.length : undefined));
          return {
            ...(event as unknown as AppEvent),
            creatorName: creatorMapSync.get(event.creatorId) || 'Unknown Creator',
            isAttending,
            attendees: attendeesList,
            attendeeCount: attendeeCount ?? 0,
          } as AppEvent & { isAttending?: boolean; attendeeCount?: number };
        }));

      const nonAttendingEventsSync = mappedEvents.filter((e: any) => !e.isAttending);
      setBaseEventsWithCreatorNames(nonAttendingEventsSync as AppEvent[]);

      // Cache the processed data
      try {
        setScreenEvents('feed', nonAttendingEventsSync as AppEvent[]);
        await cacheScreenData('feed', nonAttendingEventsSync);
        try { markScreenLoadedFromDb?.('feed', true); } catch { }
      } catch (err) {
        console.warn('Feed: failed to persist feed cache (sync flow)', err);
      }

      await dbConnectionPool.acquire(async () => {
        await fetchTravelAnnouncements(userFriends);
      });

      // Feed manages its own state - no need to refetch global EventContext
    } catch (error) {
      console.error('Error refreshing feed:', error);
    } finally {
      setRefreshing(false);
      isInitialMount.current = false;
    }
  }, [globalUser?.$id, getScreenEvents, setScreenEvents, markScreenLoadedFromDb]);

  // Initial load - happens once per session for scalability
  useEffect(() => {
    if (initialLoadComplete) return;

    // If EventContext already performed the initial load for the session,
    // populate Feed's local view from the cached events instead of making DB reads.
    // Prefer Feed-scoped session cache (separate from Home/Explore) so each screen
    // can present its own curated list without clobbering others.
    const feedCache = getScreenEvents('feed');
    if (Array.isArray(feedCache) && feedCache.length > 0) {
      try {
        const now = new Date();
        const mapped = (feedCache as AppEvent[])
          .filter(e => {
            const end = (e as any).endTime || (e as any).date || (e as any).startTime;
            return new Date(end) >= now;
          })
          .map(e => ({
            ...(e as AppEvent),
            creatorName: (e as any).creatorName || undefined,
            isAttending: (e as any).isAttending ?? false,
            attendeeCount: typeof (e as any).attendeeCount === 'number' ? (e as any).attendeeCount : (Array.isArray((e as any).attendees) ? (e as any).attendees.length : 0),
          } as ExtendedEvent));

        setBaseEventsWithCreatorNames(mapped);
      } catch (err) {
        console.warn('Feed: failed to map feed-scoped cached events', err);
      }

      setInitialLoadComplete(true);
      return;
    }

    // No feed-scoped cache available: always load Feed's own data on first mount.
    const init = async () => {
      await fetchFeedData();
      // fetchFeedData performs background revalidation and will persist to the feed cache
      setInitialLoadComplete(true);
    };
    init();
  }, [initialLoadComplete, hasInitialLoad, events]);

  // Check for cache invalidation when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!initialLoadComplete) return; // Don't interfere with initial load

      const checkCacheInvalidation = async () => {
        try {
          const strategy = await shouldFetchData('feed', false);
          if (strategy.shouldFetch) {
            console.log(`Feed: Cache invalidated (${strategy.reason}), refreshing data`);
            // Trigger data refresh by incrementing refreshTrigger
            setRefreshTrigger(prev => prev + 1);
          }
        } catch (error) {
          console.error('Feed: Error checking cache invalidation:', error);
        }
      };

      checkCacheInvalidation();
    }, [initialLoadComplete])
  );

  // Handle cache invalidation refresh triggers
  useEffect(() => {
    if (refreshTrigger > 0 && initialLoadComplete) {
      console.log('Feed: Refreshing due to cache invalidation trigger');
      // Use a direct fetch to avoid dependency loops
      (async () => {
        try {
          await fetchFeedData(true);
        } catch (error) {
          console.error('Feed: Error during cache invalidation refresh:', error);
        }
      })();
    }
  }, [refreshTrigger, initialLoadComplete]);

  const fetchTravelAnnouncements = async (friendIds: string[]) => {
    try {
      console.log('🧳 Feed: Starting fetchTravelAnnouncements with friends:', friendIds.length);

      // SCALABILITY FIX: Use the now-optimized getFriendsTravelAnnouncements with limits
      // Include current user's travel announcements as well
      const travelData = await getFriendsTravelAnnouncements(friendIds, 30); // Limit to 30 travel announcements
      console.log('🧳 Feed: Raw travel data received:', travelData.length, 'announcements');

      if (travelData.length === 0) {
        console.log('🧳 Feed: No travel data from API - this could indicate collection is empty');
        setTravelAnnouncements([]);
        return;
      }

      // Log some sample data to see what we got
      console.log('🧳 Feed: Sample travel data:', {
        count: travelData.length,
        destinations: travelData.slice(0, 3).map(t => ({ dest: t.destination, user: t.userId, dates: `${t.startDate} to ${t.endDate}` }))
      });

      // Filter for upcoming/current travel only (not past travel)
      const now = new Date();
      const upcomingTravelData = travelData.filter(travel => new Date(travel.endDate) > now);
      console.log('🧳 Feed: After filtering for upcoming/current travel:', upcomingTravelData.length, 'remaining');

      if (upcomingTravelData.length === 0) {
        console.log('🧳 Feed: No upcoming travel - all announcements are in the past');
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

  // Friend bubbles bar (horizontal scroll) - friends with new events ordered first
  const renderFriendBubble = (friend: any) => (
    <View key={friend.$id} style={styles.friendBubble}>
      <UserAvatar photoUrl={friendPhotoUrls[friend.$id] || null} name={userDisplayUtils.getFullName(friend)} size={48} />
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
