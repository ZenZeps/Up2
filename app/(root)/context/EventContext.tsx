// context/EventContext.tsx
import { fetchEvents } from '@/lib/api/event';
import { config, databases, ID } from '@/lib/appwrite/appwrite';
import { invalidateCache, useAppwrite } from '@/lib/appwrite/useAppwrite';
import { authDebug } from '@/lib/debug/authDebug';
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
  // Use our optimized hook with proper caching
  const {
    data: fetchedEvents,
    loading,
    refetch
  } = useAppwrite({
    fn: fetchEvents,
    cacheKey: 'all-events',
    cacheTTL: 5 * 60 * 1000, // 5 minutes cache
    dependencies: [] // Empty array ensures it only runs once on mount
  });

  // Local state to track events with optimistic updates
  const [events, setEvents] = useState<Event[]>([]);

  // Update local state when fetched events change
  React.useEffect(() => {
    if (fetchedEvents) {
      setEvents(fetchedEvents);
    }
  }, [fetchedEvents]);

  // Refetch events and invalidate cache
  const refetchEvents = useCallback(async () => {
    authDebug.info('Refetching events and invalidating cache');
    invalidateCache(/events/); // Invalidate any events-related cache
    await refetch();
  }, [refetch]);

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

      // Invalidate cache to ensure data consistency
      invalidateCache(/events/);

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

      // Invalidate cache
      invalidateCache(/events/);
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

      // Invalidate cache
      invalidateCache(/events/);
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
