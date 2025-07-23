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
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventDetailsModal from '../components/EventDetailsModal';
import EventForm from '../components/EventForm';
import { EventsContext } from '../context/EventContext';

// Define available calendar view modes
const viewModes: Mode[] = ['day', 'week', 'month'];

type TabType = 'calendar' | 'agenda';

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
  const [date, setDate] = useState(() => new Date()); // Use function to initialize once
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
  const [startHour] = useState(() => new Date().getHours() - 4); // Initialize once, no setter
  const [endHour] = useState(() => new Date().getHours() + 4); // Initialize once, no setter
  const [calendarHeight, setCalendarHeight] = useState(0);
  const [userTravelData, setUserTravelData] = useState<TravelAnnouncement[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('calendar');

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
      const eventColor = event.color || colors.primary;

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
            touchableOpacityProps.style, // Preserve original calendar positioning styles
            {
              backgroundColor,
              padding: isMonthView ? 0 : 1, // Reduced padding for week/day view
              borderRadius: isMonthView ? 2 : 4,
              margin: 0,
              flex: 0,
              // For month view, position events below the date number with more spacing
              ...(isMonthView && {
                position: 'absolute',
                bottom: 1,
                left: 1,
                right: 1,
                height: 14,
                minHeight: 14,
                maxHeight: 14,
                top: 28, // Push events down below the date number area
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
              fontSize: isMonthView ? 10 : 12,
              color: isMonthView ? colors.background : colors.background, // Use background color (white in dark mode)
              marginBottom: isMonthView ? 0 : -2, // Reduce space below title in week/day view
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
  }, [viewMode, colors.primary, colors.background, colors.error, handlePressEvent]);

  // Handler for pressing a calendar cell (to create a new event)
  const handleCellPress = useCallback((date: Date) => {
    setSelectedDateTime(date.toISOString());
    setEditingEvent(null); // Clear any existing event to create a new one
    setFormVisible(true);
  }, []);

  // Memoize date change handler to prevent re-renders
  const handleDateChange = useCallback((dates: any) => {
    if (Array.isArray(dates)) {
      setDate(dates[0]);
    } else {
      setDate(dates);
    }
  }, []);

  // Memoize event handlers
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

  // Handler for editing event
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
            borderColor: isTravelDate ? colors.primary : 'transparent',
            borderRadius: 12,
            backgroundColor: isTravelDate ? colors.primary + '10' : 'transparent',
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: isTravelDate ? '600' : 'normal',
              color: isTravelDate ? colors.primary : colors.text,
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
    setDate(new Date());
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

  const handleEventAttend = useCallback(() => {
    // Handle attend logic
    setDetailsModalVisible(false);
    if (eventsContext) {
      smartRefetchEvents('manual');
    }
  }, [eventsContext, smartRefetchEvents]);

  const handleEventNotAttend = useCallback(() => {
    // Handle not attend logic
    setDetailsModalVisible(false);
    if (eventsContext) {
      smartRefetchEvents('manual');
    }
  }, [eventsContext, smartRefetchEvents]);

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
      {/* Header */}
      <View className="px-0 py-0 border-b" style={{ borderBottomColor: colors.border }}>
        <Text className="text-2xl font-rubik-semibold text-center" style={{ color: colors.text }}>
          UP2
        </Text>
      </View>

      {/* Tab Navigation */}
      <View className="flex-row px-4 py-2 border-b" style={{ borderBottomColor: colors.border }}>
        <TouchableOpacity
          onPress={() => setActiveTab('calendar')}
          className={`flex-1 py-2 ${activeTab === 'calendar' ? 'border-b-2' : ''}`}
          style={{ borderBottomColor: activeTab === 'calendar' ? colors.primary : 'transparent' }}
        >
          <Text
            className="text-center font-rubik-medium"
            style={{
              color: activeTab === 'calendar' ? colors.primary : colors.textSecondary
            }}
          >
            Calendar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('agenda')}
          className={`flex-1 py-2 ${activeTab === 'agenda' ? 'border-b-2' : ''}`}
          style={{ borderBottomColor: activeTab === 'agenda' ? colors.primary : 'transparent' }}
        >
          <Text
            className="text-center font-rubik-medium"
            style={{
              color: activeTab === 'agenda' ? colors.primary : colors.textSecondary
            }}
          >
            Agenda
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View className="flex-1">
        {activeTab === 'calendar' ? (
          <View className="flex-1">
            {/* Calendar Controls */}
            <View className="flex-row justify-between items-center px-4 py-2" style={{ backgroundColor: colors.card }}>
              <View className="flex-row">
                {viewModes.map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setViewMode(mode)}
                    className={`px-3 py-1 mr-2 rounded ${viewMode === mode ? 'bg-blue-500' : ''}`}
                    style={{ backgroundColor: viewMode === mode ? colors.primary : 'transparent' }}
                  >
                    <Text
                      className="font-rubik-medium capitalize"
                      style={{ color: viewMode === mode ? 'white' : colors.text }}
                    >
                      {mode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity onPress={handleTodayPress}>
                <Text className="font-rubik-medium" style={{ color: colors.primary }}>Today</Text>
              </TouchableOpacity>
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
                  onChangeDate={handleDateChange}
                  onPressCell={handleCellPress}
                  onPressEvent={handlePressEvent}
                  renderEvent={renderEvent}
                  renderCustomDateForMonth={renderCustomDateForMonth}
                  swipeEnabled={true}
                  overlapOffset={0}
                  ampm={false}
                  scrollOffsetMinutes={0}
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
        ) : (
          /* Agenda View */
          <FlatList
            className="flex-1 px-4 pt-4"
            data={calendarEvents
              .filter((item): item is NonNullable<typeof item> => item !== null && new Date(item.start) > new Date()) // Only show upcoming events
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handlePressEvent(item)} className="mb-3">
                <View className="p-4 rounded-lg border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-lg font-rubik-semibold" style={{ color: colors.text }}>
                      {item.title}
                    </Text>
                    <View
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: item.color || colors.primary }}
                    />
                  </View>
                  <Text className="font-rubik" style={{ color: colors.textSecondary }}>
                    {new Date(item.start).toLocaleDateString()} at {new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text className="font-rubik mt-1" style={{ color: colors.textSecondary }}>
                    {item.rawEvent?.attendees?.length || 0} attending
                  </Text>
                  {item.location && item.location !== 'No location' && (
                    <Text className="font-rubik mt-1" style={{ color: colors.textSecondary }}>
                      📍 {item.location}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center py-12">
                <Text className="text-lg font-rubik-semibold mb-2" style={{ color: colors.text }}>
                  No Events Yet
                </Text>
                <Text className="text-center font-rubik mb-6" style={{ color: colors.textSecondary }}>
                  Create your first event to get started!
                </Text>
                <TouchableOpacity
                  onPress={handleCreateEventPress}
                  className="bg-blue-500 px-6 py-3 rounded-lg"
                >
                  <Text className="text-white font-rubik-medium">Create First Event</Text>
                </TouchableOpacity>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Add Event FAB */}
      <TouchableOpacity
        className="absolute bottom-8 right-8 w-16 h-16 rounded-full items-center justify-center"
        style={{
          backgroundColor: colors.primary,
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        }}
        onPress={handleCreateEventPress}
      >
        <Text className="text-2xl" style={{ color: colors.background }}>+</Text>
      </TouchableOpacity>

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
          onClose={handleDetailsModalClose}
          onEdit={() => handleEditEvent(selectedEvent)}
          onAttend={handleEventAttend}
          onNotAttend={handleEventNotAttend}
          currentUserId={currentUser?.$id || ''}
        />
      )}
    </SafeAreaView>
  );
}
