import { config, databases } from "@/lib/appwrite/appwrite";
import { createDocumentSafe } from "@/lib/appwrite/safeDb";
import { Event } from "@/lib/types/Events";
import { ID, Permission, Query, Role } from "react-native-appwrite";
import { authDebug } from "../debug/authDebug";
import { cacheManager } from "../debug/cacheManager";
import { sendEventInviteNotification } from "../notifications/notificationUtils";
import { removeAttendeeSimple } from "../utils/simpleAttendeeCount";
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
export async function fetchEvents(params?: any): Promise<Event[]> {
  // Backwards compatible: callers may pass a boolean includePast or a params object
  let includePast = false;
  if (typeof params === 'boolean') includePast = params;
  else if (params && typeof params.includePast === 'boolean') includePast = params.includePast;

  // Check cache first
  const cachedEvents = cacheManager.get<Event[]>(EVENT_COLLECTION_CACHE_KEY);
  if (cachedEvents) {
    authDebug.debug('Returning cached events', { count: cachedEvents.length });
    return cachedEvents;
  }

  authDebug.info('Fetching events from database');

  try {
    const queries: any[] = [
      // SCALABILITY Fix: limit and sort
      Query.limit(100),
      Query.orderDesc('$createdAt'),
    ];

    // If caller wants only future events (default), add a filter; otherwise fetch all
    if (!includePast) {
      queries.push(Query.greaterThan('endTime', new Date().toISOString())); // Only future events
    }

    const res = await databases.listDocuments(
      config.databaseID!,
      config.eventsCollectionID!,
      queries
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

      const event = {
        $id: doc.$id,
        title: doc.title || 'Untitled Event',
        location: doc.location || 'No location',
        startTime,
        endTime,
        creatorId: doc.creatorId,
        description: doc.description || '',
        tags: Array.isArray(doc.tags) ? doc.tags : [],
        isPrivate: doc.isPrivate || false,
        photoId: doc.photoId,
        // Optimized counters
        attendeeCount: doc.attendeeCount || 0,
        inviteCount: doc.inviteCount || 0,
        viewCount: doc.viewCount || 0,
        popularityScore: doc.popularityScore || 0.0,
      };

      // Debug logging for photo IDs
      if (doc.photoId) {
        console.log('📸 Event with photo found:', {
          eventId: doc.$id,
          title: doc.title,
          photoId: doc.photoId
        });
      }

      return event;
    });

    // Events are stored with denormalized counters; relationships are fetched on demand via junction tables.
    const enhancedEvents = events;

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
  // TEMPORARY: Clear event caches to ensure we get fresh data with photoId
  console.log('🗑️ Clearing event cache for fresh photoId data...', id);
  cacheManager.remove(`event-${id}`);

  // Check cache first (will be empty after clearing)
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

    const event: Event = {
      $id: doc.$id,
      title: doc.title,
      location: doc.location,
      startTime: doc.startTime,
      endTime: doc.endTime,
      creatorId: doc.creatorId,
      description: doc.description || '',
      tags: Array.isArray(doc.tags) ? doc.tags : [],
      isPrivate: doc.isPrivate || false,
      photoId: doc.photoId,
      attendeeCount: doc.attendeeCount || 0,
      inviteCount: doc.inviteCount || 0,
      viewCount: doc.viewCount || 0,
      popularityScore: doc.popularityScore || 0.0,
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
export async function getAllEvents(includePast: boolean = false) {
  return fetchEvents(includePast);
}

/**
 * Get only public events for feeds (excludes private events unless user is creator/invitee)
 */
export async function getPublicEvents(includePast: boolean = false, userId?: string): Promise<Event[]> {
  const allEvents = await fetchEvents(includePast);

  // If no userId provided, only return public events
  if (!userId) {
    return allEvents.filter(event => !event.isPrivate);
  }

  // If userId provided, return public events + private events where user is creator or invitee
  const filteredEvents: Event[] = [];

  for (const event of allEvents) {
    // Always show public events
    if (!event.isPrivate) {
      filteredEvents.push(event);
      continue;
    }

    // Show private events if user is the creator
    if (event.creatorId === userId) {
      filteredEvents.push(event);
      continue;
    }

    // Check if user is invited to private event
    try {
      const isInvited = await isUserAttendingEvent(userId, event.$id);
      if (isInvited) {
        filteredEvents.push(event);
      }
    } catch (error) {
      console.error('Error checking event invitation for event', event.$id, ':', error);
      // Don't include the event if we can't verify invitation
    }
  }

  return filteredEvents;
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

    // Note: legacy array fields (inviteeIds/attendees) are removed from the Event type.
    // If callers pass them in the payload (legacy callers), accept them via (event as any)
    if ((event as any).inviteeIds && !Array.isArray((event as any).inviteeIds)) {
      throw new Error('Invitee IDs must be an array');
    }

    if ((event as any).attendees && !Array.isArray((event as any).attendees)) {
      throw new Error('Attendees must be an array');
    }

    if (event.tags && !Array.isArray(event.tags)) {
      throw new Error('Tags must be an array');
    }

    // DEBUGGING: Log event creation attempts with empty tags
    if (!event.tags || event.tags.length === 0) {
      authDebug.info('⚠️ CREATING EVENT WITH NO TAGS:', {
        title: event.title,
        creatorId: event.creatorId,
        isPrivate: event.isPrivate,
        tagsProvided: event.tags,
        tagsType: typeof event.tags
      });
    } else {
      authDebug.info('✅ Creating event with tags:', {
        title: event.title,
        tags: event.tags,
        tagCount: event.tags.length
      });
    }

    // Sanitize and prepare data with new required fields
    const locationTrimmed = event.location?.trim() || '';

    // Validate location length after trimming
    if (locationTrimmed.length > 50) {
      throw new Error('Location must be no longer than 50 characters');
    }

    const sanitizedEvent = {
      ...event,
      title: event.title.trim(),
      location: locationTrimmed,
      description: event.description?.trim() || '',
      creatorId: event.creatorId,
      startTime: event.startTime,
      endTime: event.endTime,
      isPrivate: event.isPrivate || false,

      // Required fields that exist in your database schema
      id: event.$id || ID.unique(), // Required id field in your schema
      attendeeCount: 0,
      inviteCount: 0,
      viewCount: 0,
      popularityScore: 0.0,
      responseRate: true,
      lastActivityAt: new Date().toISOString(), // Missing field from your schema

      // Location coordinates (required fields in your schema)
      locationLat: (event as any).locationLat ?? 0.0,
      locationLng: (event as any).locationLng ?? 0.0,

      // Array fields that exist in your schema - ensure tags always has at least one item
      tags: (() => {
        const filteredTags = Array.isArray(event.tags) ? event.tags.filter(tag => tag && typeof tag === 'string') : [];
        // If no tags provided, add a default tag to prevent database issues
        if (filteredTags.length === 0) {
          authDebug.info('🏷️ Adding default tag to event without tags');
          return ['general'];
        }
        return filteredTags;
      })(),
      searchKeywords: [], // Required field in your schema
      categoryTags: [], // Required field in your schema
    };

    // Remove any legacy fields if present in the incoming payload
    delete (sanitizedEvent as any).inviteeIds;
    delete (sanitizedEvent as any).attendees;
    delete (sanitizedEvent as any).isAttending;

    // DEBUG: Log final sanitized event data
    authDebug.info('📝 FINAL SANITIZED EVENT DATA:', {
      title: sanitizedEvent.title,
      tags: sanitizedEvent.tags,
      isPrivate: sanitizedEvent.isPrivate,
      hasLocation: Boolean(sanitizedEvent.location),
      allFields: Object.keys(sanitizedEvent)
    });

    authDebug.debug('Creating event with data:', sanitizedEvent);

    // Validate config before making API call
    if (!config.databaseID || !config.eventsCollectionID) {
      console.warn('Database configuration is missing, using fallbacks');
    }

    // If a textual location is provided but no explicit coordinates, attempt to geocode it
    // TEMPORARILY DISABLED: This might be causing event creation failures
    /*
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
    */
    authDebug.debug('Geocoding temporarily disabled for debugging');

    // Create the event
    authDebug.debug('Geocoding temporarily disabled for debugging');

    // Diagnostic logging: capture payload and params being sent to DB
    authDebug.debug('EVENT WRITE: About to call createDocumentSafe with:', {
      databaseId: config.databaseID,
      collectionId: config.eventsCollectionID,
      documentId: sanitizedEvent.$id || '<generated>',
      dataKeys: Object.keys(sanitizedEvent),
    });

    // Determine permissions: public events should be readable by anyone;
    // private events readable only by the creator. Creator should always have update/delete.
    const perms = sanitizedEvent.isPrivate
      ? [
        Permission.read(Role.user(sanitizedEvent.creatorId)),
        Permission.update(Role.user(sanitizedEvent.creatorId)),
        Permission.delete(Role.user(sanitizedEvent.creatorId)),
      ]
      : [
        Permission.read(Role.any()),
        Permission.update(Role.user(sanitizedEvent.creatorId)),
        Permission.delete(Role.user(sanitizedEvent.creatorId)),
      ];

    // TEMPORARY FIX: Only use string fields until relationships are configured
    const eventPayload = {
      ...sanitizedEvent,
      // TODO: Add back relationship field once Appwrite Console is configured:
      // creator: sanitizedEvent.creatorId, // New relationship field
      // Keep creatorId string field for compatibility during transition
    };

    const createdEvent = await createDocumentSafe(
      config.databaseID,
      config.eventsCollectionID,
      sanitizedEvent.$id || ID.unique(),
      eventPayload,
      perms
    );

    authDebug.info('Event created successfully (createDocumentSafe response):', createdEvent?.$id);
    authDebug.debug('EVENT WRITE: Full createDocumentSafe response keys:', Object.keys(createdEvent || {}));

    // Diagnostic: verify the document exists via getDocument and list queries
    try {
      const verification = await databases.getDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        createdEvent.$id
      );
      authDebug.info('✅ EVENT VERIFICATION: Document exists by getDocument:', verification.$id);
      authDebug.debug('✅ EVENT VERIFICATION: Document permissions:', verification.$permissions || verification['$permissions']);
    } catch (verErr) {
      authDebug.error('❌ EVENT VERIFICATION FAILED: getDocument failed:', verErr);
    }

    // Wait a moment and try listing/querying the collection for this ID
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const queryTest = await databases.listDocuments(
        config.databaseID!,
        config.eventsCollectionID!,
        [Query.equal('$id', createdEvent.$id), Query.limit(5)]
      );
      authDebug.info('🔍 EVENT QUERY TEST', { found: queryTest.documents.length, id: createdEvent.$id });
      if (queryTest.documents.length > 0) authDebug.debug('🔍 EVENT QUERY TEST: Document via query', { id: queryTest.documents[0].$id });
    } catch (qErr) {
      authDebug.error('❌ EVENT QUERY TEST FAILED:', qErr);
    }

    try {
      const allDocs = await databases.listDocuments(
        config.databaseID!,
        config.eventsCollectionID!,
        [Query.limit(50)]
      );
      authDebug.info('📊 EVENT COLLECTION TEST: Total documents returned by listDocuments:', allDocs.documents.length);
    } catch (allErr) {
      authDebug.error('❌ EVENT COLLECTION TEST FAILED:', allErr);
    }

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

    // If legacy inviteeIds were passed in the original payload, migrate them into the junction table
    const incomingInvitees: string[] = Array.isArray((event as any).inviteeIds) ? (event as any).inviteeIds : [];
    if (incomingInvitees.length > 0) {
      try {
        // Add invitations via junction table and send one notification batch
        for (const uid of incomingInvitees) {
          try {
            await addEventInvitation(createdEvent.$id, uid, sanitizedEvent.creatorId);
          } catch (e) {
            authDebug.warn(`Failed to add invitation for user ${uid} to event ${createdEvent.$id}:`, e);
          }
        }

        const creatorProfile = await getUserProfile(sanitizedEvent.creatorId);
        const creatorName = creatorProfile
          ? `${creatorProfile.firstName} ${creatorProfile.lastName}`.trim()
          : 'Someone';

        await sendEventInviteNotification(incomingInvitees, sanitizedEvent.title, creatorName, createdEvent.$id);
        authDebug.info(`Event invite notifications sent to ${incomingInvitees.length} users`);
      } catch (notificationError) {
        authDebug.warn('Failed to send event invite notifications (junction flow):', notificationError);
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
// (Legacy migration utilities removed — system now relies on junction tables)

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

    // Fetch event document to enforce privacy rules
    let eventDoc: any = null;
    try {
      eventDoc = await databases.getDocument(config.databaseID!, config.eventsCollectionID!, eventId);
    } catch (err) {
      // If we can't fetch event, fail safe and disallow creating an attendance record
      authDebug.error(`Failed to fetch event ${eventId} for privacy check`, err);
      throw new Error('Unable to verify event privacy');
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
          respondedAt: new Date().toISOString(), // Set when user responds to invitation
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
      // Targeted cache invalidation for affected keys
      try {
        cacheManager.remove(`event-${eventId}`);
        cacheManager.remove(`event-attendees-${eventId}`);
        cacheManager.remove(`event-invitees-${eventId}`);
        cacheManager.remove(`events-user-${userId}`);
        // Clear global events cache to ensure all screens update
        cacheManager.remove('all-events');
      } catch (e) {
        authDebug.warn('Failed to invalidate caches after promoting invite to attending', e);
      }
      return true;
    }

    // No existing records -> enforce privacy: private events require an invite (junction table only)
    if (eventDoc && eventDoc.isPrivate && String(eventDoc.creatorId) !== String(userId)) {
      authDebug.warn(`User ${userId} attempted to attend private event ${eventId} without an invite`);
      throw new Error('User is not invited to this private event');
    }

    // No existing records -> create a fresh attending record (TEMP: only string fields)
    await databases.createDocument(
      config.databaseID!,
      collectionId,
      ID.unique(),
      {
        // TEMPORARY FIX: Only use string fields until relationships are configured
        // TODO: Add back relationship fields once Appwrite Console is configured:
        // event: eventId,
        // user: userId,
        // Keep string fields for compatibility during transition
        eventId,
        userId,
        status: 'attending',
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
    // Targeted cache invalidation for the affected event and user
    try {
      cacheManager.remove(`event-${eventId}`);
      cacheManager.remove(`event-attendees-${eventId}`);
      cacheManager.remove(`events-user-${userId}`);
      // Clear global events cache to ensure all screens update
      cacheManager.remove('all-events');
    } catch (e) {
      authDebug.warn('Failed to invalidate caches after addEventAttendee', e);
    }
    return true;
  } catch (error) {
    authDebug.error(`Failed to add attendee to event: ${eventId}`, error);
    throw error;
  }
}

/**
 * Remove user from event attendees (simplified counter approach)
 */
export async function removeEventAttendee(eventId: string, userId: string): Promise<boolean> {
  try {
    // Just use simple counter approach directly
    return await removeAttendeeSimple(eventId, userId);
  } catch (error) {
    authDebug.error(`Failed to remove attendee from event: ${eventId}`, error);
    throw error;
  }
}

/**
 * Add user to event invitations (junction table approach)
 */
export async function addEventInvitation(eventId: string, userId: string, invitedBy?: string): Promise<boolean> {
  try {
    const collectionId = config.eventAttendancesCollectionID;

    // Check config
    if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
      authDebug.info('Event attendances junction table not configured (placeholder detected), skipping invitation creation');
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

    // Create an invitation record using both relationship and string fields
    await databases.createDocument(
      config.databaseID!,
      collectionId,
      ID.unique(),
      {
        // New relationship fields
        event: eventId,
        user: userId,
        // Keep string fields for compatibility during transition
        eventId,
        userId,
        status: 'invited',
        invitedBy: invitedBy || null, // Track who sent the invitation
        respondedAt: null // Will be set when user responds
        // Note: do not set `invitedAt` — Appwrite uses system attribute `$createdAt` and
        // the collection schema does not include a custom `invitedAt` field. Adding it
        // causes a document_invalid_structure error.
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
    // Invalidate invite-related caches
    try {
      cacheManager.remove(`event-invitees-${eventId}`);
      cacheManager.remove(`event-${eventId}`);
      cacheManager.remove(`events-user-${userId}`);
    } catch (e) {
      authDebug.warn('Failed to invalidate caches after addEventInvitation', e);
    }
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
    const cacheKey = `event-attendees-${eventId}`;
    const cached = cacheManager.get<string[]>(cacheKey);
    if (cached) return cached;

    // Check if we should use junction tables or fallback to traditional approach
    const collectionId = config.eventAttendancesCollectionID;
    authDebug.debug(`Checking attendees collection config: ${collectionId}`);

    if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
      authDebug.info('Junction table not configured (placeholder detected), skipping attendees lookup');
      cacheManager.set<string[]>(cacheKey, [], 60 * 1000);
      return [];
    }

    authDebug.debug(`Attempting to fetch attendees from collection: ${collectionId}`);

    // Deduplicate concurrent requests for the same event
    const { requestDeduplicator } = await import('@/lib/utils/dbOptimization');
    const attendanceRecords = await requestDeduplicator.deduplicate(`attendees-${eventId}`, async () => {
      return await databases.listDocuments(
        config.databaseID!,
        collectionId,
        [
          Query.equal('eventId', eventId),
          Query.equal('status', 'attending'),
          Query.limit(1000) // Scalability limit
        ]
      );
    });

    const attendeeIds = attendanceRecords.documents.map((record: any) => record.userId);
    // Cache for a short window to avoid repeated reads while navigating
    cacheManager.set<string[]>(cacheKey, attendeeIds, 90 * 1000);
    authDebug.debug(`Updated attendees: +${attendeeIds.length}, cached for 90s`);
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
      authDebug.info('Junction table not configured (placeholder detected), skipping batched attendees lookup');
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
    const cacheKey = `event-invitees-${eventId}`;
    const cached = cacheManager.get<string[]>(cacheKey);
    if (cached) return cached;

    const collectionId = config.eventAttendancesCollectionID;
    authDebug.debug(`Checking invite collection config: ${collectionId}`);

    if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
      authDebug.info('Junction table not configured, skipping invitees lookup');
      cacheManager.set<string[]>(cacheKey, [], 60 * 1000);
      return [];
    }

    // Deduplicate concurrent requests for the same event invitees
    const { requestDeduplicator } = await import('@/lib/utils/dbOptimization');
    const invitationRecords = await requestDeduplicator.deduplicate(`invitees-${eventId}`, async () => {
      return await databases.listDocuments(
        config.databaseID!,
        collectionId,
        [
          Query.equal('eventId', eventId),
          Query.equal('status', 'invited'),
          Query.limit(1000)
        ]
      );
    });

    const inviteeIds = invitationRecords.documents.map((record: any) => record.userId);
    cacheManager.set<string[]>(cacheKey, inviteeIds, 90 * 1000);
    authDebug.debug(`Found ${inviteeIds.length} invitees for event ${eventId} (cached 90s)`);
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
      lastActivityAt: new Date().toISOString(),
    });

    authDebug.info(`Removed ${invitationRecords.documents.length} invitation(s) for user ${userId} on event ${eventId}`);
    // Invalidate invite-related caches
    try {
      cacheManager.remove(`event-invitees-${eventId}`);
      cacheManager.remove(`event-${eventId}`);
      cacheManager.remove(`events-user-${userId}`);
      // Clear global events cache to ensure all screens update
      cacheManager.remove('all-events');
    } catch (e) {
      authDebug.warn('Failed to invalidate caches after removeEventInvitation', e);
    }
    return true;
  } catch (error) {
    authDebug.error(`Failed to remove invitation for event: ${eventId}`, error);
    throw error;
  }
}

/**
 * Decline an event invitation (sets status to 'not_attending' and respondedAt timestamp)
 */
export async function declineEventInvitation(eventId: string, userId: string): Promise<boolean> {
  try {
    const collectionId = config.eventAttendancesCollectionID;

    if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
      authDebug.info('Event attendances junction table not configured, skipping decline');
      return false;
    }

    // Find invitation record
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
      authDebug.info(`No invitation found for user ${userId} on event ${eventId}`);
      return true;
    }

    // Update the invitation record to declined
    const invitationRecord = invitationRecords.documents[0];
    await databases.updateDocument(
      config.databaseID!,
      collectionId,
      invitationRecord.$id,
      {
        status: 'not_attending',
        respondedAt: new Date().toISOString() // Set when user responds to invitation
      }
    );

    // Update event counters: -1 invite
    const currentEvent = await databases.getDocument(config.databaseID!, config.eventsCollectionID!, eventId);
    const newInviteCount = Math.max(0, (currentEvent.inviteCount || 0) - 1);

    await databases.updateDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      eventId,
      {
        inviteCount: newInviteCount,
        lastActivityAt: new Date().toISOString(),
      }
    );

    authDebug.info(`User ${userId} declined invitation to event ${eventId}, new invite count: ${newInviteCount}`);
    // Invalidate caches
    try {
      cacheManager.remove(`event-invitees-${eventId}`);
      cacheManager.remove(`event-${eventId}`);
      cacheManager.remove(`events-user-${userId}`);
      // Clear global events cache to ensure all screens update
      cacheManager.remove('all-events');
    } catch (e) {
      authDebug.warn('Failed to invalidate caches after declining invitation', e);
    }
    return true;
  } catch (error) {
    authDebug.error(`Failed to decline invitation for event: ${eventId}`, error);
    throw error;
  }
}

