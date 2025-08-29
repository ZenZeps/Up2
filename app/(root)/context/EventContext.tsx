// context/EventContext.tsx
import { createEvent as createEventAPI, fetchUserEvents, updateEvent as updateEventAPI } from '@/lib/api/event';
import { config, databases, ID } from '@/lib/appwrite/appwrite';
import { invalidateCache, useAppwrite } from '@/lib/appwrite/useAppwrite';
import { authDebug } from '@/lib/debug/authDebug';
import { cacheManager } from '@/lib/debug/cacheManager';
import { useGlobalContext } from '@/lib/global-provider';
import { Event } from '@/lib/types/Events';
import { requestDeduplicator } from '@/lib/utils/dbOptimization';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface EventsContextType {
  events: Event[];
  loading: boolean;
  addEvent: (event: Omit<Event, '$id'>) => Promise<any>; // Changed to any to match Models.Document return
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

  // Create a wrapper function that matches the expected signature with deduplication
  const fetchEventsForUser = useCallback(
    (params?: { userId: string }) => {
      if (!params?.userId) {
        return Promise.resolve([]);
      }

      // Use request deduplication for scalability
      return requestDeduplicator.deduplicate(
        `fetchUserEvents-${params.userId}`,
        () => fetchUserEvents(params.userId)
      );
    },
    []
  );

  // Use our optimized hook with user-specific caching and smart TTL for scalability
  const {
    data: fetchedEvents,
    loading,
    refetch
  } = useAppwrite({
    fn: fetchEventsForUser,
    params: { userId: userId! }, // Pass userId as parameter
    cacheKey: userId ? `events-user-${userId}` : undefined, // User-specific cache key
    cacheTTL: 5 * 60 * 1000, // 5 minute cache for events to reduce frequent reloads
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

  // Preload cached events (if available) to avoid unnecessary network fetches on navigation
  React.useEffect(() => {
    if (!userId) return;

    try {
      const cached = cacheManager.get<any[]>(`events-user-${userId}`);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        authDebug.debug(`EventContext: Preloading ${cached.length} cached events for user ${userId}`);
        const sanitizedEvents = cached.map(event => ({
          ...event,
          // Legacy arrays removed from central Event type. Keep tags normalized for UI code that expects it.
          tags: Array.isArray(event.tags) ? event.tags : []
        } as any));
        setEvents(sanitizedEvents);
        // Mark we had an initial load so smartRefetch may respect intervals
        // Note: hasInitialLoad is local to Home; EventContext doesn't track it here
      }
    } catch (err) {
      authDebug.debug('EventContext: no cached events available on preload', err);
    }
  }, [userId]);

  // Update local state when fetched events change
  React.useEffect(() => {
    authDebug.info('EventContext: fetchedEvents changed', {
      hasEvents: !!fetchedEvents,
      eventsCount: fetchedEvents?.length || 0,
      userId
    });
    if (fetchedEvents && Array.isArray(fetchedEvents)) {
      // Ensure events have normalized tags; do not inject legacy arrays here.
      const sanitizedEvents = fetchedEvents.map(event => ({
        ...event,
        tags: Array.isArray(event.tags) ? event.tags : []
      } as any));
      setEvents(sanitizedEvents as any[]);
    } else if (!loading && userId) {
      // If we have a user but no events and not loading, it means no events found
      setEvents([]);
    }
  }, [fetchedEvents, userId, loading]);

  // Refetch events and invalidate cache
  const refetchEvents = useCallback(async () => {
    if (!userId) return;

    // Deduplicate concurrent refetch calls for the same user to avoid duplicate updates
    return requestDeduplicator.deduplicate(`refetchEvents-${userId}`, async () => {
      authDebug.info(`Refetching events for user: ${userId}`);
      invalidateCache(`events-user-${userId}`); // Invalidate user-specific cache (exact key)
      await refetch();
    });
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

      // Create in database using API function that handles all required fields
      const newEvent = await createEventAPI({
        ...eventData,
        id: uniqueId,
        $id: uniqueId
      } as Event);

      authDebug.info('Event added successfully', { eventId: newEvent.$id });

      // Invalidate user-specific cache to ensure data consistency
      if (userId) {
        invalidateCache(`user-events-${userId}`);
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

      // Update in database using our API function that handles required fields
      await updateEventAPI(eventData.$id, eventData);

      authDebug.info('Event updated successfully', { eventId: eventData.$id });

      // Invalidate user-specific event cache
      if (user?.$id) {
        invalidateCache(`events-user-${user.$id}`);
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
        invalidateCache(`events-user-${user.$id}`);
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
