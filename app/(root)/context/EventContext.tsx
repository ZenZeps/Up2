// context/EventContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Event } from '../types/Events';

// Placeholder: Replace with real user auth system
const getCurrentUserId = () => 'CURRENT_USER_ID'; // Replace with real auth call

interface EventsContextType {
  events: Event[];
  addEvent: (event: Event) => void;
  updateEvent: (event: Event) => void;
  deleteEvent: (id: string) => void;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export const EventsProvider = ({ children }: { children: React.ReactNode }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const currentUserId = getCurrentUserId();

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

  // Optionally filter events to show only owned/invited ones
  const filteredEvents = events.filter(
    (event) =>
      event.creatorId === currentUserId ||
      event.inviteeIds?.includes(currentUserId)
  );

  // For future: load events from backend (e.g., Appwrite)
  useEffect(() => {
    // fetchEvents().then(fetched => setEvents(fetched));
  }, []);

  return (
    <EventsContext.Provider
      value={{
        events: filteredEvents,
        addEvent,
        updateEvent,
        deleteEvent,
      }}
    >
      {children}
    </EventsContext.Provider>
  );
};

export const useEvents = () => {
  const context = useContext(EventsContext);
  if (!context) throw new Error('useEvents must be used within EventsProvider');
  return context;
};


