import { getEventColor } from '@/constants/categories';
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
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventDetailsModal from '../components/EventDetailsModal';
import EventForm from '../components/EventForm';
import { EventsContext } from '../context/EventContext';

// Define available calendar view modes
const viewModes: Mode[] = ['day', 'week', 'month'];

// Cache for creator names
const creatorNameCache = new Map<string, string>();

export default function Home() {
  const { colors } = useTheme();

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
  const [date, setDate] = useState(new Date());
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
  const [startHour, setStartHour] = useState(new Date().getHours() - 4);
  const [endHour, setEndHour] = useState(new Date().getHours() + 4);
  const [calendarHeight, setCalendarHeight] = useState(0);
  const [userTravelData, setUserTravelData] = useState<TravelAnnouncement[]>([]);

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

  // Filter events for the current user
  const userEvents = useMemo(() => {
    // Early return if no user or events to prevent unnecessary updates
    if (!currentUser?.$id || !events || events.length === 0) return [];

    return events.filter((e: AppEvent) =>
      e.creatorId === currentUser.$id ||
      (e.inviteeIds && Array.isArray(e.inviteeIds) && e.inviteeIds.includes(currentUser.$id)) ||
      (e.attendees && Array.isArray(e.attendees) && e.attendees.includes(currentUser.$id))
    );
  }, [events, currentUser]);

  // Format events for the calendar with date validation
  const calendarEvents = useMemo(() => {
    if (!userEvents || !Array.isArray(userEvents)) {
      return [];
    }

    // Only log once when debugging is necessary - not on every render
    const shouldLog = false; // Set to true only when debugging is needed

    if (shouldLog) {
      authDebug.debug(`Processing ${userEvents.length} user events for calendar`);
    }

    return userEvents
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

  }, [userEvents, getCreatorName]);

  // Custom render function for events with type safety
  const renderEvent = (event: any, touchableOpacityProps: any) => {
    // Safety check to prevent rendering invalid events
    if (!event || !event.rawEvent) {
      return null;
    }

    const isMonthView = viewMode === 'month';
    const eventColor = event.color || colors.primary;

    // Convert hex color to rgba for opacity in month view
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const backgroundColor = isMonthView
      ? hexToRgba(eventColor, 0.4) // 40% opacity for month view
      : eventColor; // Full opacity for week/day view

    return (
      <TouchableOpacity
        {...touchableOpacityProps}
        style={[
          touchableOpacityProps.style, // Preserve original calendar positioning styles
          {
            backgroundColor,
            padding: 1,
            borderRadius: 4,
            margin: 0, // Remove margin to align with grid
            flex: 0, // Take full width of grid cell
          }
        ]}
        onPress={() => handlePressEvent(event)}
        key={event.rawEvent.$id || `event-${Math.random()}`} // Ensure unique key
      >
        <Text
          className={`text-xs font-rubik-medium ${isMonthView ? 'text-black-300' : 'text-white'
            }`}
          numberOfLines={1}
          style={{ textAlign: 'center' }}
        >
          {event.title || 'Untitled'}
        </Text>
        {!isMonthView && (
          <>
            <Text className="text-white text-xs" style={{ textAlign: 'center' }}>
              {event.location || 'No location'}
            </Text>
            <Text className="text-white text-xs" style={{ textAlign: 'center' }}>
              {event.rawEvent?.creatorName || 'Unknown'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  // Handler for pressing a calendar cell (to create a new event)
  const handleCellPress = (date: Date) => {
    setSelectedDateTime(date.toISOString());
    setEditingEvent(null); // Clear any existing event to create a new one
    setFormVisible(true);
  };

  // Custom date renderer for month view to highlight travel dates
  const renderCustomDateForMonth = (date: Date) => {
    const isTravelDate = travelData && isDateInTravelPeriod(date, travelData);

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 32,
          // More subtle highlighting that looks like a header badge
          backgroundColor: isTravelDate ? colors.primary + '15' : 'transparent',
          borderWidth: isTravelDate ? 2 : 0,
          borderColor: isTravelDate ? colors.primary : 'transparent',
          borderRadius: isTravelDate ? 16 : 0,
          margin: isTravelDate ? 1 : 0,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: isTravelDate ? 'bold' : 'normal',
            color: isTravelDate ? colors.primary : colors.text,
          }}
        >
          {date.getDate()}
        </Text>
      </View>
    );
  };
  // Custom header renderer for highlighting travel days
  // Handler for pressing an event (to view/edit)
  const handlePressEvent = (event: any) => {
    if (event && event.rawEvent) {
      setSelectedEvent(event.rawEvent as AppEvent);
      setDetailsModalVisible(true);
    }
  };

  // Handler for editing event
  const handleEditEvent = (event: AppEvent) => {
    setEditingEvent(event);
    setDetailsModalVisible(false);
    setFormVisible(true);
  };

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
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-row justify-between items-center p-4">
        <Text className="text-2xl font-rubik-semibold" style={{ color: colors.text }}>
          Calendar
        </Text>
        <View className="flex-row">
          {/* View mode switcher */}
          {viewModes.map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-full mx-1`}
              style={{
                backgroundColor: viewMode === mode ? colors.primary : colors.surface
              }}
            >
              <Text
                className="font-rubik"
                style={{
                  color: viewMode === mode ? colors.background : colors.text
                }}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Calendar component */}
      <View
        className="flex-1 mb-16"
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
            onPressCell={handleCellPress}
            onPressEvent={handlePressEvent}
            renderEvent={renderEvent}
            renderCustomDateForMonth={renderCustomDateForMonth}
            swipeEnabled={true}
            overlapOffset={0}
            ampm={false}
            scrollOffsetMinutes={0}
            headerContainerStyle={{
              height: 50,
              backgroundColor: colors.surface,
            }}
            bodyContainerStyle={{
              paddingBottom: 0,
            }}
          />
        )}
      </View>

      {/* Add Event FAB */}
      <TouchableOpacity
        className="absolute bottom-8 right-8 w-16 h-16 rounded-full items-center justify-center"
        style={{
          backgroundColor: colors.primary,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        }}
        onPress={() => {
          setSelectedDateTime(new Date().toISOString());
          setEditingEvent(null);
          setFormVisible(true);
        }}
      >
        <Text className="text-2xl" style={{ color: colors.background }}>+</Text>
      </TouchableOpacity>

      {/* Event Form Modal */}
      {formVisible && (
        <EventForm
          visible={formVisible}
          onClose={() => {
            setFormVisible(false);
            // After creating/editing an event, refresh data immediately
            if (eventsContext) {
              smartRefetchEvents('manual');
            }
          }}
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
          onAttend={() => {
            // Handle attend logic
            setDetailsModalVisible(false);
            if (eventsContext) {
              smartRefetchEvents('manual');
            }
          }}
          onNotAttend={() => {
            // Handle not attend logic
            setDetailsModalVisible(false);
            if (eventsContext) {
              smartRefetchEvents('manual');
            }
          }}
          currentUserId={currentUser?.$id || ''}
        />
      )}
    </SafeAreaView>
  );
}
