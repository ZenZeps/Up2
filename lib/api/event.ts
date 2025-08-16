import { config, databases } from "@/lib/appwrite/appwrite";
import { Event } from "@/lib/types/Events";
import { ID, Query } from "react-native-appwrite";
import { authDebug } from "../debug/authDebug";
import { cacheManager } from "../debug/cacheManager";
import { sendEventInviteNotification } from "../notifications/notificationUtils";
import { getGroupById } from "./group";
import { getUserProfile } from "./user";

// Cache constants
const EVENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const EVENT_COLLECTION_CACHE_KEY = 'all-events';

/**
 * Enrich events with group names
 */
export async function enrichEventsWithGroupNames(events: Event[]): Promise<Event[]> {
  try {
    const enrichedEvents = await Promise.all(
      events.map(async (event) => {
        if (event.groupId) {
          try {
            const group = await getGroupById(event.groupId);
            return {
              ...event,
              groupName: group?.title || undefined
            };
          } catch (error) {
            authDebug.warn(`Failed to fetch group for event ${event.$id}:`, error);
            return event;
          }
        }
        return event;
      })
    );

    return enrichedEvents;
  } catch (error) {
    authDebug.error('Error enriching events with group names:', error);
    return events; // Return original events if enrichment fails
  }
}

/**
 * Fetch all events with caching and group names
 */
export async function fetchEventsWithGroupNames(): Promise<Event[]> {
  const events = await fetchEvents();
  return await enrichEventsWithGroupNames(events);
}

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
      config.eventsCollectionID!,
      [
        // SCALABILITY FIX: Add query limits and filters
        Query.limit(100), // Limit to 100 most recent events
        Query.orderDesc('$createdAt'), // Most recent first
        Query.greaterThan('endTime', new Date().toISOString()) // Only future events
      ]
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
        inviteeIds: [], // Will be populated from junction table
        description: doc.description || '',
        attendees: [], // Will be populated from junction table
        tags: Array.isArray(doc.tags) ? doc.tags : [], // Include tags field
        // Include new optimized fields
        attendeeCount: doc.attendeeCount || 0,
        inviteCount: doc.inviteCount || 0,
        viewCount: doc.viewCount || 0,
        popularityScore: doc.popularityScore || 0.0,
      };
    });

    // Enhance events with junction table data for app compatibility
    const enhancedEvents = await Promise.all(events.map(async (event) => {
      try {
        // Get attendees and invitees from junction tables in parallel
        const [attendees, inviteeIds] = await Promise.all([
          getEventAttendees(event.$id),
          getEventInvitees(event.$id)
        ]);

        // Return event with reconstructed arrays for app compatibility
        return {
          ...event,
          attendees,
          inviteeIds,
        };
      } catch (error) {
        // If junction table lookup fails, use empty arrays
        authDebug.warn(`Failed to load relationships for event ${event.$id}:`, error);
        return {
          ...event,
          attendees: [],
          inviteeIds: [],
        };
      }
    }));

    // Cache individual events (with junction table data)
    enhancedEvents.forEach(event => {
      cacheManager.set<Event>(`event-${event.$id}`, event, EVENT_CACHE_TTL);
    });

    // Cache the whole collection
    cacheManager.set<Event[]>(EVENT_COLLECTION_CACHE_KEY, enhancedEvents, EVENT_CACHE_TTL);

    return enhancedEvents;
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

    const baseEvent = {
      $id: doc.$id,
      title: doc.title,
      location: doc.location,
      startTime: doc.startTime,
      endTime: doc.endTime,
      creatorId: doc.creatorId,
      inviteeIds: [], // Will be populated from junction table
      description: doc.description || '',
      attendees: [], // Will be populated from junction table
      tags: Array.isArray(doc.tags) ? doc.tags : [], // Include tags field
      // Include optimized fields
      attendeeCount: doc.attendeeCount || 0,
      inviteCount: doc.inviteCount || 0,
      viewCount: doc.viewCount || 0,
      popularityScore: doc.popularityScore || 0.0,
    };

    // Get attendees and invitees from junction tables
    const [attendees, inviteeIds] = await Promise.all([
      getEventAttendees(id),
      getEventInvitees(id)
    ]);

    const event = {
      ...baseEvent,
      attendees,
      inviteeIds,
    };

    // Cache the enhanced event
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
 * Create a new event with comprehensive error handling
 */
