import { Event as AppEvent } from '@/lib/types/Events';

/**
 * Formats a date header for event grouping
 */
export function formatDateHeader(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
}

/**
 * Groups events by day for agenda view
 */
export function groupEventsByDay(events: AppEvent[]): Record<string, AppEvent[]> {
  return events.reduce((groups, event) => {
    const eventDate = new Date(event.startTime);
    const dateKey = eventDate.toDateString();

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }

    groups[dateKey].push(event);
    return groups;
  }, {} as Record<string, AppEvent[]>);
}

/**
 * Transforms grouped events into array format suitable for FlatList
 */
export function transformGroupedEventsForList(groupedEvents: Record<string, AppEvent[]>): Array<{ date: Date; events: AppEvent[] }> {
  return Object.entries(groupedEvents)
    .map(([dateString, events]) => ({
      date: new Date(dateString),
      events
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Filters and sorts upcoming events
 */
export function filterUpcomingEvents(events: any[]): any[] {
  const upcoming = events.filter((event: any) => {
    const eventEndTime = new Date(event.endTime || event.startTime);
    return eventEndTime > new Date();
  });

  // Sort by start time
  upcoming.sort((a: any, b: any) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return upcoming;
}

/**
 * Filters events with real-time UI updates applied
 * Removes pending unattends and adds pending attends
 */
export function mergeEventsWithRealTimeFiltering(
  baseEvents: any[],
  pendingUnattend: Set<string>,
  pendingAttend: Set<string>,
  globalEvents: any[]
): any[] {
  // Remove events with pending unattend actions
  let filtered = baseEvents.filter(event => !pendingUnattend.has(event.$id));

  // Add events with pending attend actions
  if (pendingAttend.size > 0 && globalEvents?.length > 0) {
    const toAdd = globalEvents.filter(ev => pendingAttend.has(ev.$id));
    const eventMap = new Map(filtered.map(e => [e.$id, e]));

    toAdd.forEach(event => {
      if (!eventMap.has(event.$id)) {
        filtered.push(event);
      }
    });
  }

  return filtered;
}

/**
 * Filters events by creator ID
 */
export function filterEventsByCreator(events: AppEvent[], creatorId: string): AppEvent[] {
  return events.filter((e: AppEvent) => e.creatorId === creatorId);
}

/**
 * Extracts unique creator IDs from events that are not in cache
 */
export function getUncachedCreatorIds(events: AppEvent[], creatorNameCache: Map<string, string>): string[] {
  return events
    .map((event: AppEvent) => event.creatorId)
    .filter(Boolean)
    .filter((id: string) => !creatorNameCache.has(id));
}
