// context/EventsContext.tsx
import React, { createContext, useContext, useState } from 'react';
import { Event } from '../types/Events';

interface EventsContextType {
  events: Event[];
  addEvent: (event: Event) => void;
  updateEvent: (event: Event) => void;
  deleteEvent: (id: string) => void;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export const EventsProvider = ({ children }: { children: React.ReactNode }) => {
  const [events, setEvents] = useState<Event[]>([]);

  const addEvent = (event: Event) => setEvents([...events, event]);
  const updateEvent = (event: Event) =>
    setEvents(events.map((e) => (e.id === event.id ? event : e)));
  const deleteEvent = (id: string) =>
    setEvents(events.filter((e) => e.id !== id));

  return (
    <EventsContext.Provider value={{ events, addEvent, updateEvent, deleteEvent }}>
      {children}
    </EventsContext.Provider>
  );
};

export const useEvents = () => {
  const context = useContext(EventsContext);
  if (!context) throw new Error('useEvents must be used within EventsProvider');
  return context;
};