export async function createEvent(event: Event) {
  try {
    // Comprehensive input validation
    if (!event) {
      throw new Error('Event data is required');
    }

    if (!event.title || typeof event.title !== 'string' || !event.title.trim()) {
      throw new Error('Event title is required and must be a non-empty string');
    }

    if (!event.startTime || !event.endTime) {
      throw new Error('Start time and end time are required');
    }

    if (!event.creatorId || typeof event.creatorId !== 'string') {
      throw new Error('Creator ID is required and must be a string');
    }

    // Validate dates
    const startDate = new Date(event.startTime);
    const endDate = new Date(event.endTime);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format provided');
    }

    if (startDate >= endDate) {
      throw new Error('End time must be after start time');
    }

    // Validate arrays
    if (event.inviteeIds && !Array.isArray(event.inviteeIds)) {
      throw new Error('Invitee IDs must be an array');
    }

    if (event.attendees && !Array.isArray(event.attendees)) {
      throw new Error('Attendees must be an array');
    }

    if (event.tags && !Array.isArray(event.tags)) {
      throw new Error('Tags must be an array');
    }

    // Sanitize and prepare data with new required fields
    const sanitizedEvent = {
      ...event,
      title: event.title.trim(),
      location: event.location?.trim() || '',
      description: event.description?.trim() || '',
      creatorId: event.creatorId,
      startTime: event.startTime,
      endTime: event.endTime,
      isPrivate: event.isPrivate || false,

      // ✅ NEW: Required fields for optimized database
      id: event.$id || ID.unique(), // Required id field
      attendeeCount: event.attendees?.length || 0, // Count from attendees array
      inviteCount: event.inviteeIds?.length || 0, // Count from inviteeIds array
      viewCount: 0, // Start with 0 views
      popularityScore: 0.0, // Start with 0.0 popularity
      responseRate: true, // Default to true
      lastActivtyAt: new Date().toISOString(), // Current timestamp

      // Optional fields - set defaults since they don't exist in Event type yet
      locationLat: 0.0, // Default location coordinates
      locationLng: 0.0,
      searchKeywords: [], // Default empty array
      categoryTags: [], // Default empty array

      // Array fields (keep these if they exist in schema, remove if they cause errors)
      tags: event.tags?.filter(tag => tag && typeof tag === 'string') || [],
    };

    // Remove legacy fields that no longer exist in the optimized database schema
    delete (sanitizedEvent as any).inviteeIds;
    delete (sanitizedEvent as any).attendees;
    delete (sanitizedEvent as any).isAttending;

    authDebug.debug('Creating event with data:', sanitizedEvent);

    // Validate config before making API call
    if (!config.databaseID || !config.eventsCollectionID) {
      console.warn('Database configuration is missing, using fallbacks');
    }

    // Create the event
    const createdEvent = await databases.createDocument(
      config.databaseID,
      config.eventsCollectionID,
      sanitizedEvent.$id || ID.unique(),
      sanitizedEvent
    );

    authDebug.info('Event created successfully:', createdEvent.$id);

    // Cache the created event
    cacheManager.set(`event-${createdEvent.$id}`, createdEvent, EVENT_CACHE_TTL);

    // Clear the all-events cache to force refresh
    cacheManager.remove(EVENT_COLLECTION_CACHE_KEY);

    // Send notifications to invitees if there are any
    if (sanitizedEvent.inviteeIds && sanitizedEvent.inviteeIds.length > 0) {
      try {
        // Get creator's profile to get their name for the notification
        const creatorProfile = await getUserProfile(sanitizedEvent.creatorId);
        const creatorName = creatorProfile
          ? `${creatorProfile.firstName} ${creatorProfile.lastName}`.trim()
          : 'Someone';

        // Send notifications to all invitees
        await sendEventInviteNotification(
          sanitizedEvent.inviteeIds,
          sanitizedEvent.title,
          creatorName,
          createdEvent.$id
        );

        authDebug.info(`Event invite notifications sent to ${sanitizedEvent.inviteeIds.length} users`);
      } catch (notificationError) {
        // Don't fail event creation if notifications fail
        authDebug.warn('Failed to send event invite notifications:', notificationError);
      }
    }

    return createdEvent;

  } catch (error: any) {
    // Enhanced error logging with context
    const errorMessage = error?.message || 'Unknown error occurred';
    const errorContext = {
      function: 'createEvent',
      eventId: event?.$id,
      eventTitle: event?.title,
      creatorId: event?.creatorId,
      originalError: error,
    };

    authDebug.error('Failed to create event:', errorContext);

    // Clear caches on error to prevent stale data
    cacheManager.remove(EVENT_COLLECTION_CACHE_KEY);
    if (event?.$id) {
      cacheManager.remove(`event-${event.$id}`);
    }

    // Rethrow with more context
    throw new Error(`Failed to create event: ${errorMessage}`);
  }
}

