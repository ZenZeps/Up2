import { config, databases } from "@/lib/appwrite/appwrite";
import { Event } from "@/lib/types/Events";
import { ID, Query } from "react-native-appwrite";
import { authDebug } from "../debug/authDebug";
import { cacheManager } from "../debug/cacheManager";
import { sendEventInviteNotification } from "../notifications/notificationUtils";
import { getGroupById } from "./group";
import { getUserProfile } from "./user";

// Cache constants
const EVENT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes (increased to reduce reads)
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
        inviteeIds: doc.inviteeIds || [], // Keep original data
        description: doc.description || '',
        attendees: doc.attendees || [], // Keep original data
        tags: Array.isArray(doc.tags) ? doc.tags : [], // Include tags field
        isPrivate: doc.isPrivate || false, // Include privacy field
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
        const [junctionAttendees, junctionInviteeIds] = await Promise.all([
          getEventAttendees(event.$id),
          getEventInvitees(event.$id)
        ]);

        // Use junction table data if available, otherwise fallback to original document data
        return {
          ...event,
          attendees: junctionAttendees.length > 0 ? junctionAttendees : event.attendees,
          inviteeIds: junctionInviteeIds.length > 0 ? junctionInviteeIds : event.inviteeIds,
        };
      } catch (error) {
        // If junction table lookup fails, use original document data
        authDebug.warn(`Failed to load relationships for event ${event.$id}, using document data:`, error);
        return event;
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
      inviteeIds: doc.inviteeIds || [], // Keep original data
      description: doc.description || '',
      attendees: doc.attendees || [], // Keep original data
      tags: Array.isArray(doc.tags) ? doc.tags : [], // Include tags field
      isPrivate: doc.isPrivate || false, // Include privacy field
      // Include optimized fields
      attendeeCount: doc.attendeeCount || 0,
      inviteCount: doc.inviteCount || 0,
      viewCount: doc.viewCount || 0,
      popularityScore: doc.popularityScore || 0.0,
    };

    // Get attendees and invitees from junction tables
    const [junctionAttendees, junctionInviteeIds] = await Promise.all([
      getEventAttendees(id),
      getEventInvitees(id)
    ]);

    const event = {
      ...baseEvent,
      // Use junction table data if available, otherwise fallback to original document data
      attendees: junctionAttendees.length > 0 ? junctionAttendees : baseEvent.attendees,
      inviteeIds: junctionInviteeIds.length > 0 ? junctionInviteeIds : baseEvent.inviteeIds,
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

      // Optional fields - set defaults since they don't exist in Event type yet
      // locationLat/locationLng are optional fields not declared on the Event type
      locationLat: (event as any).locationLat ?? 0.0, // Default location coordinates
      locationLng: (event as any).locationLng ?? 0.0,
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

    // If a textual location is provided but no explicit coordinates, attempt to geocode it
    try {
      if (sanitizedEvent.location && (!sanitizedEvent.locationLat || !sanitizedEvent.locationLng)) {
        const { geocodeAddress } = await import('@/lib/utils/geocode');
        const coords = await geocodeAddress(sanitizedEvent.location);
        if (coords) {
          sanitizedEvent.locationLat = coords.latitude;
          sanitizedEvent.locationLng = coords.longitude;
        }
      }
    } catch (geocodeErr) {
      authDebug.warn('Geocoding failed or unavailable, continuing without coordinates', geocodeErr);
    }

    // Create the event
    const { createDocumentSafe } = await import('@/lib/appwrite/safeDb');
    const createdEvent = await createDocumentSafe(
      config.databaseID,
      config.eventsCollectionID,
      sanitizedEvent.$id || ID.unique(),
      sanitizedEvent
    );

    authDebug.info('Event created successfully:', createdEvent.$id);

    // IMPORTANT: Automatically mark the creator as attending their own event
    try {
      await addEventAttendee(createdEvent.$id, sanitizedEvent.creatorId);
      authDebug.info(`Creator ${sanitizedEvent.creatorId} automatically marked as attending event ${createdEvent.$id}`);
    } catch (attendeeError) {
      authDebug.warn('Failed to mark creator as attending their event:', attendeeError);
      // Don't fail event creation if attendance marking fails
    }

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
    const collectionId = config.eventAttendancesCollectionID;

    // Check if junction table is properly configured
    if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
      authDebug.info('Event attendances junction table not configured, skipping attendance recording');
      return false;
    }

    // Look for any existing attendance records for this user/event
    const existingAttendance = await databases.listDocuments(
      config.databaseID!,
      collectionId,
      [
        Query.equal('eventId', eventId),
        Query.equal('userId', userId)
      ]
    );

    // If an attending record already exists, nothing to do
    if (existingAttendance.documents.some((d: any) => d.status === 'attending')) {
      authDebug.info(`User ${userId} already attending event ${eventId}`);
      return true;
    }

    // If an invited/pending record exists, promote it to attending and update counts
    const invitedRecord = existingAttendance.documents.find((d: any) => d.status === 'invited' || d.status === 'pending');
    if (invitedRecord) {
      // Update the attendance record to attending
      await databases.updateDocument(
        config.databaseID!,
        collectionId,
        invitedRecord.$id,
        {
          status: 'attending',
          acceptedAt: new Date().toISOString(),
        }
      );

      // Update event counters: +1 attendee, -1 invite (if present)
      const currentEvent = await databases.getDocument(config.databaseID!, config.eventsCollectionID!, eventId);
      const newAttendeeCount = (currentEvent.attendeeCount || 0) + 1;
      const newInviteCount = Math.max(0, (currentEvent.inviteCount || 0) - 1);

      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        eventId,
        {
          attendeeCount: newAttendeeCount,
          inviteCount: newInviteCount,
          lastActivityAt: new Date().toISOString(),
        }
      );

      authDebug.info(`User ${userId} promoted from invite to attending for event ${eventId}, new attendee count: ${newAttendeeCount}`);
      return true;
    }

    // No existing records -> create a fresh attending record
    await databases.createDocument(
      config.databaseID!,
      collectionId,
      ID.unique(),
      {
        eventId,
        userId,
        status: 'attending',
        // Note: do not set `createdAt` — Appwrite uses system attribute `$createdAt` and
        // the collection schema does not include a custom `createdAt` field. Adding it
        // causes a document_invalid_structure error.
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
        lastActivityAt: new Date().toISOString(),
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
    const collectionId = config.eventAttendancesCollectionID;

    // Check if junction table is configured
    if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
      authDebug.info('Event attendances junction table not configured, skipping attendance removal');
      return false;
    }

    // Find attendance record
    const attendanceRecords = await databases.listDocuments(
      config.databaseID!,
      collectionId,
      [
        Query.equal('eventId', eventId),
        Query.equal('userId', userId)
      ]
    );

    if (attendanceRecords.documents.length === 0) {
      authDebug.info(`No attendance/invite records found for user ${userId} on event ${eventId}`);
      return true;
    }

    // Determine what kinds of records we deleted so we can adjust counts appropriately
    let attendingDeleted = 0;
    let invitedDeleted = 0;

    for (const record of attendanceRecords.documents) {
      if (record.status === 'attending') attendingDeleted++;
      if (record.status === 'invited' || record.status === 'pending') invitedDeleted++;

      await databases.deleteDocument(
        config.databaseID!,
        collectionId,
        record.$id
      );
    }

    // Update event counters accordingly
    const currentEvent = await databases.getDocument(config.databaseID!, config.eventsCollectionID!, eventId);
    const newAttendeeCount = Math.max(0, (currentEvent.attendeeCount || 0) - attendingDeleted);
    const newInviteCount = Math.max(0, (currentEvent.inviteCount || 0) - invitedDeleted);

    await databases.updateDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      eventId,
      {
        attendeeCount: newAttendeeCount,
        inviteCount: newInviteCount,
        lastActivityAt: new Date().toISOString(),
      }
    );

    authDebug.info(`User ${userId} removed from event ${eventId}, attendeeDelta: -${attendingDeleted}, inviteDelta: -${invitedDeleted}`);
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
    const collectionId = config.eventAttendancesCollectionID;

    // Check config
    if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
      authDebug.info('Event attendances junction table not configured, skipping invitation creation');
      return false;
    }

    // Check if a record already exists for this user/event
    const existing = await databases.listDocuments(
      config.databaseID!,
      collectionId,
      [
        Query.equal('eventId', eventId),
        Query.equal('userId', userId)
      ]
    );

    // If already attending, nothing to do
    if (existing.documents.some((d: any) => d.status === 'attending')) {
      authDebug.info(`User ${userId} is already attending event ${eventId}, skipping invite`);
      return true;
    }

    // If already invited/pending, nothing to do
    if (existing.documents.some((d: any) => d.status === 'invited' || d.status === 'pending')) {
      authDebug.info(`User ${userId} already invited to event ${eventId}`);
      return true;
    }

    // Create an invitation record in the same junction table
    await databases.createDocument(
      config.databaseID!,
      collectionId,
      ID.unique(),
      {
        eventId,
        userId,
        invitedAt: new Date().toISOString(),
        status: 'invited'
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
        lastActivityAt: new Date().toISOString(),
      }
    );

    authDebug.info(`User ${userId} invited to event ${eventId}, new invite count: ${newCount}`);
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
    // Check if we should use junction tables or fallback to traditional approach
    const collectionId = config.eventAttendancesCollectionID;
    authDebug.debug(`Checking attendees collection config: ${collectionId}`);

    if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
      authDebug.info('Junction table not configured, skipping attendees lookup');
      return [];
    }

    authDebug.debug(`Attempting to fetch attendees from collection: ${collectionId}`);
    const attendanceRecords = await databases.listDocuments(
      config.databaseID!,
      collectionId,
      [
        Query.equal('eventId', eventId),
        Query.equal('status', 'attending'),
        Query.limit(1000) // Scalability limit
      ]
    );

    const attendeeIds = attendanceRecords.documents.map((record: any) => record.userId);
    authDebug.debug(`Updated attendees: +${attendeeIds.length}, -0`);
    return attendeeIds;
  } catch (error) {
    authDebug.error(`Failed to get attendees for event: ${eventId}`, error);
    return [];
  }
}

