import { Background } from '@/components/Background';
import { getEventColor, getEventEmoji } from '@/constants/categories';
import { enrichEventsWithGroupNames, getEventInvitees, getUserAttendingEvents } from '@/lib/api/event';
import { getUserGroupInvites } from '@/lib/api/group';
// Removed static import of getActiveTravelForUser - using dynamic import instead
import { useAppwrite } from '@/lib/appwrite/useAppwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { authDebug } from '@/lib/debug/authDebug';
import { useGlobalContext } from '@/lib/global-provider';
import { useEventAttendeeCount } from '@/lib/hooks/useEventAttendeeCount';
import { useActionTracker } from '@/lib/hooks/useOptimizedData';
import { useRealTimeUI } from '@/lib/hooks/useRealTimeUI';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Event as AppEvent } from '@/lib/types/Events';
import { TravelAnnouncement } from '@/lib/types/Travel';
import { isUserAttendingHeuristic } from '@/lib/utils/attendance';
import { processCalendarEvents } from '@/lib/utils/calendarHelpers';
import { useCreatorInfo } from '@/lib/utils/creatorInfoManager';
import { cacheScreenData, shouldFetchData } from '@/lib/utils/dataFetchingOptimizer';
import { createEventAttendanceHandlers } from '@/lib/utils/eventHandlers';
import {
  filterEventsByCreator,
  filterUpcomingEvents,
  formatDateHeader,
  groupEventsByDay,
  mergeEventsWithRealTimeFiltering,
  transformGroupedEventsForList
} from '@/lib/utils/homeHelpers';
import { realTimeUI } from '@/lib/utils/realTimeUI';
import { MaterialIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EventDetailsModal from '../components/EventDetailsModal';
import EventForm from '../components/EventForm';
import MessageModal from '../components/MessageModal';
import UserAvatar from '../components/UserAvatar';
import { EventsContext } from '../context/EventContext';

// Define available calendar view modes
const viewModes: Mode[] = ['week', 'month'];

type TabType = 'calendar' | 'agenda';

// Helper function to open location in maps
const openInMaps = (location: string) => {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  Linking.openURL(url);
};

export default function Home() {
  const { colors, isColorful } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Safely access the context values
  const eventsContext = React.useContext(EventsContext);
  const getScreenEvents = eventsContext?.getScreenEvents;
  const setScreenEvents = eventsContext?.setScreenEvents;
  const getScreenLoadedFromDb = eventsContext?.getScreenLoadedFromDb;
  const markScreenLoadedFromDb = eventsContext?.markScreenLoadedFromDb;

  // Memoize derived values from context to prevent unnecessary updates
  // Use optional chaining to handle undefined context gracefully
  const events = React.useMemo(() => {
    return eventsContext?.events || [];
  }, [eventsContext?.events]);

  const eventsLoading = React.useMemo(() => {
    return eventsContext?.loading || false;
  }, [eventsContext?.loading]);

  // Create a stable refetch function
  const refetchEvents = React.useCallback(async () => {
    if (eventsContext?.refetchEvents) {
      try {
        return await eventsContext.refetchEvents();
      } catch (error) {
        console.error("Error refetching events:", error);
        return Promise.resolve();
      }
    } else {
      // Don't log a warning on every render if context isn't available
      return Promise.resolve();
    }
  }, [eventsContext]);

  // Create a smart refetch function that only fetches when necessary
  const smartRefetchEvents = useCallback(async (reason: 'navigation' | 'viewModeChange' | 'manual' = 'manual') => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    const minFetchInterval = 30 * 1000; // Minimum 30 seconds between automatic fetches

    // For manual triggers (like creating/editing events), always fetch
    if (reason === 'manual') {
      authDebug.debug('Manual refetch triggered');
      lastFetchTime.current = now;
      return await refetchEvents();
    }

    // For navigation and view mode changes, respect minimum interval unless it's the first load
    if (!hasInitialLoad.current || timeSinceLastFetch > minFetchInterval) {
      authDebug.debug(`Smart refetch triggered: ${reason}, time since last: ${timeSinceLastFetch}ms`);
      lastFetchTime.current = now;
      hasInitialLoad.current = true;
      return await refetchEvents();
    } else {
      authDebug.debug(`Skipping refetch (${reason}): too soon since last fetch (${timeSinceLastFetch}ms)`);
    }
  }, [refetchEvents]);

  // State management
  const [formVisible, setFormVisible] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [viewMode, setViewMode] = useState<Mode>('month');
  const [date, setDate] = useState(() => new Date()); // Use function to initialize once
  const [displayedMonth, setDisplayedMonth] = useState(() => new Date()); // Track the month being displayed separately
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
  const [startHour] = useState(() => new Date().getHours() - 4); // Initialize once, no setter
  const [endHour] = useState(() => new Date().getHours() + 4); // Initialize once, no setter
  const [calendarHeight, setCalendarHeight] = useState(0);
  const [userTravelData, setUserTravelData] = useState<TravelAnnouncement[]>([]);
  const [groupInvites, setGroupInvites] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('agenda');
  const [enrichedEvents, setEnrichedEvents] = useState<AppEvent[]>([]);
  const [agendaEvents, setAgendaEvents] = useState<AppEvent[]>([]);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userAttendingEvents, setUserAttendingEvents] = useState<AppEvent[]>([]);

  // Get unique creator IDs from events
  const creatorIds = useMemo(() => {
    if (!events || events.length === 0) return [];
    const ids = events
      .map((event: AppEvent) => event.creatorId)
      .filter(Boolean);
    return [...new Set(ids)] as string[];
  }, [events]);

  // Use unified creator info management
  const { getCreatorName, getCreatorPhotoUrl, creatorNames, creatorPhotos, isLoading: creatorInfoLoading } = useCreatorInfo(creatorIds, 20);

  // Get accurate attendee counts with junction table fallback
  const { getAttendeeCount } = useEventAttendeeCount(agendaEvents, true);

  // Re-render on real-time UI actions
  const rtTick = useRealTimeUI();
  // When real-time UI changes happen, reconcile the visible list
  useEffect(() => {
    if (!Array.isArray(userAttendingEvents)) return;
    const pendingUnattend = new Set(realTimeUI.getEventIdsByAction('unattend'));
    const pendingAttend = new Set(realTimeUI.getEventIdsByAction('attend'));

    try {
      const { events: globalEvents } = require('../context/EventContext');
      const next = mergeEventsWithRealTimeFiltering(
        userAttendingEvents,
        pendingUnattend,
        pendingAttend,
        globalEvents || []
      );

      setEnrichedEvents(next);

      // Also update agendaEvents to show only upcoming events from the reactive list
      const upcomingEvents = filterUpcomingEvents(next);
      setAgendaEvents(upcomingEvents);
    } catch {
      // Fallback to simple filtering if context import fails
      const next = userAttendingEvents.filter(e => !pendingUnattend.has(e.$id));
      setEnrichedEvents(next);
      setAgendaEvents(filterUpcomingEvents(next));
    }
  }, [rtTick, userAttendingEvents]);

  // Track when data was last fetched to prevent unnecessary refetches
  const lastFetchTime = useRef<number>(0);
  const previousViewMode = useRef<Mode>(viewMode);
  const hasInitialLoad = useRef<boolean>(false);
  const isInitialMount = useRef<boolean>(true);
  const userAttendingFromJunction = useRef<boolean>(false);

  // Action tracker for optimized caching
  const recordAction = useActionTracker();

  // Get route params (for user calendar view)
  const params = useLocalSearchParams();

  // Get user from global context (already handles authentication and caching)
  const { user: globalUser } = useGlobalContext();
  const currentUser = globalUser; // Use the already-authenticated user from global context

  // Use profile data from global context (already includes profile)
  const userProfile = currentUser?.profile;

  // Fetch user's travel data for calendar highlighting
  const { data: travelData } = useAppwrite({
    fn: async () => {
      if (!currentUser?.$id) return [];

      console.log('Home: Starting travel data fetch for user:', currentUser.$id);

      // Use dynamic import from index.ts with detailed debugging
      try {
        const apiModule = await import('@/lib/api');
        console.log('Home: Successfully imported API module');
        console.log('Home: Available exports from API module:', Object.keys(apiModule));
        console.log('Home: getActiveTravelForUser type:', typeof apiModule.getActiveTravelForUser);
        console.log('Home: All function types:', Object.entries(apiModule).map(([key, value]) => `${key}: ${typeof value}`));

        const { getActiveTravelForUser } = apiModule;

        if (typeof getActiveTravelForUser !== 'function') {
          throw new Error('getActiveTravelForUser is not a function after dynamic import');
        }

        const result = await getActiveTravelForUser(currentUser.$id);
        console.log('Home: Successfully fetched travel data, count:', result?.length || 0);
        return result;
      } catch (err) {
        console.error('Home: Error fetching travel data:', err);
        // Return empty array instead of throwing to prevent UI crashes
        return [];
      }
    },
    cacheKey: currentUser?.$id ? `user-travel-${currentUser.$id}` : undefined,
    dependencies: [currentUser?.$id],
    skip: !currentUser?.$id,
  });

  // Set currentUserId when currentUser changes
  useEffect(() => {
    setCurrentUserId(currentUser?.$id || null);
  }, [currentUser]);

  // Update userTravelData when travelData changes
  useEffect(() => {
    if (travelData) {
      setUserTravelData(travelData);
    }
  }, [travelData]);

  // Sync displayedMonth with date changes (for better month display tracking)
  useEffect(() => {
    setDisplayedMonth(date);
  }, [date]);

  // Get unique creator IDs from events
  // Filter events for the current user using optimized data fetching
  const fetchUserAttendingEvents = useCallback(async () => {
    if (!currentUser?.$id) {
      setUserAttendingEvents([]);
      return;
    }

    // Check if we should fetch from database or use cache
    const strategy = await shouldFetchData('home', isInitialMount.current);
    authDebug.debug(`Home: fetchUserAttendingEvents strategy - ${strategy.cacheStrategy} (${strategy.reason})`);

    if (strategy.shouldFetch) {
      try {
        // Fetch fresh data from database
        authDebug.debug('Home: Fetching user attending events from database');
        userAttendingFromJunction.current = false;
        const attendingEvents = await getUserAttendingEvents(currentUser.$id);
        userAttendingFromJunction.current = true;

        // Also include events user created
        const createdEvents = filterEventsByCreator(events, currentUser.$id);

        // Merge and deduplicate by $id
        const allUserEvents = [...attendingEvents];
        createdEvents.forEach(createdEvent => {
          if (!attendingEvents.some(attending => attending.$id === createdEvent.$id)) {
            allUserEvents.push(createdEvent);
          }
        });

        // Initialize real-time UI system with base attendance data
        const attendingEventIds = attendingEvents.map(e => e.$id);

        setUserAttendingEvents(allUserEvents);

        // Cache the data for next time
        await cacheScreenData('home', allUserEvents);

        // Mark as loaded from DB
        if (markScreenLoadedFromDb) {
          markScreenLoadedFromDb('home', true);
        }

        authDebug.debug(`Home: Loaded ${allUserEvents.length} user events from database`);
      } catch (error) {
        authDebug.error('Error fetching user attending events for calendar:', error);
        // Fallback to events user created (better than nothing)
        const fallbackEvents = filterEventsByCreator(events, currentUser.$id);
        setUserAttendingEvents(fallbackEvents);
      }
    } else {
      // Use cached data
      try {
        if (strategy.cacheStrategy === 'memory' && getScreenEvents) {
          const cachedEvents = getScreenEvents('home') || [];
          const userId = currentUser.$id;
          // Include both events user is attending AND events user created
          const homeEvents = cachedEvents.filter(ev =>
            isUserAttendingHeuristic(ev, userId) || ev.creatorId === userId
          );

          setUserAttendingEvents(homeEvents);
          authDebug.debug(`Home: Loaded ${homeEvents.length} user events from ${strategy.cacheStrategy} cache`);
        } else {
          // Fallback to current logic for storage cache
          const loadedFlag = getScreenLoadedFromDb ? getScreenLoadedFromDb('home') : false;
          const cacheTs = (eventsContext && (eventsContext as any).getScreenCacheTimestamp) ? (eventsContext as any).getScreenCacheTimestamp('home') : 0;
          const lastFetched = (eventsContext && (eventsContext as any).getLastFetchedAt) ? (eventsContext as any).getLastFetchedAt() : 0;
          const homeCache = (loadedFlag && getScreenEvents) ? getScreenEvents('home') : undefined;

          if (loadedFlag && cacheTs >= lastFetched && Array.isArray(homeCache) && homeCache.length > 0) {
            const userId = currentUser.$id;
            // Include both events user is attending AND events user created
            const attendedFromCache = (homeCache as AppEvent[]).filter(ev =>
              isUserAttendingHeuristic(ev, userId) || ev.creatorId === userId
            );

            const map = new Map<string, AppEvent>();
            attendedFromCache.forEach(ev => { if (ev && ev.$id) map.set(ev.$id, ev); });
            const merged = Array.from(map.values());
            setUserAttendingEvents(merged);
            authDebug.debug(`Home: Loaded ${merged.length} user events from storage cache`);
          }
        }
      } catch (error) {
        authDebug.debug('Home: Failed to load cached events, falling back to created events', error);
        // Fallback to events user created (better than nothing)
        setUserAttendingEvents(filterEventsByCreator(events, currentUser.$id));
      }
    }

    isInitialMount.current = false;
  }, [currentUser, events, getScreenEvents, markScreenLoadedFromDb, eventsContext]);

  // Execute the fetch function when dependencies change
  useEffect(() => {
    fetchUserAttendingEvents();
  }, [fetchUserAttendingEvents]);

  // Check for pending invites (both event and group invites)
  const [hasInvites, setHasInvites] = useState<boolean>(false);
  useEffect(() => {
    let mounted = true;
    const computeInvites = async () => {
      if (!currentUser?.$id) {
        if (mounted) setHasInvites(false);
        return;
      }

      // Prefer to compute invites from home-scoped cache when present to avoid DB calls on remount
      try {
        const cacheTs = (eventsContext && (eventsContext as any).getScreenCacheTimestamp) ? (eventsContext as any).getScreenCacheTimestamp('home') : 0;
        const lastFetched = (eventsContext && (eventsContext as any).getLastFetchedAt) ? (eventsContext as any).getLastFetchedAt() : 0;
        const homeCache = getScreenEvents ? getScreenEvents('home') : undefined;
        authDebug.debug('Home: computeInvites - cache check', { userId: currentUser?.$id, cacheTs, lastFetched, homeCacheCount: Array.isArray(homeCache) ? homeCache.length : 0 });
        if (cacheTs >= lastFetched && Array.isArray(homeCache) && homeCache.length > 0) {
          const hasEventInvites = (homeCache as AppEvent[]).some(event => {
            if (event.creatorId === currentUser.$id) return false;
            if (typeof (event as any).inviteCount === 'number' && (event as any).inviteCount === 0) return false;
            // Use centralized heuristic as a lightweight hint based on legacy fields
            return isUserAttendingHeuristic(event, currentUser.$id);
          });
          if (mounted) setHasInvites(hasEventInvites || groupInvites.length > 0);
          return;
        }
      } catch (err) {
        console.warn('Home: failed to compute invites from cache', err);
      }

      let hasEventInvites = false;
      try {
        for (const event of events) {
          if (event.creatorId === currentUser.$id) continue;
          if (typeof event.inviteCount === 'number' && event.inviteCount === 0) continue;
          try {
            const invitees = await getEventInvitees(event.$id);
            if (Array.isArray(invitees) && invitees.includes(currentUser.$id)) {
              hasEventInvites = true;
              break;
            }
          } catch (err) {
            // ignore and continue
          }
        }
      } catch (err) {
        console.warn('Home: failed to compute event invites via junctions', err);
        hasEventInvites = false;
      }

      const hasGroupInvites = groupInvites.length > 0;
      if (mounted) setHasInvites(hasEventInvites || hasGroupInvites);
    };

    computeInvites();
    return () => { mounted = false; };
  }, [events, currentUser, groupInvites]);

  // Fetch group invites
  useEffect(() => {
    const fetchGroupInvites = async () => {
      if (!currentUser?.$id) return;

      try {
        const invites = await getUserGroupInvites(currentUser.$id);
        setGroupInvites(Array.isArray(invites) ? invites : []);
      } catch (error) {
        console.error('Error fetching group invites:', error);
        setGroupInvites([]);
      }
    };

    fetchGroupInvites();
  }, [currentUser]);

  // Diagnostic: log whenever agendaEvents changes so we can trace UI updates
  useEffect(() => {
    try {
      authDebug.debug('Home: agendaEvents changed', { count: agendaEvents.length, ids: agendaEvents.map(e => e.$id).slice(0, 10) });
    } catch (err) {
      /* ignore */
    }
  }, [agendaEvents]);

  // Enrich events with group names AND set agenda events
  useEffect(() => {
    const enrichEvents = async () => {
      if (!currentUser?.$id) {
        setAgendaEvents([]);
        setEnrichedEvents([]);
        return;
      }

      if (userAttendingEvents && userAttendingEvents.length > 0) {
        try {
          const enrichedNew = await enrichEventsWithGroupNames(userAttendingEvents);
          authDebug.debug('Home: enriched userAttendingEvents', { count: Array.isArray(enrichedNew) ? enrichedNew.length : 0, ids: Array.isArray(enrichedNew) ? enrichedNew.map((e: any) => e.$id).slice(0, 10) : [] });

          // Merge with any existing enriched events (read from the up-to-date home screen cache)
          let merged: any[] = [];
          try {
            const existing = (getScreenEvents ? getScreenEvents('home') : (Array.isArray(enrichedEvents) ? enrichedEvents : [])) || [];
            const map = new Map<string, any>();

            // Prefer the freshly enriched attending events
            (enrichedNew as any[]).forEach(ev => { if (ev && ev.$id) map.set(ev.$id, ev); });
            // Add existing events that are not already present
            existing.forEach(ev => { if (ev && ev.$id && !map.has(ev.$id)) map.set(ev.$id, ev); });

            merged = Array.from(map.values());

            // Apply real-time UI filtering to respect pending actions
            const pendingUnattend = new Set(realTimeUI.getEventIdsByAction('unattend'));
            const pendingAttend = new Set(realTimeUI.getEventIdsByAction('attend'));

            // Use utility function to merge events with real-time filtering
            try {
              const { events: globalEvents } = require('../context/EventContext');
              merged = mergeEventsWithRealTimeFiltering(merged, pendingUnattend, pendingAttend, globalEvents || []);
            } catch {
              // Fallback to simple filtering if context import fails
              merged = merged.filter(event => !pendingUnattend.has(event.$id));
            }

            authDebug.debug('Home: merged enriched events', { mergedCount: merged.length, mergedIds: merged.map((e: any) => e.$id).slice(0, 10) });

            // Set enriched events for calendar (all events)
            setEnrichedEvents(merged);

            // Set agenda events (upcoming only) from the merged events
            const upcomingEvents = filterUpcomingEvents(merged);
            setAgendaEvents(upcomingEvents);

            authDebug.debug('Home: set agenda and enriched events', {
              agendaCount: upcomingEvents.length,
              totalCount: merged.length,
              agendaIds: upcomingEvents.map((e: any) => e.$id).slice(0, 10)
            });

            try {
              // Only persist merged enriched events to the home cache if they are authoritative
              if (userAttendingFromJunction.current) {
                setScreenEvents?.('home', merged);
                markScreenLoadedFromDb?.('home', true);
                authDebug.debug('Home: persisted merged enriched events to home cache', { count: merged.length });
              } else {
                authDebug.debug('Home: skipping persist of merged enriched events because not authoritative (junction data missing)');
              }
            } catch (err) {
              authDebug.debug('Home: failed to persist home cache', err);
            }
          } catch (err) {
            // Fallback to using newly enriched events if merge fails
            setEnrichedEvents(enrichedNew);

            // Also set agenda events from enrichedNew
            const upcomingEvents = filterUpcomingEvents(enrichedNew);
            setAgendaEvents(upcomingEvents);

            try {
              if (userAttendingFromJunction.current) {
                setScreenEvents?.('home', enrichedNew);
                markScreenLoadedFromDb?.('home', true);
              }
            } catch (e) {
              authDebug.debug('Home: failed to persist fallback cache', e);
            }
          }
        } catch (error) {
          authDebug.error('Failed to enrich events with group names:', error);
          setEnrichedEvents(userAttendingEvents); // Fallback to original events

          // Also set agenda from fallback using utility function
          const upcomingEvents = filterUpcomingEvents(userAttendingEvents);
          setAgendaEvents(upcomingEvents);
        }
      } else {
        setEnrichedEvents([]);
        setAgendaEvents([]);
      }
    };

    enrichEvents();
  }, [userAttendingEvents, currentUser]);

  // Format events for the calendar with date validation using utility function
  const calendarEvents = useMemo(() => {
    if (!enrichedEvents || !Array.isArray(enrichedEvents)) {
      return [];
    }

    authDebug.debug('Home: mapping enrichedEvents for calendar', {
      count: enrichedEvents.length,
      ids: enrichedEvents.map((e: any) => e.$id).slice(0, 10)
    });

    // Process events and ensure colors are assigned based on tags
    const processedEvents = processCalendarEvents(enrichedEvents, getCreatorName, userTravelData || []);

    // Ensure each event has a color based on its tags
    return processedEvents.map((event: any) => ({
      ...event,
      color: event.color || getEventColor(event.rawEvent?.tags || [])
    }));
  }, [enrichedEvents, getCreatorName, userTravelData]);

  // Memoize event handlers (declare before renderEvent to avoid dependency issues)
  // Event press handler using utility function with travel support
  const handlePressEvent = useMemo(() => {
    return (event: any) => {
      try {
        if (!event) {
          console.warn('handlePressEvent: event is null or undefined');
          return;
        }

        // Check if this is a travel event
        if (event.isTravel && event.rawTravel) {
          // Show travel details in an alert
          Alert.alert(
            `✈️ Travel: ${event.rawTravel.destination}`,
            `📅 ${dayjs(event.rawTravel.startDate).format('MMM D')} - ${dayjs(event.rawTravel.endDate).format('MMM D, YYYY')}\n${event.rawTravel.description ? `\n📝 ${event.rawTravel.description}` : ''}`,
            [
              { text: 'Close', style: 'cancel' },
              { text: 'View on Map', onPress: () => openInMaps(event.rawTravel.destination) }
            ]
          );
          return;
        }

        // Handle regular events
        if (!event.rawEvent) {
          console.warn('handlePressEvent: event.rawEvent is null or undefined');
          return;
        }

        // Validate that the raw event has required properties
        if (!event.rawEvent.$id) {
          console.warn('handlePressEvent: event.rawEvent.$id is missing');
          return;
        }

        setSelectedEvent(event.rawEvent as AppEvent);
        setDetailsModalVisible(true);
      } catch (error) {
        console.error('Error in handlePressEvent:', error);
        // Don't crash the app, just log the error
      }
    };
  }, []);

  // Custom render function for events with comprehensive error handling
  const renderEvent = useCallback((event: any, touchableOpacityProps: any) => {
    try {
      // Safety checks to prevent rendering invalid events
      if (!event) {
        console.warn('renderEvent: event is null or undefined');
        return null;
      }

      if (!event.rawEvent) {
        console.warn('renderEvent: event.rawEvent is null or undefined');
        return null;
      }

      // Validate essential event properties
      if (!event.rawEvent.title) {
        console.warn('renderEvent: event.rawEvent.title is missing');
        return null;
      }

      const isMonthView = viewMode === 'month';
      const eventColor = event.color || '#000000';

      // Convert hex color to rgba for opacity in month view
      const hexToRgba = (hex: string, alpha: number) => {
        try {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } catch (error) {
          console.warn('Error converting hex to rgba:', error);
          return hex; // Return original hex if conversion fails
        }
      };

      const backgroundColor = isMonthView
        ? hexToRgba(eventColor, 0.7) // Increased opacity for better visibility
        : eventColor; // Full opacity for week/day view

      return (
        <TouchableOpacity
          {...touchableOpacityProps}
          style={[
            // Only apply custom positioning for month view, preserve original positioning for week/day
            ...(isMonthView ? [] : [touchableOpacityProps.style]),
            {
              backgroundColor,
              padding: 0, // Remove all padding to eliminate spacing
              borderRadius: isMonthView ? 1 : 4, // Minimal border radius for month view
              margin: 0,
              marginVertical: 0, // Ensure no vertical margin
              marginHorizontal: 0, // Ensure no horizontal margin
              flex: 0,
              // For month view ONLY, completely override positioning to eliminate gaps
              ...(isMonthView && {
                position: 'absolute',
                bottom: 0, // Stick to bottom
                left: 0, // Full width
                right: 0, // Full width
                height: 14, // Slightly increased height for better readability
                minHeight: 14,
                maxHeight: 14,
                // Calculate top position based on event index to stack tightly
                top: touchableOpacityProps.style?.top || 24,
                // Override any spacing from the library
                transform: [{ translateY: -2 }], // Move up slightly to eliminate gaps
              }),
            }
          ]}
          onPress={() => handlePressEvent(event)}
          key={event.rawEvent.$id || `event-${Math.random()}`} // Ensure unique key
        >
          <Text
            className={`font-rubik-medium`}
            numberOfLines={1}
            style={{
              textAlign: 'center',
              fontSize: isMonthView ? 10 : 12, // Slightly increased from 9 to 10 for better readability
              color: isMonthView ? colors.background : colors.background, // Use background color (white in dark mode)
              margin: 0, // Remove all margins
              padding: isMonthView ? 1 : 0, // Minimal padding for month view text
              lineHeight: isMonthView ? 10 : 12, // Match font size for tight fit
            }}
          >
            {event.title || 'Untitled'}
          </Text>
          {!isMonthView && (
            <>
              <Text
                className="text-white text-xs"
                style={{
                  textAlign: 'center',
                  marginTop: -2, // Reduce space above location text
                }}
              >
                {event.location || 'No location'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      );
    } catch (error) {
      console.error('Error in renderEvent:', error);
      // Return a fallback UI instead of crashing
      return (
        <TouchableOpacity
          style={[
            touchableOpacityProps.style,
            {
              backgroundColor: colors.error,
              borderRadius: 4,
              padding: 4,
              marginVertical: 1,
              minHeight: 24,
            }
          ]}
        >
          <Text
            style={{
              color: 'white',
              fontSize: 10,
              textAlign: 'center',
            }}
          >
            Error loading event
          </Text>
        </TouchableOpacity>
      );
    }
  }, [viewMode, '#000000', colors.background, colors.error, handlePressEvent]);

  // Handler for pressing a calendar cell (to create a new event)
  const handleCellPress = useCallback((date: Date) => {
    setSelectedDateTime(date.toISOString());
    setEditingEvent(null); // Clear any existing event to create a new one
    setFormVisible(true);
  }, []);

  // Track the currently visible month more aggressively
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());

  // Simple and clean approach - track date changes and update display accordingly
  const handleDateChange = useCallback((range: any) => {
    console.log('handleDateChange called with:', range, typeof range);

    let newDate: Date;

    if (Array.isArray(range) && range.length >= 2) {
      newDate = new Date(range[0]);
      console.log('Array range detected, using first date:', newDate);
    } else if (range && typeof range === 'object') {
      if (range.start) {
        newDate = new Date(range.start);
      } else {
        newDate = new Date(range);
      }
    } else {
      newDate = new Date(range);
    }

    console.log('Setting new date:', newDate);
    setDate(newDate);
  }, []);

  // Update displayed month whenever date changes (works for both month and week view)
  useEffect(() => {
    const monthToDisplay = new Date(date.getFullYear(), date.getMonth(), 1);
    setDisplayedMonth(monthToDisplay);
    console.log('🔄 Date changed, updated displayed month to:', monthToDisplay.toDateString());
    console.log('📅 Date state:', date.toDateString());
    console.log('🗓️ DisplayedMonth state:', displayedMonth.toDateString());
    console.log('👁️ Current view mode:', viewMode);
  }, [date]);

  // Simple polling approach - check every second if the calendar has been swiped
  // This works for both month and week views since BigCalendar doesn't properly call onChangeDate for swipes
  useEffect(() => {
    if (viewMode !== 'month' && viewMode !== 'week') return;

    const checkCalendarState = () => {
      try {
        // Force update display based on current date state
        const currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        if (currentMonth.getTime() !== displayedMonth.getTime()) {
          console.log('🔄 Forcing month display sync from polling for', viewMode, 'view');
          setDisplayedMonth(currentMonth);
        }
      } catch (error) {
        console.log('Calendar state check failed:', error);
      }
    };

    const interval = setInterval(checkCalendarState, 1000); // Check every second
    return () => clearInterval(interval);
  }, [viewMode, date, displayedMonth]);

  // Handler for editing event
  const handleEditEvent = useCallback((event: AppEvent) => {
    setEditingEvent(event);
    setDetailsModalVisible(false);
    setFormVisible(true);
  }, []);  // Memoize button handlers
  const handleTodayPress = useCallback(() => {
    const today = new Date();
    setDate(today);
    setDisplayedMonth(new Date(today)); // Also update the displayed month
  }, []);

  const handleCreateEventPress = useCallback(() => {
    setSelectedDateTime(new Date().toISOString());
    setEditingEvent(null);
    setFormVisible(true);
  }, []);

  const handleFormClose = useCallback(async (eventWasModified?: boolean) => {
    setFormVisible(false);
    // If an event was created or updated, record the action and refresh
    if (eventWasModified && eventsContext) {
      // The specific action (create/update) would ideally be passed from EventForm
      // For now, we'll use a generic action that covers both
      await recordAction(editingEvent ? 'update' : 'create', 'home_event_modified');
      smartRefetchEvents('manual');
    }
  }, [eventsContext, smartRefetchEvents, recordAction, editingEvent]);

  const handleDetailsModalClose = useCallback(() => {
    setDetailsModalVisible(false);
  }, []);

  // Event attendance handlers using utility functions
  const { handleEventAttend, handleEventNotAttend } = useMemo(() =>
    createEventAttendanceHandlers(
      currentUser,
      selectedEvent,
      userAttendingEvents,
      setUserAttendingEvents,
      (action: string, reason: string) => recordAction(action as any, reason)
    ),
    [currentUser, selectedEvent, userAttendingEvents, recordAction]
  );

  // Update handlers to also close modal
  const wrappedHandleEventAttend = useCallback(async () => {
    await handleEventAttend();
    setDetailsModalVisible(false);
  }, [handleEventAttend]);

  const wrappedHandleEventNotAttend = useCallback(async () => {
    await handleEventNotAttend();
    setDetailsModalVisible(false);
  }, [handleEventNotAttend]);

  const handleEventChat = useCallback((event: AppEvent) => {
    setSelectedEvent(event);
    setDetailsModalVisible(false);
    setMessageModalVisible(true);
  }, []);

  // React to screen focus (navigation) - only fetch when navigating to this screen
  useFocusEffect(
    useCallback(() => {
      // On first focus, if Home hasn't loaded from DB this session, fetch DB and populate home cache.
      try {
        const loaded = getScreenLoadedFromDb?.('home');
        if (!loaded) {
          authDebug.debug('Home: initial mount - performing DB fetch to populate home cache');
          // Use smartRefetchEvents to respect rate-limits and existing logic; treat as manual
          smartRefetchEvents('manual');
          // We'll mark loaded when we persist the cache after enrichment
          return;
        }

        // Otherwise attempt to restore from home cache if it's fresh compared to last fetched DB time
        const cacheTs = (eventsContext && (eventsContext as any).getScreenCacheTimestamp) ? (eventsContext as any).getScreenCacheTimestamp('home') : 0;
        const lastFetched = (eventsContext && (eventsContext as any).getLastFetchedAt) ? (eventsContext as any).getLastFetchedAt() : 0;
        const homeCache = getScreenEvents ? getScreenEvents('home') : undefined;
        if (cacheTs >= lastFetched && Array.isArray(homeCache) && homeCache.length > 0) {
          // Don't set enrichedEvents directly here - let the enrichEvents useEffect handle it
          // setEnrichedEvents(homeCache as AppEvent[]);
          hasInitialLoad.current = true;
          authDebug.debug('Home: home screen cache is available, will be used by enrichEvents useEffect');
          return;
        }
      } catch (err) {
        authDebug.debug('Home: focus handler failed to read cache or decide fetch', err);
      }

      // Fallback: if context events are present and we haven't initial-loaded globally, consider smartRefetch
      if (eventsContext?.events) {
        if (!eventsContext.hasInitialLoad) {
          smartRefetchEvents('navigation');
        } else {
          authDebug.debug('Skipping navigation-triggered refetch because initial load already completed');
        }
      }
    }, [smartRefetchEvents, eventsContext?.events])
  );

  // React to view mode changes only - fetch when user switches between day/week/month
  useEffect(() => {
    if (hasInitialLoad.current && eventsContext?.events) {
      smartRefetchEvents('viewModeChange');
    }
  }, [viewMode, smartRefetchEvents, eventsContext?.events]);

  // Ensure calendar shows current date when switching to week view
  useEffect(() => {
    if (viewMode === 'week') {
      const today = new Date();
      console.log('📅 Switching to week view, ensuring current date:', today.toDateString());
      setDate(today);
    }
  }, [viewMode]);

  return (
    <Background>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        {/* Conditional Header - gradient only in colorful mode */}
        {isColorful ? (
          <LinearGradient colors={["#9b8fb6", "#c78aa5", "#db7d95", "#f2948f", "#f6b793", "#fbf4be"]} style={[styles.headerGradient]}>
            <View style={styles.headerContent}>
              <Text style={[styles.headerTitle, { color: '#fff' }]}>UP2 YOU</Text>
              <View style={styles.headerButtonsContainer}>
                <TouchableOpacity
                  onPress={handleCreateEventPress}
                  style={[
                    styles.headerButton,
                    { marginRight: 12 }
                  ]}
                >
                  <MaterialIcons name="add" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/(root)/Invites')}
                  style={styles.headerButton}
                >
                  <MaterialIcons
                    name="notifications"
                    size={24}
                    color={hasInvites ? '#FF3B30' : 'white'}
                  />
                  {hasInvites && (
                    <View style={styles.notificationDot} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        ) : (
          <View style={[styles.headerGradient, { backgroundColor: colors.background }]}>
            <View style={styles.headerContent}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>UP2 YOU</Text>
              <View style={styles.headerButtonsContainer}>
                <TouchableOpacity
                  onPress={handleCreateEventPress}
                  style={[
                    styles.headerButton,
                    { marginRight: 12 }
                  ]}
                >
                  <MaterialIcons name="add" size={24} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/(root)/Invites')}
                  style={styles.headerButton}
                >
                  <MaterialIcons
                    name="notifications"
                    size={24}
                    color={hasInvites ? '#FF3B30' : colors.text}
                  />
                  {hasInvites && (
                    <View style={styles.notificationDot} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Modern Tab Navigation */}
        <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setActiveTab('agenda')}
            style={[
              styles.tabButton,
              { borderBottomColor: activeTab === 'agenda' ? colors.primary : 'transparent' }
            ]}
          >
            <MaterialIcons
              name="list"
              size={20}
              color={activeTab === 'agenda' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'agenda' ? colors.primary : colors.textSecondary }
              ]}
            >
              {t('homeScreen.agenda')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('calendar')}
            style={[
              styles.tabButton,
              { borderBottomColor: activeTab === 'calendar' ? colors.primary : 'transparent' }
            ]}
          >
            <MaterialIcons
              name="calendar-today"
              size={20}
              color={activeTab === 'calendar' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'calendar' ? colors.primary : colors.textSecondary }
              ]}
            >
              {t('homeScreen.calendar')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'agenda' ? (
            /* Modern Agenda View with Day Groupings */
            <FlatList
              style={[styles.agendaList, { backgroundColor: colors.background }]}
              data={transformGroupedEventsForList(groupEventsByDay(agendaEvents))}
              keyExtractor={(item) => item.date.toDateString()}
              renderItem={({ item: dayGroup }) => (
                <View style={styles.dayGroup}>
                  {/* Day Header */}
                  <View style={[styles.dayHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.dayHeaderText, { color: colors.text }]}>
                      {formatDateHeader(dayGroup.date)}
                    </Text>
                  </View>

                  {/* Events for this day */}
                  {dayGroup.events.map(item => (
                    <TouchableOpacity
                      key={item.$id}
                      onPress={() => handlePressEvent({
                        id: item.$id,
                        title: item.title,
                        start: new Date(item.startTime),
                        end: new Date(item.endTime),
                        location: item.location,
                        color: getEventColor(item.tags || []),
                        rawEvent: item
                      })}
                      style={[styles.feedRowCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <LinearGradient colors={["#FF6B6B", "#FFD166"]} style={styles.feedThumb}>
                        <Text style={styles.eventEmojiThumb}>{getEventEmoji(item.tags)}</Text>
                      </LinearGradient>

                      <View style={styles.feedBody}>
                        <Text style={[styles.feedTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                        <View style={styles.feedMetaRow}>
                          <MaterialIcons name="calendar-today" size={12} color={colors.textSecondary} />
                          <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginLeft: 6 }]}>{new Date(item.startTime).toLocaleDateString()}</Text>
                          <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginHorizontal: 8 }]}>•</Text>
                          <MaterialIcons name="location-on" size={12} color={colors.textSecondary} />
                          <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginLeft: 6, flexShrink: 1 }]} numberOfLines={1} ellipsizeMode='tail'>{item.location || ''}</Text>
                        </View>

                        <View style={styles.feedSubRow}>
                          <UserAvatar photoUrl={getCreatorPhotoUrl(item.creatorId)} name={getCreatorName(item.creatorId)} size={28} />
                          <Text style={[styles.smallCreatorName, { color: colors.text, marginLeft: 8 }]} numberOfLines={1}>{getCreatorName(item.creatorId)}</Text>
                        </View>
                      </View>

                      <View style={styles.feedRightCol}>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{getAttendeeCount(item)} {t('homeScreen.attending')}</Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{(item as any).inviteCount ?? 0} {t('homeScreen.invited')}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialIcons name="event" size={64} color={colors.textSecondary} />
                  <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
                    No Upcoming Events
                  </Text>
                  <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
                    You're not attending any upcoming events. Join some events to see them here!
                  </Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.agendaContent, { paddingBottom: 70 + insets.bottom }]}
            />
          ) : (
            /* Modern Calendar View */
            <View style={styles.calendarContainer}>
              {/* Modern Calendar Controls */}
              <View style={[styles.controlsContainer, { backgroundColor: colors.card }]}>
                {/* View Mode Buttons - moved to left */}
                <View style={styles.viewModeContainer}>
                  {viewModes.map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => setViewMode(mode)}
                      style={[
                        styles.viewModeButton,
                        {
                          backgroundColor: viewMode === mode ? colors.primary : colors.background,
                          borderColor: colors.border,
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.viewModeText,
                          { color: viewMode === mode ? colors.buttonText : colors.text }
                        ]}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Header container with navigation and today button */}
                <View style={styles.headerContainer}>
                  {/* Combined navigation */}
                  <View style={styles.calendarHeaderContainer}>
                    {/* Left navigation */}
                    <TouchableOpacity
                      onPress={() => {
                        const newDate = new Date(date);
                        if (viewMode === 'month') {
                          newDate.setMonth(newDate.getMonth() - 1);
                          console.log('Manual navigation to previous month:', newDate);
                        } else {
                          newDate.setDate(newDate.getDate() - 7);
                          console.log('Manual navigation to previous week:', newDate);
                        }
                        setDate(newDate);
                      }}
                      style={styles.monthNavButton}
                    >
                      <MaterialIcons name="chevron-left" size={20} color={colors.text} />
                    </TouchableOpacity>

                    {/* Month display - compact format */}
                    <Text style={[styles.monthDisplay, { color: colors.text }]}>
                      {viewMode === 'month'
                        ? `${displayedMonth.toLocaleDateString('en-US', { month: 'short' })} ${displayedMonth.getFullYear()}`
                        : `${displayedMonth.toLocaleDateString('en-US', { month: 'short' })} ${displayedMonth.getFullYear()}`
                      }
                    </Text>

                    {/* Right navigation */}
                    <TouchableOpacity
                      onPress={() => {
                        const newDate = new Date(date);
                        if (viewMode === 'month') {
                          newDate.setMonth(newDate.getMonth() + 1);
                          console.log('Manual navigation to next month:', newDate);
                        } else {
                          newDate.setDate(newDate.getDate() + 7);
                          console.log('Manual navigation to next week:', newDate);
                        }
                        setDate(newDate);
                      }}
                      style={styles.monthNavButton}
                    >
                      <MaterialIcons name="chevron-right" size={20} color={colors.text} />
                    </TouchableOpacity>
                  </View>

                  {/* Today Button - positioned to the right */}
                  <TouchableOpacity
                    onPress={handleTodayPress}
                    style={[styles.todayButton, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.todayButtonText, { color: colors.buttonText }]}>{t('homeScreen.today')}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Calendar component */}
              <View
                style={styles.calendarWrapper}
                onLayout={(event) => {
                  const { height } = event.nativeEvent.layout;
                  setCalendarHeight(height);
                }}
              >
                {calendarHeight > 0 && (
                  <BigCalendar
                    key={`calendar-${viewMode}-${date.getTime()}`}
                    events={calendarEvents as any[]}
                    height={calendarHeight}
                    mode={viewMode}
                    date={date}
                    onChangeDate={handleDateChange}
                    onPressCell={handleCellPress}
                    onPressEvent={handlePressEvent}
                    renderEvent={renderEvent}
                    swipeEnabled={true}
                    overlapOffset={-12}
                    ampm={false}
                    scrollOffsetMinutes={viewMode === 'week' ? 360 : new Date().getHours() * 60 + new Date().getMinutes() - 60} // Start earlier for week view
                    showTime={false}
                    eventCellStyle={{
                      marginVertical: -2,
                      marginHorizontal: 0,
                      paddingVertical: 0,
                      paddingHorizontal: 0,
                    }}
                    // Week view specific styling
                    weekStartsOn={0} // Start week on Sunday
                  />
                )}
              </View>
            </View>
          )}
        </View>

        {/* Event Form Modal */}
        {formVisible && (
          <EventForm
            visible={formVisible}
            onClose={handleFormClose}
            event={editingEvent || undefined}
            selectedDateTime={selectedDateTime || new Date().toISOString()}
            currentUserId={currentUser?.$id || ''}
            friends={(userProfile?.friends || []) as string[]}
          />
        )}

        {/* Event Details Modal */}
        {detailsModalVisible && selectedEvent && (
          <EventDetailsModal
            event={selectedEvent}
            isCreator={selectedEvent.creatorId === currentUser?.$id}
            onClose={() => setDetailsModalVisible(false)}
            onEdit={() => handleEditEvent(selectedEvent)}
            onAttend={handleEventAttend}
            onNotAttend={handleEventNotAttend}
            onChat={() => handleEventChat(selectedEvent)}
            currentUserId={currentUser?.$id || ''}
          />
        )}

        {/* Message Modal */}
        {messageModalVisible && selectedEvent && (
          <MessageModal
            visible={messageModalVisible}
            onClose={() => setMessageModalVisible(false)}
            eventId={selectedEvent.$id}
            title={`${selectedEvent.title} Chat`}
            currentUserId={currentUser?.$id || ''}
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
  headerButton: {
    padding: 8,
    borderRadius: 8,
    position: 'relative',
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  content: {
    flex: 1,
    paddingBottom: 80, // Add padding to prevent cutoff from tab bar
  },
  calendarContainer: {
    flex: 1,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  controlsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  viewModeContainer: {
    flexDirection: 'row',
  },
  viewModeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  monthDisplayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4, // Reduced padding
    paddingHorizontal: 2,
  },
  calendarHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Navigation elements centered
    gap: 8, // Add small gap between elements
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Space between navigation and today button
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    gap: 20, // Add gap for more space between navigation and today button
  },
  monthDisplayCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 0,   // Reduced from 8
  },
  monthDisplayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavButton: {
    padding: 0,            // Reduced from 6
    borderRadius: 0,
    marginHorizontal: 0,   // Reduced from 4
  },
  monthDisplay: {
    fontSize: 15,          // Reduced from 16
    fontWeight: '600',
    textAlign: 'center',
  },
  todayButton: {
    paddingHorizontal: 12, // Larger size
    paddingVertical: 6,    // Larger size  
    borderRadius: 6,
    marginLeft: 0,
  },
  todayButtonText: {
    fontSize: 13,          // Larger font
    fontWeight: '600',
    color: 'white',
  },
  calendarWrapper: {
    flex: 1,
    marginBottom: 0, // Remove bottom margin to prevent cutoff
    paddingBottom: 20, // Reduced padding for better fit
  },
  agendaList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  agendaCard: {
    padding: 16,
    borderRadius: 16,
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
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  agendaTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  eventColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  agendaMeta: {
    gap: 8,
  },
  agendaMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agendaMetaText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  agendaGroupText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  agendaContent: {
    paddingBottom: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },

  // New horizontal feed row styles (copied from Feed.tsx)
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
  smallCreatorName: {
    fontSize: 13,
    fontWeight: '600',
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
  createEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  createEventButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  dayGroup: {
    marginBottom: 16,
  },
  dayHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  dayHeaderText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
