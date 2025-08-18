import { getEventColor } from '@/constants/categories';
import { addEventAttendee, enrichEventsWithGroupNames, getEventAttendeeCount, getUserAttendingEvents, removeEventAttendee } from '@/lib/api/event';
import { getUserGroupInvites } from '@/lib/api/group';
import { getActiveTravelForUser } from '@/lib/api/travel';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { account } from '@/lib/appwrite/appwrite';
import { useAppwrite } from '@/lib/appwrite/useAppwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { authDebug } from '@/lib/debug/authDebug';
import { Event as AppEvent } from '@/lib/types/Events';
import { TravelAnnouncement } from '@/lib/types/Travel';
import { isDateInTravelPeriod } from '@/lib/utils/travelCalendarUtils';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EventDetailsModal from '../components/EventDetailsModal';
import EventForm from '../components/EventForm';
import MessageModal from '../components/MessageModal';
import { EventsContext } from '../context/EventContext';

// Define available calendar view modes
const viewModes: Mode[] = ['day', 'week', 'month'];

type TabType = 'calendar' | 'agenda';

// Cache for creator names
const creatorNameCache = new Map<string, string>();

// Helper functions for date formatting
const formatDateHeader = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Check if it's today
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  // Check if it's tomorrow
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }

  // Otherwise, format like "Thu, Sept 4"
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

// Group events by day
const groupEventsByDay = (events: AppEvent[]) => {
  const grouped: { [key: string]: { date: Date; events: AppEvent[] } } = {};

  events.forEach(event => {
    const eventDate = new Date(event.startTime);
    const dateKey = eventDate.toDateString();

    if (!grouped[dateKey]) {
      grouped[dateKey] = {
        date: eventDate,
        events: []
      };
    }

    grouped[dateKey].events.push(event);
  });

  // Sort by date and return as array
  return Object.values(grouped).sort((a, b) => a.date.getTime() - b.date.getTime());
};

