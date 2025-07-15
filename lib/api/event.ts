import { config, databases } from "@/lib/appwrite/appwrite";
import { Event } from "@/lib/types/Events";
import { ID, Query } from "react-native-appwrite";
import { authDebug } from "../debug/authDebug";
import { cacheManager } from "../debug/cacheManager";

// Cache constants
const EVENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const EVENT_COLLECTION_CACHE_KEY = 'all-events';

/**
 * Fetch all events with caching
 */
export async function fetchEvents(): Promise<Event[]> {
  // Check cache first
  const cachedEvents = cacheManager.get<Event[]>(EVENT_COLLECTION_CACHE_KEY);
  if (cachedEvents) {
    authDebug.debug('Returning cached events', { count: cachedEvents.length });
    return cachedEvents;
  }

  authDebug.info('Fetching events from database');

  try {
    const res = await databases.listDocuments(
      config.databaseID!,
      config.eventsCollectionID!
    );

    const events = res.documents.map((doc): Event => {
      // Validate date formats
      let startTime = doc.startTime;
      let endTime = doc.endTime;

      // Ensure dates are valid ISO strings
      try {
        if (startTime && !isNaN(new Date(startTime).getTime())) {
          // Already valid
        } else {
          authDebug.warn(`Event ${doc.$id} has invalid startTime: ${startTime}, using current date`);
          startTime = new Date().toISOString();
        }

        if (endTime && !isNaN(new Date(endTime).getTime())) {
          // Already valid
        } else {
          authDebug.warn(`Event ${doc.$id} has invalid endTime: ${endTime}, using startTime + 1 hour`);
          const end = new Date(new Date(startTime).getTime() + 60 * 60 * 1000);
          endTime = end.toISOString();
        }
      } catch (e) {
        authDebug.error(`Error parsing event dates for event ${doc.$id}:`, e);
        // Set default dates
        startTime = new Date().toISOString();
        endTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      }

      return {
        $id: doc.$id,
        title: doc.title || 'Untitled Event',
        location: doc.location || 'No location',
        startTime,
        endTime,
        creatorId: doc.creatorId,
        inviteeIds: Array.isArray(doc.inviteeIds) ? doc.inviteeIds : [],
        description: doc.description || '',
        attendees: Array.isArray(doc.attendees) ? doc.attendees : [],
        tags: Array.isArray(doc.tags) ? doc.tags : [], // Include tags field
      };
    });

    // Cache individual events
    events.forEach(event => {
      cacheManager.set<Event>(`event-${event.$id}`, event, EVENT_CACHE_TTL);
    });

    // Cache the whole collection
    cacheManager.set<Event[]>(EVENT_COLLECTION_CACHE_KEY, events, EVENT_CACHE_TTL);

    return events;
  } catch (error) {
    authDebug.error('Error fetching events:', error);
    return [];
  }
}

/**
 * Fetch a single event by ID with caching
 */
export async function fetchEventById(id: string): Promise<Event | null> {
  // Check cache first
  const cacheKey = `event-${id}`;
  const cachedEvent = cacheManager.get<Event>(cacheKey);
  if (cachedEvent) {
    authDebug.debug(`Returning cached event: ${id}`);
    return cachedEvent;
  }

  try {
    authDebug.debug(`Fetching event by ID: ${id}`);
    const doc = await databases.getDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      id
    );

    const event = {
      $id: doc.$id,
      title: doc.title,
      location: doc.location,
      startTime: doc.startTime,
      endTime: doc.endTime,
      creatorId: doc.creatorId,
      inviteeIds: doc.inviteeIds || [],
      description: doc.description || '',
      attendees: doc.attendees || [],
      tags: Array.isArray(doc.tags) ? doc.tags : [], // Include tags field
    };

    // Cache the event
    cacheManager.set<Event>(cacheKey, event, EVENT_CACHE_TTL);

    return event;
  } catch (err) {
    authDebug.error(`Error fetching event by ID: ${id}`, err);
    return null;
  }
}

/**
 * Get all events (alias for fetchEvents)
 */
export async function getAllEvents() {
  return fetchEvents();
}

/**
 * Get event by ID (alias for fetchEventById)
 */
export async function getEventById(id: string) {
  return fetchEventById(id);
}

/**
 * Create a new event
 */