/**
 * Batch fetch attendees for multiple events. Returns a map of eventId -> attendeeId[]
 */
export async function getEventAttendeesFor(eventIds: string[]): Promise<Record<string, string[]>> {
  try {
    const collectionId = config.eventAttendancesCollectionID;
    authDebug.debug(`Batch fetching attendees for ${eventIds.length} events from: ${collectionId}`);

    if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
      authDebug.info('Junction table not configured, skipping batched attendees lookup');
      return {};
    }

    if (!Array.isArray(eventIds) || eventIds.length === 0) return {};

    // Appwrite allows querying by array values in Query.equal
    const res = await databases.listDocuments(
      config.databaseID!,
      collectionId,
      [
        Query.equal('eventId', eventIds),
        Query.equal('status', 'attending'),
        Query.limit(1000)
      ]
    );

    const map: Record<string, string[]> = {};
    for (const rec of res.documents) {
      const eId = rec.eventId;
      if (!map[eId]) map[eId] = [];
      map[eId].push(rec.userId);
    }

    authDebug.debug(`Batch attendees fetched for ${Object.keys(map).length} events`);
    return map;
  } catch (error) {
    authDebug.error('Failed to batch fetch attendees for events', error);
    return {};
  }
}

/**
 * Get event invitees from junction table
 */