export default function Home() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Safely access the context values
  const eventsContext = React.useContext(EventsContext);

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
  const [viewMode, setViewMode] = useState<Mode>('week');
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

  // Track when data was last fetched to prevent unnecessary refetches
  const lastFetchTime = useRef<number>(0);
  const previousViewMode = useRef<Mode>(viewMode);
  const hasInitialLoad = useRef<boolean>(false);

  // Get route params (for user calendar view)
  const params = useLocalSearchParams();

  // Efficiently fetch current user with caching
  const { data: currentUser } = useAppwrite({
    fn: async () => await account.get(),
    cacheKey: 'current-user',
    cacheTTL: 30 * 60 * 1000, // 30 minute cache for current user
  });

  // Fetch user profile with friends list - only when currentUser changes
  const { data: userProfile } = useAppwrite({
    fn: async () => {
      if (!currentUser?.$id) return null;
      return await getUserProfile(currentUser.$id);
    },
    cacheKey: currentUser?.$id ? `user-profile-${currentUser.$id}` : undefined,
    dependencies: [currentUser?.$id],
    skip: !currentUser?.$id,
  });

  // Fetch user's travel data for calendar highlighting
  const { data: travelData } = useAppwrite({
    fn: async () => {
      if (!currentUser?.$id) return [];
      return await getActiveTravelForUser(currentUser.$id);
    },
    cacheKey: currentUser?.$id ? `user-travel-${currentUser.$id}` : undefined,
    dependencies: [currentUser?.$id],
    skip: !currentUser?.$id,
  });

  // Set currentUserId when currentUser changes
  useEffect(() => {
    setCurrentUserId(currentUser?.$id || null);
  }, [currentUser]);

  // Sync displayedMonth with date changes (for better month display tracking)
  useEffect(() => {
    setDisplayedMonth(date);
  }, [date]);

  // Get unique creator IDs from events
  const creatorIds = useMemo(() => {
    // Skip if events is empty to prevent unnecessary updates
    if (!events || events.length === 0) return [];

    const ids = events
      .map((event: AppEvent) => event.creatorId)
      .filter(Boolean)
      .filter((id: string) => !creatorNameCache.has(id));

    return [...new Set(ids)] as string[];
  }, [events]);

  // Fetch creator profiles only when we have new creator IDs
  const { data: creatorProfiles } = useAppwrite({
    fn: async () => {
      if (!creatorIds.length) return [];
      const profiles = await getUsersByIds(creatorIds);

      // Update cache with newly fetched creator names
      profiles.forEach(profile => {
        if (profile.$id && userDisplayUtils.hasValidName(profile)) {
          creatorNameCache.set(profile.$id, userDisplayUtils.getFullName(profile));
        }
      });

      return profiles;
    },
    dependencies: [creatorIds],
    skip: !creatorIds.length,
  });

  // Create a stable function to get creator name with caching
  const getCreatorName = React.useCallback((creatorId: string): string => {
    return creatorNameCache.get(creatorId) || 'Unknown Creator';
  }, [creatorProfiles]);

  // Filter events for the current user using junction table system
  const userEvents = useMemo(() => {
    // Early return if no user or events to prevent unnecessary updates
    if (!currentUser?.$id || !events || events.length === 0) return [];

    // For calendar display, we want to show events the user created OR is attending
    // We'll filter these asynchronously below
    return events.filter((e: AppEvent) => e.creatorId === currentUser.$id);
  }, [events, currentUser]);

  // Get events user is attending via junction table and merge with created events
  const [userAttendingEvents, setUserAttendingEvents] = useState<AppEvent[]>([]);

  useEffect(() => {
    const fetchUserAttendingEvents = async () => {
      if (!currentUser?.$id) {
        setUserAttendingEvents([]);
        return;
      }

      try {
        // Get events user is attending via junction table
        const attendingEvents = await getUserAttendingEvents(currentUser.$id);

        // Also include events user created (if not already in attending list)
        const createdEvents = events.filter((e: AppEvent) => e.creatorId === currentUser.$id);

        // Merge and deduplicate by $id
        const allUserEvents = [...attendingEvents];
        createdEvents.forEach(createdEvent => {
          if (!attendingEvents.some(attending => attending.$id === createdEvent.$id)) {
            allUserEvents.push(createdEvent);
          }
        });

        authDebug.debug(`Home: User has ${allUserEvents.length} total events (${attendingEvents.length} attending, ${createdEvents.length} created)`);
        setUserAttendingEvents(allUserEvents);
      } catch (error) {
        authDebug.error('Error fetching user attending events for calendar:', error);
        // Fallback to just created events
        setUserAttendingEvents(events.filter((e: AppEvent) => e.creatorId === currentUser.$id));
      }
    };

    fetchUserAttendingEvents();
  }, [events, currentUser]);

  // Check for pending invites (both event and group invites)
  const hasInvites = useMemo(() => {
    if (!currentUser?.$id || !events || events.length === 0) return false;

    // Check for event invites
    const hasEventInvites = events.some(event =>
      event.creatorId !== currentUser.$id &&
      event.inviteeIds &&
      Array.isArray(event.inviteeIds) &&
      event.inviteeIds.includes(currentUser.$id)
    );

    // Check for group invites
    const hasGroupInvites = groupInvites.length > 0;

    return hasEventInvites || hasGroupInvites;
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

  // Fetch agenda events (events user is attending)
  useEffect(() => {
    const fetchAgendaEvents = async () => {
      if (!currentUser?.$id) return;

      try {
        authDebug.debug('Fetching agenda events for user:', currentUser.$id);
        const attendingEvents = await getUserAttendingEvents(currentUser.$id);

        // Filter for upcoming events only
        const upcomingEvents = attendingEvents.filter(event => {
          const eventEndTime = new Date(event.endTime || event.startTime);
          return eventEndTime > new Date();
        });

        // Sort by start time
        upcomingEvents.sort((a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

        // Enrich events with creator names and accurate attendee counts
        const enrichedAgendaEvents = await Promise.all(
          upcomingEvents.map(async (event) => {
            // Get creator name
            const creatorName = getCreatorName(event.creatorId);

            // Get accurate attendee count from junction table
            const attendeeCount = await getEventAttendeeCount(event.$id);

            return {
              ...event,
              creatorName,
              attendeeCount
            };
          })
        );

        authDebug.debug(`Found ${enrichedAgendaEvents.length} upcoming events user is attending`);
        setAgendaEvents(enrichedAgendaEvents);
      } catch (error) {
        authDebug.error('Error fetching agenda events:', error);
        setAgendaEvents([]);
      }
    };

    fetchAgendaEvents();
  }, [currentUser, events, getCreatorName]); // Refetch when events change

  // Enrich events with group names
  useEffect(() => {
    const enrichEvents = async () => {
      if (userAttendingEvents && userAttendingEvents.length > 0) {
        try {
          const enriched = await enrichEventsWithGroupNames(userAttendingEvents);
          setEnrichedEvents(enriched);
        } catch (error) {
          authDebug.error('Failed to enrich events with group names:', error);
          setEnrichedEvents(userAttendingEvents); // Fallback to original events
        }
      } else {
        setEnrichedEvents([]);
      }
    };

    enrichEvents();
  }, [userAttendingEvents]);

  // Format events for the calendar with date validation
  const calendarEvents = useMemo(() => {
    if (!enrichedEvents || !Array.isArray(enrichedEvents)) {
      return [];
    }

    // Only log once when debugging is necessary - not on every render
    const shouldLog = false; // Set to true only when debugging is needed

    if (shouldLog) {
      authDebug.debug(`Processing ${enrichedEvents.length} user events for calendar`);
    }

    return enrichedEvents
      .filter((e: AppEvent) => {
        // Safety check for null or undefined events
        if (!e || typeof e !== 'object') {
          authDebug.warn('Filtering out null or non-object event');
          return false;
        }

        // Validate that start and end times are valid dates
        try {
          const startValid = e.startTime && !isNaN(new Date(e.startTime).getTime());
          const endValid = e.endTime && !isNaN(new Date(e.endTime).getTime());

          if (!startValid || !endValid) {
            authDebug.warn(`Filtering out event with invalid dates: ${e.$id}, start: ${e.startTime}, end: ${e.endTime}`);
            return false;
          }

          return true;
        } catch (error) {
          authDebug.error(`Error processing event ${e.$id || 'unknown'}:`, error);
          return false;
        }
      })
      .map((e: AppEvent) => {
        try {
          // Parse dates safely with error handling
          // Ensure dates are in local timezone to prevent offset issues
          const startDate = new Date(e.startTime);
          const endDate = new Date(e.endTime);

          // Validate that end time is after start time
          if (endDate <= startDate) {
            authDebug.warn(`Event end time must be after start time: ${e.$id}`);
            // Fix the end time to be at least 30 minutes after start time
            endDate.setTime(startDate.getTime() + (30 * 60 * 1000));
          }

          // Ensure the dates are properly formatted for the calendar component
          const formattedEvent = {
            id: e.$id,
            title: e.title || 'Untitled Event',
            start: startDate,
            end: endDate,
            location: e.location || 'No location',
            color: getEventColor(e.tags || []), // Add color based on first tag
            rawEvent: {
              ...e,
              $id: e.$id,
              creatorName: getCreatorName(e.creatorId)
            },
          };

          // Only log when debugging is necessary
          if (shouldLog) {
            authDebug.debug(`Formatted event: ${e.title}, start: ${startDate.toISOString()}, end: ${endDate.toISOString()}`);
          }
          return formattedEvent;
        } catch (error) {
          authDebug.error(`Error mapping event ${e.$id || 'unknown'} for calendar:`, error);
          return null;
        }
      })
      .filter(Boolean); // Remove any null events from mapping errors

  }, [enrichedEvents, getCreatorName]);

  // Memoize event handlers (declare before renderEvent to avoid dependency issues)
  const handlePressEvent = useCallback((event: any) => {
    try {
      if (!event) {
        console.warn('handlePressEvent: event is null or undefined');
        return;
      }

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

  // Memoize date change handler to prevent re-renders
  const handleDateChange = useCallback((range: any) => {
    // The BigCalendar library passes different formats depending on the view mode
    let newDate: Date;
    if (range && typeof range === 'object') {
      if (range.start) {
        newDate = new Date(range.start);
      } else if (Array.isArray(range)) {
        newDate = new Date(range[0]);
      } else {
        newDate = new Date(range);
      }
    } else {
      newDate = new Date(range);
    }
    setDate(newDate);
    setDisplayedMonth(new Date(newDate)); // Update the displayed month when date changes
  }, []);

  // Monitor displayed month changes for swipe navigation
  useEffect(() => {
    if (viewMode !== 'month') return;

    const interval = setInterval(() => {
      // Check if the month or year has changed from what we're displaying
      const currentMonth = date.getMonth();
      const currentYear = date.getFullYear();
      const displayedMonthValue = displayedMonth.getMonth();
      const displayedYearValue = displayedMonth.getFullYear();

      if (currentMonth !== displayedMonthValue || currentYear !== displayedYearValue) {
        setDisplayedMonth(new Date(date));
      }
    }, 100); // Check every 100ms for responsive updates

    return () => clearInterval(interval);
  }, [viewMode, date, displayedMonth]);  // Handler for editing event
  const handleEditEvent = useCallback((event: AppEvent) => {
    setEditingEvent(event);
    setDetailsModalVisible(false);
    setFormVisible(true);
  }, []);

  // Custom date renderer for month view to highlight travel dates
  const renderCustomDateForMonth = useCallback((date: Date) => {
    const isTravelDate = travelData && isDateInTravelPeriod(date, travelData);

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'flex-start',
          minHeight: 32,
          paddingTop: 2,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            alignItems: 'center',
            justifyContent: 'center',
            // Subtle travel date indicator - small border only
            borderWidth: isTravelDate ? 1 : 0,
            borderColor: isTravelDate ? '#000000' : 'transparent',
            borderRadius: 12,
            backgroundColor: isTravelDate ? '#000000' + '10' : 'transparent',
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: isTravelDate ? '600' : 'normal',
              color: isTravelDate ? '#000000' : colors.text,
            }}
          >
            {date.getDate()}
          </Text>
        </View>
      </View>
    );
  }, []);

  // Memoize button handlers
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

  const handleFormClose = useCallback(() => {
    setFormVisible(false);
    // After creating/editing an event, refresh data immediately
    if (eventsContext) {
      smartRefetchEvents('manual');
    }
  }, [eventsContext, smartRefetchEvents]);

  const handleDetailsModalClose = useCallback(() => {
    setDetailsModalVisible(false);
  }, []);

  const handleEventAttend = useCallback(async () => {
    if (!selectedEvent || !currentUser?.$id) return;

    try {
      await addEventAttendee(selectedEvent.$id, currentUser.$id);
      setDetailsModalVisible(false);
      if (eventsContext) {
        smartRefetchEvents('manual');
      }
    } catch (error) {
      console.error('Error attending event:', error);
    }
  }, [selectedEvent, currentUser?.$id, eventsContext, smartRefetchEvents]);

  const handleEventNotAttend = useCallback(async () => {
    if (!selectedEvent || !currentUser?.$id) return;

    try {
      await removeEventAttendee(selectedEvent.$id, currentUser.$id);
      setDetailsModalVisible(false);
      if (eventsContext) {
        smartRefetchEvents('manual');
      }
    } catch (error) {
      console.error('Error not attending event:', error);
    }
  }, [selectedEvent, currentUser?.$id, eventsContext, smartRefetchEvents]);

  const handleEventChat = useCallback((event: AppEvent) => {
    setSelectedEvent(event);
    setDetailsModalVisible(false);
    setMessageModalVisible(true);
  }, []);

  // React to screen focus (navigation) - only fetch when navigating to this screen
  useFocusEffect(
    useCallback(() => {
      if (eventsContext?.events) {
        smartRefetchEvents('navigation');
      }
    }, [smartRefetchEvents, eventsContext?.events])
  );

  // React to view mode changes only - fetch when user switches between day/week/month
  useEffect(() => {
    if (hasInitialLoad.current && eventsContext?.events) {
      smartRefetchEvents('viewModeChange');
    }
  }, [viewMode, smartRefetchEvents, eventsContext?.events]);

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
            <Text style={styles.headerTitle}>UP2</Text>
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
      </View>

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
            Agenda
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
            Calendar
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'agenda' ? (
          /* Modern Agenda View with Day Groupings */
          <FlatList
            style={[styles.agendaList, { backgroundColor: colors.background }]}
            data={groupEventsByDay(agendaEvents)}
            keyExtractor={(item) => item.date.toDateString()}
            renderItem={({ item: dayGroup }) => (
              <View style={styles.dayGroup}>
                {/* Day Header */}
                <View style={[styles.dayHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
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
                  >
                    <View style={[styles.agendaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.agendaHeader}>
                        <Text style={[styles.agendaTitle, { color: colors.text }]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <View style={[styles.eventColorDot, { backgroundColor: getEventColor(item.tags || []) || colors.primary }]} />
                      </View>

                      <View style={styles.agendaMeta}>
                        <View style={styles.agendaMetaRow}>
                          <MaterialIcons name="access-time" size={16} color={colors.primary} />
                          <Text style={[styles.agendaMetaText, { color: colors.textSecondary }]}>
                            {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(item.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>

                        <View style={styles.agendaMetaRow}>
                          <MaterialIcons name="people" size={16} color={colors.primary} />
                          <Text style={[styles.agendaMetaText, { color: colors.textSecondary }]}>
                            {(item as any).attendeeCount || 0} attending
                          </Text>
                        </View>

                        {(item as any).creatorName && (
                          <View style={styles.agendaMetaRow}>
                            <MaterialIcons name="person" size={16} color={colors.primary} />
                            <Text style={[styles.agendaMetaText, { color: colors.textSecondary }]}>
                              By {(item as any).creatorName}
                            </Text>
                          </View>
                        )}

                        {item.location && item.location !== 'No location' && (
                          <View style={styles.agendaMetaRow}>
                            <MaterialIcons name="location-on" size={16} color={colors.primary} />
                            <Text style={[styles.agendaMetaText, { color: colors.textSecondary }]}>
                              {item.location}
                            </Text>
                          </View>
                        )}
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
              <View style={styles.controlsLeft}>
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
                          { color: viewMode === mode ? 'white' : colors.text }
                        ]}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Month Display */}
                <Text style={[styles.monthDisplay, { color: colors.text }]}>
                  {displayedMonth.toLocaleDateString('en-US', { month: 'long' })}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleTodayPress}
                style={[styles.todayButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.todayButtonText}>Today</Text>
              </TouchableOpacity>
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
                  events={calendarEvents as any[]}
                  height={calendarHeight}
                  mode={viewMode}
                  date={date}
                  onChangeDate={handleDateChange}
                  onPressCell={handleCellPress}
                  onPressEvent={handlePressEvent}
                  renderEvent={renderEvent}
                  renderCustomDateForMonth={renderCustomDateForMonth}
                  swipeEnabled={true}
                  overlapOffset={-12} // More negative to force events closer together
                  ampm={false}
                  scrollOffsetMinutes={new Date().getHours() * 60 + new Date().getMinutes() - 60} // Default to current time
                  showTime={false}
                  eventCellStyle={{ // Add custom event cell styling to minimize spacing
                    marginVertical: -2, // Negative margins to overlap
                    marginHorizontal: 0, // Remove horizontal margins
                    paddingVertical: 0, // Remove vertical padding
                    paddingHorizontal: 0, // Remove horizontal padding
                  }}
                  theme={{
                    palette: {
                      gray: {
                        '200': 'transparent',
                        '300': colors.border,
                      },
                    },
                  }}
                  headerContainerStyle={{
                    height: 53,
                    backgroundColor: colors.surface,
                  }}
                  bodyContainerStyle={{
                    paddingBottom: 0,
                  }}
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
    marginRight: 24,
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
  monthDisplay: {
    fontSize: 18,
    fontWeight: '600',
  },
  todayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  calendarWrapper: {
    flex: 1,
    marginBottom: 64,
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