/**
 * Update an existing event
 */
// ================== DATA MIGRATION UTILITIES ==================

/**
 * Migration utility: Convert legacy array data to junction tables
 * Use this ONCE to migrate existing events to the new relationship model
 */
export async function migrateLegacyEventRelationships() {
  authDebug.info('Starting legacy event relationship migration...');

  try {
    // Get all events without junction table filtering
    const response = await databases.listDocuments(
      config.databaseID!,
      config.eventsCollectionID!,
      [Query.limit(1000)] // Process in batches
    );

    const events = response.documents;
    let migrated = 0;
    let errors = 0;

    for (const event of events) {
      try {
        // Check if event has legacy attendees array
        if (event.attendees && Array.isArray(event.attendees) && event.attendees.length > 0) {
          authDebug.info(`Migrating attendees for event ${event.$id}: ${event.attendees.length} users`);

          for (const userId of event.attendees) {
            try {
              await addEventAttendee(event.$id, userId);
            } catch (error: any) {
              // Ignore duplicate errors - means already migrated
              if (!error.message?.includes('already exists')) {
                authDebug.warn(`Failed to migrate attendee ${userId} for event ${event.$id}:`, error);
              }
            }
          }
        }

        // Check if event has legacy inviteeIds array
        if (event.inviteeIds && Array.isArray(event.inviteeIds) && event.inviteeIds.length > 0) {
          authDebug.info(`Migrating invitees for event ${event.$id}: ${event.inviteeIds.length} users`);

          for (const userId of event.inviteeIds) {
            try {
              await addEventInvitation(event.$id, userId);
            } catch (error: any) {
              // Ignore duplicate errors - means already migrated
              if (!error.message?.includes('already exists')) {
                authDebug.warn(`Failed to migrate invitee ${userId} for event ${event.$id}:`, error);
              }
            }
          }
        }

        migrated++;
      } catch (error) {
        errors++;
        authDebug.error(`Failed to migrate event ${event.$id}:`, error);
      }
    }

    authDebug.info(`Migration complete: ${migrated} events processed, ${errors} errors`);
    return { migrated, errors, total: events.length };

  } catch (error) {
    authDebug.error('Migration failed:', error);
    throw error;
  }
}

// ================== JUNCTION TABLE MANAGEMENT ==================

/**
 * Add user to event attendees (junction table approach)
 */