export async function getEventInvitees(eventId: string): Promise<string[]> {
  try {
    const collectionId = config.eventAttendancesCollectionID;
    authDebug.debug(`Checking invite collection config: ${collectionId}`);

    if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
      authDebug.info('Junction table not configured, skipping invitees lookup');
      return [];
    }

    const invitationRecords = await databases.listDocuments(
      config.databaseID!,
      collectionId,
      [
        Query.equal('eventId', eventId),
        Query.equal('status', 'invited'),
        Query.limit(1000)
      ]
    );

    const inviteeIds = invitationRecords.documents.map((record: any) => record.userId);
    authDebug.debug(`Found ${inviteeIds.length} invitees for event ${eventId}`);
    return inviteeIds;
  } catch (error) {
    authDebug.error(`Failed to get invitees for event: ${eventId}`, error);
    return [];
  }
}

/**
 * Remove invitation(s) for a user on an event
 */
export async function removeEventInvitation(eventId: string, userId: string): Promise<boolean> {
  try {
    const collectionId = config.eventAttendancesCollectionID;
    if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
      authDebug.info('Event attendances junction table not configured, skipping invitation removal');
      return false;
    }

    const invitationRecords = await databases.listDocuments(
      config.databaseID!,
      collectionId,
      [
        Query.equal('eventId', eventId),
        Query.equal('userId', userId),
        Query.equal('status', 'invited')
      ]
    );

    if (invitationRecords.documents.length === 0) {
      authDebug.info(`No invitation records to remove for user ${userId} on event ${eventId}`);
      return true;
    }

    for (const rec of invitationRecords.documents) {
      await databases.deleteDocument(config.databaseID!, collectionId, rec.$id);
    }

    // Decrement invite count
    const currentEvent = await databases.getDocument(config.databaseID!, config.eventsCollectionID!, eventId);
    const newInviteCount = Math.max(0, (currentEvent.inviteCount || 0) - invitationRecords.documents.length);
    await databases.updateDocument(config.databaseID!, config.eventsCollectionID!, eventId, {
      inviteCount: newInviteCount,
      lastActivtyAt: new Date().toISOString(),
    });

    authDebug.info(`Removed ${invitationRecords.documents.length} invitation(s) for user ${userId} on event ${eventId}`);
    return true;
  } catch (error) {
    authDebug.error(`Failed to remove invitation for event: ${eventId}`, error);
    throw error;
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
        // Check if junction tables are properly configured
        const collectionId = config.eventAttendancesCollectionID;

        if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
          authDebug.info('Junction table not configured, skipping attendees sync');
        } else {
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
      }

      // Handle invitees array update
      if ((eventData as any).inviteeIds && Array.isArray((eventData as any).inviteeIds)) {
        const collectionId = config.eventAttendancesCollectionID;
        if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
          authDebug.info('Event invitations junction table not configured, skipping invitees sync');
          authDebug.info(`Updated invitees: +0`);
        } else {
          // Get current invitees from junction table
          const currentInvitees = await getEventInvitees(id);
          const newInvitees = (eventData as any).inviteeIds as string[];

          const toAdd = newInvitees.filter(userId => !currentInvitees.includes(userId));
          const toRemove = currentInvitees.filter(userId => !newInvitees.includes(userId));

          for (const userId of toAdd) {
            await addEventInvitation(id, userId);
          }
          for (const userId of toRemove) {
            await removeEventInvitation(id, userId);
          }

          authDebug.info(`Updated invitees: +${toAdd.length}, -${toRemove.length}`);
        }
      }

      // Check if there are other fields to update besides arrays
      const otherFields = { ...eventData };
      delete otherFields.attendees;
      delete (otherFields as any).inviteeIds;

      if (Object.keys(otherFields).length === 0) {
        return; // Exit early if only array updates were needed
      }

      // Continue to update other fields
      eventData = otherFields;
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
    sanitizedEventData.lastActivityAt = new Date().toISOString();

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

    // If you've created a relationship attribute in Appwrite between `events` and `eventAttendances`
    // with "On deleting a document -> Cascade", Appwrite will automatically remove the related
    // attendance/invitation documents when the event is deleted. In that case we skip manual
    // cascade deletion here and rely on the DB to maintain referential integrity.
    const collectionId = config.eventAttendancesCollectionID;
    if (collectionId && !collectionId.includes('temp_') && collectionId !== 'temp_attendances_id') {
      authDebug.info(`Assuming DB-level relationship cascade for eventAttendances collection (${collectionId}). Skipping manual cascade delete.`);
    } else {
      authDebug.info('Event attendances junction table not configured; no DB-level cascade available. No manual cascade performed here.');
    }

    // Delete the event document itself. If DB-level cascade is configured, related attendance
    // records will be removed automatically by Appwrite.
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

    // Get events user created
    const creatorEvents = await databases.listDocuments(
      config.databaseID!,
      config.eventsCollectionID!,
      [Query.equal('creatorId', userId)]
    );

    // Get events user is attending using junction table
    const attendingEvents = await getUserAttendingEvents(userId);

    // Get events where user is invited (legacy support)
    const inviteeEvents = await databases.listDocuments(
      config.databaseID!,
      config.eventsCollectionID!,
      [Query.search('inviteeIds', userId)]
    ).catch(() => ({ documents: [] })); // Fallback if search fails

    // Merge created and attending events
    const allDocuments = [
      ...creatorEvents.documents,
      ...attendingEvents, // Already Event objects
      ...inviteeEvents.documents
    ];

    // Remove duplicates based on $id and convert to Event objects
    const uniqueEvents = new Map<string, Event>();

    allDocuments.forEach((doc: any) => {
      if (!uniqueEvents.has(doc.$id)) {
        // Always convert to proper Event object to ensure all fields are properly handled
        const event: Event = {
          $id: doc.$id,
          title: doc.title || '',
          location: doc.location || '',
          startTime: doc.startTime,
          endTime: doc.endTime,
          creatorId: doc.creatorId,
          inviteeIds: Array.isArray(doc.inviteeIds) ? doc.inviteeIds : [],
          description: doc.description || '',
          attendees: Array.isArray(doc.attendees) ? doc.attendees : [],
          tags: Array.isArray(doc.tags) ? doc.tags : [],
          groupId: doc.groupId || undefined,
          groupName: doc.groupName || undefined,
        };
        uniqueEvents.set(doc.$id, event);
      }
    });

    const events = Array.from(uniqueEvents.values());

    // Cache user events
    cacheManager.set<Event[]>(cacheKey, events, EVENT_CACHE_TTL);

    authDebug.info(`Successfully fetched ${events.length} events for user: ${userId} (${creatorEvents.documents.length} created, ${attendingEvents.length} attending, ${inviteeEvents.documents.length} invited)`);

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