export async function createEvent(event: Event) {
  try {
    authDebug.info('Creating new event', { title: event.title });

    const res = await databases.createDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      event.$id || ID.unique(),
      event
    );

    // Invalidate cache
    cacheManager.remove(EVENT_COLLECTION_CACHE_KEY);

    // Cache the new event
    cacheManager.set<Event>(`event-${res.$id}`, {
      ...event,
      $id: res.$id,
    }, EVENT_CACHE_TTL);

    authDebug.info("Created event successfully", { id: res.$id });
    return res;
  } catch (err) {
    authDebug.error("Error creating event:", err);
    throw new Error("Failed to create event");
  }
}

/**
 * Update an existing event
 */
export async function updateEvent(id: string, eventData: Partial<Event>) {
  try {
    authDebug.info(`Updating event: ${id}`);

    const res = await databases.updateDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      id,
      eventData
    );

    // Invalidate caches
    cacheManager.remove(`event-${id}`);
    cacheManager.remove(EVENT_COLLECTION_CACHE_KEY);

    authDebug.info("Updated event successfully", { id });
    return res;
  } catch (err) {
    authDebug.error(`Error updating event: ${id}`, err);
    throw new Error("Failed to update event");
  }
}

/**
 * Delete an event
 */
export async function deleteEvent(id: string) {
  try {
    authDebug.info(`Deleting event: ${id}`);

    await databases.deleteDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      id
    );

    // Invalidate caches
    cacheManager.remove(`event-${id}`);
    cacheManager.remove(EVENT_COLLECTION_CACHE_KEY);

    authDebug.info("Deleted event successfully", { id });
    return true;
  } catch (err) {
    authDebug.error(`Error deleting event: ${id}`, err);
    throw new Error("Failed to delete event");
  }
}

/**
 * Fetch events for a specific user (attending or created)
 * This is more efficient than fetching all events and filtering client-side
 */
export async function fetchUserEvents(userId: string): Promise<Event[]> {
  const cacheKey = `events-user-${userId}`;
  const cachedEvents = cacheManager.get<Event[]>(cacheKey);

  if (cachedEvents) {
    authDebug.debug(`Returning cached user events for: ${userId}`);
    return cachedEvents;
  }

  try {
    authDebug.info(`Fetching events for user: ${userId}`);
    authDebug.debug(`Using cache key: ${cacheKey}`);

    // Query for events where user is creator OR attendee OR invitee
    // Since Appwrite might not support OR queries well, we'll fetch separately and merge
    const [creatorEvents, attendeeEvents, inviteeEvents] = await Promise.all([
      // Events where user is creator
      databases.listDocuments(
        config.databaseID!,
        config.eventsCollectionID!,
        [Query.equal('creatorId', userId)]
      ),
      // Events where user is in attendees (if it's a simple array)
      databases.listDocuments(
        config.databaseID!,
        config.eventsCollectionID!,
        [Query.search('attendees', userId)]
      ).catch(() => ({ documents: [] })), // Fallback if search fails
      // Events where user is in inviteeIds
      databases.listDocuments(
        config.databaseID!,
        config.eventsCollectionID!,
        [Query.search('inviteeIds', userId)]
      ).catch(() => ({ documents: [] })) // Fallback if search fails
    ]);

    // Merge and deduplicate events
    const allDocuments = [
      ...creatorEvents.documents,
      ...attendeeEvents.documents,
      ...inviteeEvents.documents
    ];

    // Remove duplicates based on $id
    const uniqueDocuments = allDocuments.filter((doc, index, self) =>
      self.findIndex(d => d.$id === doc.$id) === index
    );

    const events = uniqueDocuments.map((doc: any): Event => ({
      $id: doc.$id,
      title: doc.title,
      location: doc.location,
      startTime: doc.startTime,
      endTime: doc.endTime,
      creatorId: doc.creatorId,
      inviteeIds: doc.inviteeIds || [],
      description: doc.description || '',
      attendees: doc.attendees || [],
      tags: Array.isArray(doc.tags) ? doc.tags : [], // Include tags field
    }));

    // Cache user events
    cacheManager.set<Event[]>(cacheKey, events, EVENT_CACHE_TTL);

    authDebug.info(`Successfully fetched ${events.length} events for user: ${userId}`);

    // Also cache individual events
    events.forEach((event: Event) => {
      cacheManager.set<Event>(`event-${event.$id}`, event, EVENT_CACHE_TTL);
    });

    return events;
  } catch (err) {
    authDebug.error(`Error fetching user events for: ${userId}`, err);
    return [];
  }
}