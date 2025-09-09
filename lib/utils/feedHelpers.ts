/**
 * Feed Events Processing Utilities
 * 
 * Simplified event processing for the Feed component that relies on
 * the unified creator info management system.
 */

import { Event as AppEvent } from '@/lib/types/Events';

// Extended event type for Feed component
export type ExtendedEvent = AppEvent & { 
  attendees?: string[]; 
  inviteeIds?: string[]; 
  isAttending?: boolean; 
  attendeeCount?: number; 
  creatorName?: string; // Keep for backward compatibility
};

/**
 * Process events for Feed display
 * This function simplifies the complex logic in Feed by focusing on
 * core event processing without embedded creator fetching
 */
export const processFeedEvents = async (
  events: AppEvent[],
  attendingEventIds: Set<string>,
  attendeesMap: Record<string, string[]> = {}
): Promise<ExtendedEvent[]> => {
  const now = new Date();

  return await Promise.all(
    events
      .filter((event) => {
        // Only show future events
        const eventEndTime = new Date(event.endTime || event.startTime);
        return eventEndTime >= now;
      })
      .map(async (event) => {
        const isAttending = attendingEventIds.has(event.$id);
        
        // Get attendees list (prefer junction table over legacy in-document)
        let attendeesList: string[] = [];
        const junctionAttendees = Array.isArray(attendeesMap[event.$id]) 
          ? attendeesMap[event.$id] 
          : [];
        
        if (junctionAttendees.length > 0) {
          attendeesList = junctionAttendees;
        } else {
          // Fallback to legacy attendees if available
          attendeesList = Array.isArray(event.attendees) ? event.attendees : [];
        }
        
        // Calculate attendee count
        let attendeeCount: number;
        if (typeof event.attendeeCount === 'number') {
          attendeeCount = event.attendeeCount;
        } else if (junctionAttendees.length > 0) {
          attendeeCount = junctionAttendees.length;
        } else if (Array.isArray(event.attendees)) {
          attendeeCount = event.attendees.length;
        } else {
          attendeeCount = 0;
        }

        return {
          ...(event as unknown as AppEvent),
          isAttending,
          attendees: attendeesList,
          attendeeCount,
          // Note: creatorName will be populated by the unified creator system
          creatorName: undefined, // Let the creator manager handle this
        } as ExtendedEvent;
      })
  );
};

/**
 * Filter events to show only non-attending events (core Feed logic)
 */
export const filterNonAttendingEvents = (events: ExtendedEvent[]): ExtendedEvent[] => {
  return events.filter((event) => !event.isAttending);
};

/**
 * Apply real-time UI overlay to events
 * This handles pending attend/unattend actions for immediate UI feedback
 */
export const applyRealTimeUIOverlay = (
  baseEvents: ExtendedEvent[],
  pendingAttendIds: Set<string>,
  pendingUnattendIds: Set<string>,
  allEventsForUnattend: ExtendedEvent[] = []
): ExtendedEvent[] => {
  // Start with base events, filter out those with pending attend
  let filteredEvents = baseEvents.filter(event => !pendingAttendIds.has(event.$id));
  
  // Add back events with pending unattend from the global context
  if (pendingUnattendIds.size > 0) {
    const eventsToAddBack = allEventsForUnattend.filter(event => 
      pendingUnattendIds.has(event.$id) &&
      !filteredEvents.some(existing => existing.$id === event.$id)
    );
    filteredEvents = [...filteredEvents, ...eventsToAddBack];
  }
  
  return filteredEvents;
};

/**
 * Get unique creator IDs from a list of events
 */
export const extractCreatorIds = (events: ExtendedEvent[]): string[] => {
  const ids = events
    .map((event) => event.creatorId)
    .filter((id): id is string => Boolean(id));
  
  return [...new Set(ids)];
};
