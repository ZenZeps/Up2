// context/EventContext.tsx
import { fetchUserEvents } from '@/lib/api/event';
import { config, databases, ID } from '@/lib/appwrite/appwrite';
import { invalidateCache, useAppwrite } from '@/lib/appwrite/useAppwrite';
import { authDebug } from '@/lib/debug/authDebug';
import { useGlobalContext } from '@/lib/global-provider';
import { Event } from '@/lib/types/Events';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface EventsContextType {
  events: Event[];
  loading: boolean;
  addEvent: (event: Event) => void;
  updateEvent: (event: Event) => void;
  deleteEvent: (id: string) => void;
  refetchEvents: () => Promise<void>;
}

export const EventsContext = createContext<EventsContextType | undefined>(undefined);

export const EventsProvider = ({ children }: { children: React.ReactNode }) => {
  // Get current user ID from global context
  const { user } = useGlobalContext();
  const userId = user?.$id;

  // Debug user changes
  React.useEffect(() => {
    authDebug.info('EventContext: User changed', {
      hasUser: !!user,
      userId: userId,
      userEmail: user?.email
    });
  }, [userId, user?.email]);

  // Create a wrapper function that matches the expected signature
  const fetchEventsForUser = useCallback(
    (params?: { userId: string }) => {
      if (!params?.userId) {
        return Promise.resolve([]);
      }
      return fetchUserEvents(params.userId);
    },
    []
  );

  // Use our optimized hook with user-specific caching
  const {
    data: fetchedEvents,
    loading,
    refetch
  } = useAppwrite({
    fn: fetchEventsForUser,
    params: { userId: userId! }, // Pass userId as parameter
    cacheKey: userId ? `events-user-${userId}` : undefined, // User-specific cache key
    cacheTTL: 5 * 60 * 1000, // 5 minutes cache
    dependencies: [userId], // Re-fetch when user changes
    skip: !userId // Skip if no user ID
  });

  // Local state to track events with optimistic updates
  const [events, setEvents] = useState<Event[]>([]);

  // Clear local state when user changes
  React.useEffect(() => {
    if (!userId) {
      authDebug.info('EventContext: User logged out, clearing local events');
      setEvents([]);
    }
  }, [userId]);

  // Update local state when fetched events change
  React.useEffect(() => {
    authDebug.info('EventContext: fetchedEvents changed', {
      hasEvents: !!fetchedEvents,
      eventsCount: fetchedEvents?.length || 0,
      userId
    });
    if (fetchedEvents) {
      setEvents(fetchedEvents);
    } else if (!loading && userId) {
      // If we have a user but no events and not loading, it means no events found
      setEvents([]);
    }
  }, [fetchedEvents, userId, loading]);

  // Refetch events and invalidate cache
  const refetchEvents = useCallback(async () => {
    if (!userId) return;

    authDebug.info(`Refetching events for user: ${userId}`);
    invalidateCache(new RegExp(`events-user-${userId}`)); // Invalidate user-specific cache
    await refetch();
  }, [refetch, userId]);

  // Add event with optimistic update
  const addEvent = async (eventData: Omit<Event, '$id'>) => {
    try {
      const uniqueId = ID.unique();

      // Optimistically update UI
      const optimisticEvent = {
        ...eventData,
        $id: uniqueId,
        id: uniqueId // Add the required id field for Appwrite
      } as Event;

      setEvents((prev) => [...prev, optimisticEvent]);

      // Create in database - ensure we include the id field
      const documentData = {
        ...eventData,
        id: uniqueId // Add the required id field for Appwrite
      };

      const newEvent = await databases.createDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        uniqueId,
        documentData
      );

      authDebug.info('Event added successfully', { eventId: newEvent.$id });

      // Invalidate user-specific cache to ensure data consistency
      if (userId) {
        invalidateCache(new RegExp(`user-events-${userId}`));
      }

      return newEvent;
    } catch (err) {
      authDebug.error('Failed to add event:', err);
      // On error, refetch to ensure UI is consistent
      refetchEvents();
      throw err;
    }
  };

  // Update event with optimistic update
  const updateEvent = async (eventData: Event) => {
    if (!eventData.$id) {
      authDebug.error('Cannot update event without ID');
      return;
    }

    try {
      // Optimistically update UI
      setEvents((prev) =>
        prev.map((e) => (e.$id === eventData.$id ? eventData : e))
      );

      // Update in database
      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        eventData.$id,
        eventData
      );

      authDebug.info('Event updated successfully', { eventId: eventData.$id });

      // Invalidate user-specific event cache
      if (user?.$id) {
        invalidateCache(new RegExp(`events-user-${user.$id}`));
      }
    } catch (err) {
      authDebug.error('Failed to update event:', err);
      // On error, refetch to ensure UI is consistent
      refetchEvents();
    }
  };

  // Delete event with optimistic update
  const deleteEvent = async (eventId: string) => {
    try {
      // Optimistically update UI
      setEvents((prev) => prev.filter((e) => e.$id !== eventId));

      // Delete from database
      await databases.deleteDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        eventId
      );

      authDebug.info('Event deleted successfully', { eventId });

      // Invalidate user-specific event cache
      if (user?.$id) {
        invalidateCache(new RegExp(`events-user-${user.$id}`));
      }
    } catch (err) {
      authDebug.error('Failed to delete event:', err);
      // On error, refetch to ensure UI is consistent
      refetchEvents();
    }
  };

  // Memoize the context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(() => ({
    events: Array.isArray(events) ? events : [],
    loading,
    addEvent,
    updateEvent,
    deleteEvent,
    refetchEvents,
  }), [events, loading, addEvent, updateEvent, deleteEvent, refetchEvents]);

  return (
    <EventsContext.Provider value={contextValue}>
      {children}
    </EventsContext.Provider>
  );
};

export const useEvents = () => {
  const context = useContext(EventsContext);
  if (!context) throw new Error('useEvents must be used within EventsProvider');
  return context;
};

export default EventsProvider;