/**
 * Get events that the user is attending (using junction table)
 */
export async function getUserAttendingEvents(userId: string): Promise<Event[]> {
  try {
    authDebug.debug(`Fetching events user is attending: ${userId}`);

    // Get event IDs from event_attendances junction table
    const attendanceRecords = await databases.listDocuments(
      config.databaseID!,
      config.eventAttendancesCollectionID!,
      [Query.equal('userId', userId)]
    );

    if (attendanceRecords.documents.length === 0) {
      authDebug.debug(`No attendance records found for user: ${userId}`);
      return [];
    }

    const eventIds = attendanceRecords.documents.map(record => record.eventId);
    authDebug.debug(`Found ${eventIds.length} events user is attending`);

    // Fetch the actual event documents
    const events = await Promise.all(
      eventIds.map(async (eventId) => {
        try {
          const eventDoc = await databases.getDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId
          );
          return eventDoc as any;
        } catch (error) {
          authDebug.warn(`Could not fetch event ${eventId}:`, error);
          return null;
        }
      })
    );

    // Filter out null events and map to Event type
    const validEvents = events
      .filter(event => event !== null)
      .map((doc: any): Event => ({
        $id: doc.$id,
        title: doc.title,
        location: doc.location,
        startTime: doc.startTime,
        endTime: doc.endTime,
        creatorId: doc.creatorId,
        inviteeIds: doc.inviteeIds || [],
        description: doc.description || '',
        attendees: doc.attendees || [],
        tags: Array.isArray(doc.tags) ? doc.tags : [],
      }));

    authDebug.info(`Successfully fetched ${validEvents.length} attending events for user: ${userId}`);
    return validEvents;
  } catch (err) {
    authDebug.error(`Error fetching attending events for user: ${userId}`, err);
    return [];
  }
}

/**
 * Check if user is attending a specific event (using junction table)
 */
export async function isUserAttendingEvent(userId: string, eventId: string): Promise<boolean> {
  try {
    const attendanceRecords = await databases.listDocuments(
      config.databaseID!,
      config.eventAttendancesCollectionID!,
      [
        Query.equal('userId', userId),
        Query.equal('eventId', eventId)
      ]
    );

    return attendanceRecords.documents.length > 0;
  } catch (err) {
    authDebug.error(`Error checking attendance for user ${userId} and event ${eventId}:`, err);
    return false;
  }
}

/**
 * Get the number of attendees for an event (using junction table)
 */
export async function getEventAttendeeCount(eventId: string): Promise<number> {
  try {
    const attendanceRecords = await databases.listDocuments(
      config.databaseID!,
      config.eventAttendancesCollectionID!,
      [Query.equal('eventId', eventId)]
    );

    return attendanceRecords.documents.length;
  } catch (err) {
    authDebug.error(`Error getting attendee count for event ${eventId}:`, err);
    return 0;
  }
}