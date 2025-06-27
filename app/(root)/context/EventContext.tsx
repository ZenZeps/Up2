// context/EventContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Event } from '../types/Events';
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
  const [events, setEvents] = useState<Event[]>([]);

  // Fetch events from Appwrite
const refetchEvents = async () => {
  const fetched = await fetchEvents();
  console.log('Fetched events:', fetched); // <-- Add this line
  setEvents(fetched);
};

  useEffect(() => {
    refetchEvents();
  }, []);

  const addEvent = (event: Event) => {
    setEvents(prev => [...prev, event]);
  };

  const updateEvent = (updatedEvent: Event) => {
    setEvents(prev =>
      prev.map(e => (e.id === updatedEvent.id ? updatedEvent : e))
    );
  };

  const deleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
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