/**
/**
 * Backwards-compatible shim: Invite a user to an event via junction table
 */

/**
 * Backwards-compatible shim: Invite a user to an event via junction table
 */
export async function inviteUserToEvent(eventId: string, userId: string, invitedBy?: string) {
  return addEventInvitation(eventId, userId, invitedBy);
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

    // If callers included legacy array updates in payload, apply them to junction tables
    if ((eventData as any).attendees || (eventData as any).inviteeIds) {
      authDebug.info('Detected array-based relationship updates in payload; applying via junction tables');

      // Handle attendees array update (if provided)
      if ((eventData as any).attendees && Array.isArray((eventData as any).attendees)) {
        const collectionId = config.eventAttendancesCollectionID;
        if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
          authDebug.info('Junction table not configured, skipping attendees sync');
        } else {
          const currentAttendees = await getEventAttendees(id);
          const newAttendees = (eventData as any).attendees as string[];
          const toAdd = newAttendees.filter((userId: string) => !currentAttendees.includes(userId));
          const toRemove = currentAttendees.filter((userId: string) => !newAttendees.includes(userId));

          for (const userId of toAdd) await addEventAttendee(id, userId);
          for (const userId of toRemove) await removeEventAttendee(id, userId);

          authDebug.info(`Updated attendees via junctions: +${toAdd.length}, -${toRemove.length}`);
        }
      }

      // Handle invitee array update (if provided)
      if ((eventData as any).inviteeIds && Array.isArray((eventData as any).inviteeIds)) {
        const collectionId = config.eventAttendancesCollectionID;
        if (!collectionId || collectionId.includes('temp_') || collectionId === 'temp_attendances_id') {
          authDebug.info('Junction table not configured, skipping invitees sync');
        } else {
          // Get event data to determine who is doing the inviting (typically the creator)
          const eventDoc = await databases.getDocument(config.databaseID!, config.eventsCollectionID!, id);
          const invitedBy = eventDoc.creatorId; // Use creator as default inviter

          const currentInvitees = await getEventInvitees(id);
          const newInvitees = (eventData as any).inviteeIds as string[];
          const toAdd = newInvitees.filter((userId: string) => !currentInvitees.includes(userId));
          const toRemove = currentInvitees.filter((userId: string) => !newInvitees.includes(userId));

          for (const userId of toAdd) await addEventInvitation(id, userId, invitedBy);
          for (const userId of toRemove) await removeEventInvitation(id, userId);

          authDebug.info(`Updated invitees via junctions: +${toAdd.length}, -${toRemove.length}`);
        }
      }

      // Remove array fields from eventData before continuing with normal update
      const otherFields = { ...eventData } as any;
      delete otherFields.attendees;
      delete otherFields.inviteeIds;

      if (Object.keys(otherFields).length === 0) {
        return; // Nothing else to update
      }

      eventData = otherFields as Partial<Event>;
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

    // Remove any leftover legacy fields from sanitized payload
    delete (sanitizedEventData as any).inviteeIds;
    delete (sanitizedEventData as any).attendees;
    delete (sanitizedEventData as any).isAttending;

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
    authDebug.info(`Deleting event with relationship-based cascade: ${id}`);

    // With relationship-based cascade deletion, we just delete the event
    // All related data (attendances, messages, etc.) will be automatically deleted
    await databases.deleteDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      id
    );

    authDebug.info(`Successfully deleted event ${id} - relationships automatically cascaded deletion of all attendances and related data`);

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
    // Get events where user is invited via junction table
    const inviteRecords = await databases.listDocuments(
      config.databaseID!,
      config.eventAttendancesCollectionID!,
      [Query.equal('userId', userId), Query.equal('status', 'invited'), Query.limit(1000)]
    ).catch(() => ({ documents: [] }));

    const inviteeEventIds = Array.isArray(inviteRecords.documents) ? inviteRecords.documents.map((d: any) => d.eventId) : [];
    const inviteeEvents = { documents: [] as any[] };
    if (inviteeEventIds.length > 0) {
      // Fetch event documents for these event IDs
      const fetched = await Promise.all(inviteeEventIds.map(async (eid: string) => {
        try {
          return await databases.getDocument(config.databaseID!, config.eventsCollectionID!, eid);
        } catch (e) {
          authDebug.warn(`Failed to fetch invited event ${eid}:`, e);
          return null;
        }
      }));
      inviteeEvents.documents = fetched.filter(Boolean) as any[];
    }

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
          description: doc.description || '',
          tags: Array.isArray(doc.tags) ? doc.tags : [],
          photoId: doc.photoId,
          groupId: doc.groupId || undefined,
          groupName: doc.groupName || undefined,
          attendeeCount: doc.attendeeCount || 0,
          inviteCount: doc.inviteCount || 0,
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
    const cacheKey = `user-attending-events-${userId}`;
    const cached = cacheManager.get<Event[]>(cacheKey);
    if (cached) {
      authDebug.debug(`Returning cached attending events for user ${userId}`, { count: cached.length });
      return cached;
    }

    authDebug.debug(`Fetching events user is attending: ${userId}`);

    // Guard: ensure the event attendances collection is configured
    const attendanceIdStr = String(config.eventAttendancesCollectionID || '');
    authDebug.debug('Using eventAttendancesCollectionID', { collectionId: attendanceIdStr });

    if (!attendanceIdStr || /^temp|YOUR_|placeholder_/i.test(attendanceIdStr)) {
      authDebug.error('getUserAttendingEvents aborted: eventAttendancesCollectionID appears to be a placeholder or missing', { userId, collectionId: config.eventAttendancesCollectionID });
      cacheManager.set<Event[]>(cacheKey, [], 60 * 1000);
      return [];
    }

    // Deduplicate the attendance fetch for this user
    const { requestDeduplicator } = await import('@/lib/utils/dbOptimization');
    const attendanceRecords = await requestDeduplicator.deduplicate(`user-attendance-${userId}`, async () => {
      return await databases.listDocuments(
        config.databaseID!,
        config.eventAttendancesCollectionID!,
        [Query.equal('userId', userId)]
      );
    });

    if (!attendanceRecords || attendanceRecords.documents.length === 0) {
      authDebug.debug(`No attendance records found for user: ${userId}`);
      cacheManager.set<Event[]>(cacheKey, [], 60 * 1000);
      return [];
    }

    const eventIds = attendanceRecords.documents.map(record => record.eventId);
    authDebug.debug(`Found ${eventIds.length} events user is attending`);

    // Fetch event documents in batches to avoid many individual getDocument calls
    const { batchProcess } = await import('@/lib/utils/dbOptimization');
    const fetchedDocs: any[] = [];
    await batchProcess(eventIds, async (batch) => {
      const part = await Promise.all(batch.map(async (eventId) => {
        try {
          return await databases.getDocument(config.databaseID!, config.eventsCollectionID!, eventId);
        } catch (err) {
          return null;
        }
      }));
      fetchedDocs.push(...part.filter(Boolean));
      return part.filter(Boolean) as any[];
    }, 10);

    const validEvents = fetchedDocs.map((doc: any): Event => ({
      $id: doc.$id,
      title: doc.title,
      location: doc.location,
      startTime: doc.startTime,
      endTime: doc.endTime,
      creatorId: doc.creatorId,
      description: doc.description || '',
      tags: Array.isArray(doc.tags) ? doc.tags : [],
      photoId: doc.photoId,
      attendeeCount: doc.attendeeCount || 0,
      inviteCount: doc.inviteCount || 0,
    }));

    // Cache for a short window to avoid repeated reads during quick navigation
    cacheManager.set<Event[]>(cacheKey, validEvents, 90 * 1000);
    authDebug.info(`Successfully fetched ${validEvents.length} attending events for user: ${userId} (cached 90s)`);
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
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
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
    } catch (err: any) {
      retryCount++;

      // Check if it's a network error that we should retry
      const isRetryableError = err.code === 502 || err.code === 503 || err.code === 504 || err.name === 'NetworkError';

      if (retryCount < maxRetries && isRetryableError) {
        // Exponential backoff: wait longer between retries
        const delayMs = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
        authDebug.warn(`Attendance check failed (attempt ${retryCount}/${maxRetries}), retrying in ${delayMs}ms...`, err);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      // If we've exhausted retries or it's not a retryable error, log and return false
      authDebug.error(`Error checking attendance for user ${userId} and event ${eventId} (final attempt):`, err);
      return false;
    }
  }

  return false;
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

