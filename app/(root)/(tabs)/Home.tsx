import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { account } from '@/lib/appwrite/appwrite';
import { useAppwrite } from '@/lib/appwrite/useAppwrite';
import { authDebug } from '@/lib/debug/authDebug';
import { Event as AppEvent } from '@/lib/types/Events';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
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
        if (profile.$id && profile.name) {
          creatorNameCache.set(profile.$id, profile.name);
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
  }, []);

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
  const renderEvent = (event: any) => {
    // Safety check to prevent rendering invalid events
    if (!event || !event.rawEvent) {
      return null;
    }

    const isMonthView = viewMode === 'month';

    return (
      <TouchableOpacity
        className={`p-1 rounded-md ${
          isMonthView ? 'bg-primary-100' : 'bg-primary-300 h-full'
        }`}
        onPress={() => handlePressEvent(event)}
        key={event.rawEvent.$id || `event-${Math.random()}`} // Ensure unique key
      >
        <Text
          className={`text-xs font-rubik-medium ${
            isMonthView ? 'text-black-300' : 'text-white'
          }`}
          numberOfLines={1}
        >
          {event.title || 'Untitled'}
        </Text>
        {!isMonthView && (
          <>
            <Text className="text-white text-xs">
              {event.location || 'No location'}
            </Text>
            <Text className="text-white text-xs">
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
    setFormVisible(true);
  };

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

  // Load events and handle refresh logic when component mounts
  React.useEffect(() => {
    // Skip this effect if events context isn't ready
    if (!eventsContext) {
      return;
    }

    // Define a flag to prevent setting state after unmount
    let isMounted = true;
    const shouldLog = false; // Set to true only when debugging is needed

    // Create a function for checking and refreshing data
    const refreshDataIfNeeded = async () => {
      if (shouldLog) {
        authDebug.debug('Home screen focused, checking if data refresh needed');
      }

      try {
        const lastRefresh = await AsyncStorage.getItem('lastEventRefresh');
        const now = Date.now();
        let shouldRefresh = true;

        if (lastRefresh) {
          const lastRefreshTime = parseInt(lastRefresh);
          // Only refresh if more than 5 minutes since last refresh or if time is invalid
          shouldRefresh = !lastRefreshTime || isNaN(lastRefreshTime) || (now - lastRefreshTime > 5 * 60 * 1000);
        }

        // Only proceed if component is still mounted
        if (!isMounted) return;

        if (shouldRefresh) {
          if (shouldLog) {
            authDebug.debug('Refreshing events data (> 5 minutes since last refresh)');
          }

          try {
            await refetchEvents();

            // Only proceed if component is still mounted
            if (!isMounted) return;

            await AsyncStorage.setItem('lastEventRefresh', now.toString());
            if (shouldLog) {
              authDebug.debug('Events refreshed and timestamp updated');
            }
          } catch (refreshError) {
            if (isMounted) {
              authDebug.error('Failed to refresh events:', refreshError);
            }
          }
        } else if (shouldLog) {
          authDebug.debug('Using cached events data (< 5 minutes since last refresh)');
        }
      } catch (error) {
        // Only proceed if component is still mounted
        if (!isMounted) return;

        // If there's an error with AsyncStorage, try to refresh the data
        authDebug.error('Error with AsyncStorage:', error);

        try {
          await refetchEvents();
        } catch (refreshError) {
          if (isMounted) {
            authDebug.error('Failed to refresh events:', refreshError);
          }
        }
      }
    };

    // Execute the refresh function
    refreshDataIfNeeded();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };

    // Explicitly declare the dependency on refetchEvents to avoid issues
  }, [eventsContext, refetchEvents]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row justify-between items-center p-4">
        <Text className="text-2xl font-rubik-semibold text-black-300">
          Calendar
        </Text>
        <View className="flex-row">
          {/* View mode switcher */}
          {viewModes.map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-full mx-1 ${viewMode === mode ? 'bg-primary-300' : 'bg-gray-200'
                }`}
            >
              <Text
                className={`font-rubik ${viewMode === mode ? 'text-white' : 'text-black-300'
                  }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Calendar component */}
      <View style={{ flex: 1 }}>
      <BigCalendar
        events={calendarEvents as any[]}
        mode={viewMode}
        date={date}
        onPressCell={handleCellPress}
        onPressEvent={handlePressEvent}
        renderEvent={renderEvent}
        swipeEnabled={true}
        overlapOffset={8}
      />
      </View>

      {/* Add Event FAB */}
      <TouchableOpacity
        className="absolute bottom-8 right-8 bg-primary-300 w-16 h-16 rounded-full items-center justify-center"
        onPress={() => {
          setSelectedDateTime(new Date().toISOString());
          setEditingEvent(null);
          setFormVisible(true);
        }}
      >
        <Text className="text-white text-2xl">+</Text>
      </TouchableOpacity>

      {/* Event Form Modal */}
      {formVisible && (
        <EventForm
          visible={formVisible}
          onClose={() => setFormVisible(false)}
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
              refetchEvents();
            }
          }}
          onNotAttend={() => {
            // Handle not attend logic
            setDetailsModalVisible(false);
            if (eventsContext) {
              refetchEvents();
            }
          }}
          currentUserId={currentUser?.$id || ''}
        />
      )}
    </SafeAreaView>
  );
}
