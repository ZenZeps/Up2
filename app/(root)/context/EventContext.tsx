// context/EventContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Event } from '@/lib/types/Events';
import { fetchEvents } from '@/lib/api/event'; // <-- import fetchEvents

// Placeholder: Replace with real user auth system
const getCurrentUserId = () => 'CURRENT_USER_ID'; // Replace with real auth call

interface EventsContextType {
  events: Event[];
  addEvent: (event: Event) => void;
  updateEvent: (event: Event) => void;
  deleteEvent: (id: string) => void;
  refetchEvents: () => Promise<void>; // <-- Add this line
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

// ...existing code...

export const EventsProvider = ({ children }: { children: React.ReactNode }) => {
  console.log('EventsProvider rendering');
  const [events, setEvents] = useState<Event[]>([]);

  // Fetch events from Appwrite
const refetchEvents = async () => {
  const fetched = await fetchEvents();
  console.log('Fetched events:', fetched); // <-- Add this line
  setEvents(fetched as Event[]);
};

  useEffect(() => {
    refetchEvents();
  }, []);

  const addEvent = async (eventData: Omit<Event, '$id'>) => {
    try {
      const newEvent = await databases.createDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        ID.unique(),
        eventData
      );
      setEvents((prev) => [...prev, { ...eventData, $id: newEvent.$id }]);
    } catch (err) {
      console.error('Failed to add event:', err);
    }
  };

  const updateEvent = async (eventId: string, eventData: Partial<Event>) => {
    try {
      const updatedEvent = await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        eventId,
        eventData
      );
      setEvents((prev) =>
        prev.map((e) => (e.$id === eventId ? { ...e, ...eventData, $id: updatedEvent.$id } : e))
      );
    } catch (err) {
      console.error('Failed to update event:', err);
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      await databases.deleteDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        eventId
      );
      setEvents((prev) => prev.filter((e) => e.$id !== eventId));
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  // Show all events (no filtering)
  return (
    <EventsContext.Provider
      value={{
        events, // <-- use all events
        addEvent,
        updateEvent,
        deleteEvent,
        refetchEvents,
      }}
    >
      {children}
    </EventsContext.Provider>
  );
};
// ...existing code...

export const useEvents = () => {
  const context = useContext(EventsContext);
  if (!context) throw new Error('useEvents must be used within EventsProvider');
  return context;
};



export default EventsProvider;