/**
 * Clean up orphaned attendance records that point to non-existent events
 */
export async function cleanupOrphanedAttendanceRecords(): Promise<number> {
  try {
    authDebug.info('🧹 Starting cleanup of orphaned attendance records...');

    // Get all attendance records
    const attendanceRecords = await databases.listDocuments(
      config.databaseID!,
      config.eventAttendancesCollectionID!,
      [Query.limit(1000)]
    );

    authDebug.info(`Found ${attendanceRecords.documents.length} attendance records to check`);
    let deletedCount = 0;

    for (const record of attendanceRecords.documents) {
      try {
        // Try to fetch the event this record points to
        await databases.getDocument(
          config.databaseID!,
          config.eventsCollectionID!,
          record.eventId
        );
        // Event exists - record is valid
      } catch (error: any) {
        if (error.code === 404) {
          // Event doesn't exist - delete orphaned record
          authDebug.info(`🗑️ Deleting orphaned attendance record: ${record.$id} (event: ${record.eventId})`);

          try {
            await databases.deleteDocument(
              config.databaseID!,
              config.eventAttendancesCollectionID!,
              record.$id
            );
            deletedCount++;
          } catch (deleteError) {
            authDebug.error(`Failed to delete orphaned record ${record.$id}:`, deleteError);
          }
        }
      }
    }

    // Clear relevant caches after cleanup
    cacheManager.remove(EVENT_COLLECTION_CACHE_KEY);
    authDebug.info('🧹 Clearing user event caches...');

    // Clear common cache patterns (without accessing private cache property)
    const commonCacheKeys = [
      'all-events',
      'events-user-',
      'user-attending-events-',
      'event-attendees-',
      'event-invitees-'
    ];

    // Try to clear caches for common user IDs and patterns
    for (let i = 0; i < 10; i++) {
      commonCacheKeys.forEach(pattern => {
        cacheManager.remove(`${pattern}${i}`);
      });
    }

    authDebug.info(`✅ Cleanup complete! Removed ${deletedCount} orphaned records`);
    return deletedCount;

  } catch (error) {
    authDebug.error('❌ Cleanup failed:', error);
    throw error;
  }
}