export async function addEventAttendee(eventId: string, userId: string): Promise<boolean> {
  try {
    // Check if already attending
    const existingAttendance = await databases.listDocuments(
      config.databaseID!,
      'event_attendance', // Junction table
      [
        Query.equal('eventId', eventId),
        Query.equal('userId', userId)
      ]
    );

    if (existingAttendance.documents.length > 0) {
      authDebug.info(`User ${userId} already attending event ${eventId}`);
      return true;
    }

    // Create attendance record
    await databases.createDocument(
      config.databaseID!,
      'event_attendance',
      ID.unique(),
      {
        eventId,
        userId,
        joinedAt: new Date().toISOString(),
        status: 'attending'
      }
    );

    // Update event attendee count
    const currentEvent = await databases.getDocument(config.databaseID!, config.eventsCollectionID!, eventId);
    const newCount = (currentEvent.attendeeCount || 0) + 1;

    await databases.updateDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      eventId,
      {
        attendeeCount: newCount,
        lastActivtyAt: new Date().toISOString(),
      }
    );

    authDebug.info(`User ${userId} added to event ${eventId}, new count: ${newCount}`);
    return true;
  } catch (error) {
    authDebug.error(`Failed to add attendee to event: ${eventId}`, error);
    throw error;
  }
}

/**
 * Remove user from event attendees (junction table approach)
 */
export async function removeEventAttendee(eventId: string, userId: string): Promise<boolean> {
  try {
    // Find attendance record
    const attendanceRecords = await databases.listDocuments(
      config.databaseID!,
      'event_attendance',
      [
        Query.equal('eventId', eventId),
        Query.equal('userId', userId)
      ]
    );

    if (attendanceRecords.documents.length === 0) {
      authDebug.info(`User ${userId} not attending event ${eventId}`);
      return true;
    }

    // Remove attendance record
    for (const record of attendanceRecords.documents) {
      await databases.deleteDocument(
        config.databaseID!,
        'event_attendance',
        record.$id
      );
    }

    // Update event attendee count
    const currentEvent = await databases.getDocument(config.databaseID!, config.eventsCollectionID!, eventId);
    const newCount = Math.max(0, (currentEvent.attendeeCount || 0) - 1);

    await databases.updateDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      eventId,
      {
        attendeeCount: newCount,
        lastActivtyAt: new Date().toISOString(),
      }
    );

    authDebug.info(`User ${userId} removed from event ${eventId}, new count: ${newCount}`);
    return true;
  } catch (error) {
    authDebug.error(`Failed to remove attendee from event: ${eventId}`, error);
    throw error;
  }
}

/**
 * Add user to event invitations (junction table approach)
 */
export async function addEventInvitation(eventId: string, userId: string): Promise<boolean> {
  try {
    // Check if already invited
    const existingInvite = await databases.listDocuments(
      config.databaseID!,
      'event_invitations', // Junction table
      [
        Query.equal('eventId', eventId),
        Query.equal('userId', userId)
      ]
    );

    if (existingInvite.documents.length > 0) {
      authDebug.info(`User ${userId} already invited to event ${eventId}`);
      return true;
    }

    // Create invitation record
    await databases.createDocument(
      config.databaseID!,
      'event_invitations',
      ID.unique(),
      {
        eventId,
        userId,
        invitedAt: new Date().toISOString(),
        status: 'pending'
      }
    );

    // Update event invite count
    const currentEvent = await databases.getDocument(config.databaseID!, config.eventsCollectionID!, eventId);
    const newCount = (currentEvent.inviteCount || 0) + 1;

    await databases.updateDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      eventId,
      {
        inviteCount: newCount,
        lastActivtyAt: new Date().toISOString(),
      }
    );

    authDebug.info(`User ${userId} invited to event ${eventId}, new count: ${newCount}`);
    return true;
  } catch (error) {
    authDebug.error(`Failed to add invitation to event: ${eventId}`, error);
    throw error;
  }
}

/**
 * Get event attendees from junction table
 */
export async function getEventAttendees(eventId: string): Promise<string[]> {
  try {
    const attendanceRecords = await databases.listDocuments(
      config.databaseID!,
      'event_attendance',
      [
        Query.equal('eventId', eventId),
        Query.equal('status', 'attending'),
        Query.limit(1000) // Scalability limit
      ]
    );

    return attendanceRecords.documents.map((record: any) => record.userId);
  } catch (error) {
    authDebug.error(`Failed to get attendees for event: ${eventId}`, error);
    return [];
  }
}

/**
 * Get event invitees from junction table
 */
export async function getEventInvitees(eventId: string): Promise<string[]> {
  try {
    const invitationRecords = await databases.listDocuments(
      config.databaseID!,
      'event_invitations',
      [
        Query.equal('eventId', eventId),
        Query.equal('status', 'pending'),
        Query.limit(1000) // Scalability limit
      ]
    );

    return invitationRecords.documents.map((record: any) => record.userId);
  } catch (error) {
    authDebug.error(`Failed to get invitees for event: ${eventId}`, error);
    return [];
  }
}

/**
 * Handle event invitation (optimized database approach)
 * DEPRECATED: Use addEventInvitation() instead
 */
export async function inviteUserToEvent(eventId: string, userId: string) {
  return addEventInvitation(eventId, userId);
}

/**
 * Handle event attendance (optimized database approach)
 * DEPRECATED: Use addEventAttendee()/removeEventAttendee() instead
 */
export async function updateEventAttendance(eventId: string, userId: string, isAttending: boolean) {
  if (isAttending) {
    return addEventAttendee(eventId, userId);
  } else {
    return removeEventAttendee(eventId, userId);
  }
} export async function updateEvent(id: string, eventData: Partial<Event>) {
  try {
    authDebug.info(`Updating event: ${id}`);

    // Handle legacy array operations with proper junction table management
    if (eventData.attendees || (eventData as any).inviteeIds) {
      authDebug.info('Legacy array update detected, using junction table approach');

      // Handle attendees array update
      if (eventData.attendees && Array.isArray(eventData.attendees)) {
        // Get current attendees from junction table
        const currentAttendees = await getEventAttendees(id);
        const newAttendees = eventData.attendees;

        // Find users to add (in new but not in current)
        const toAdd = newAttendees.filter(userId => !currentAttendees.includes(userId));

        // Find users to remove (in current but not in new)
        const toRemove = currentAttendees.filter(userId => !newAttendees.includes(userId));

        // Execute changes
        for (const userId of toAdd) {
          await addEventAttendee(id, userId);
        }
        for (const userId of toRemove) {
          await removeEventAttendee(id, userId);
        }

        authDebug.info(`Updated attendees: +${toAdd.length}, -${toRemove.length}`);
      }

      // Handle invitees array update
      if ((eventData as any).inviteeIds && Array.isArray((eventData as any).inviteeIds)) {
        const newInvitees = (eventData as any).inviteeIds;

        // For invitations, we typically only add (don't remove existing invites)
        // But let's implement full sync for consistency
        const currentInvitees = await getEventInvitees(id);
        const toAdd = newInvitees.filter((userId: string) => !currentInvitees.includes(userId));

        // Execute additions
        for (const userId of toAdd) {
          await addEventInvitation(id, userId);
        }

        authDebug.info(`Updated invitees: +${toAdd.length}`);
      }

      return; // Exit early as we've handled the array updates
    }

    // Build sanitized data with computed fields (for non-array updates)
    const sanitizedEventData: any = { ...eventData };

    // Always ensure required fields are present
    if (sanitizedEventData.attendeeCount === undefined) {
      sanitizedEventData.attendeeCount = 0;
    }
    if (sanitizedEventData.inviteCount === undefined) {
      sanitizedEventData.inviteCount = 0;
    }

    // Always ensure these fields exist with defaults
    if (sanitizedEventData.viewCount === undefined) {
      sanitizedEventData.viewCount = 0;
    }
    if (sanitizedEventData.popularityScore === undefined) {
      sanitizedEventData.popularityScore = 0.0;
    }
    if (sanitizedEventData.responseRate === undefined) {
      sanitizedEventData.responseRate = true;
    }
    sanitizedEventData.lastActivtyAt = new Date().toISOString();

    // Remove legacy fields that no longer exist in the optimized database schema
    delete sanitizedEventData.inviteeIds;
    delete sanitizedEventData.attendees;
    delete sanitizedEventData.isAttending;

    const res = await databases.updateDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      id,
      sanitizedEventData
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