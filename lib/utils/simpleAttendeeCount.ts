import { config, databases } from '@/lib/appwrite/appwrite';
import { authDebug } from '@/lib/debug/authDebug';
import { ID, Query } from 'appwrite';
import { cacheManager } from '../debug/cacheManager';

/**
 * Simple attendee count management - just increment/decrement the counter
 * This bypasses the complex junction table logic and directly manages the count
 */

/**
 * Add attendee (simple counter increment + legacy attendees array)
 */
export async function addAttendeeSimple(eventId: string, userId: string): Promise<boolean> {
    try {
        // Get current event
        const currentEvent = await databases.getDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId
        );

        // Check if user is already attending via junction table
        try {
            const existingAttendance = await databases.listDocuments(
                config.databaseID!,
                config.eventAttendancesCollectionID!,
                [
                    Query.equal('eventId', eventId),
                    Query.equal('userId', userId),
                    Query.limit(1)
                ]
            );

            if (existingAttendance.documents.length > 0) {
                authDebug.info(`User ${userId} is already attending event ${eventId}`);
                return true;
            }
        } catch (error) {
            authDebug.warn('Could not check existing attendance, proceeding with add', error);
        }

        // Add user to attendees and increment the count
        const attendanceRecord = await databases.createDocument(
            config.databaseID!,
            config.eventAttendancesCollectionID!,
            ID.unique(),
            {
                eventId: eventId,
                userId: userId,
                status: 'attending'
            }
        );

        authDebug.info(`Created junction table record for user ${userId} attending event ${eventId}`, attendanceRecord);
        const newCount = (currentEvent.attendeeCount || 0) + 1;

        await databases.updateDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId,
            {
                // Note: attendees array is handled via junction table (event_attendances)
                attendeeCount: newCount,     // Keep counter for performance
                lastActivityAt: new Date().toISOString(),
            }
        );

        authDebug.info(`Simple: Added attendee ${userId} to event ${eventId}, new count: ${newCount}, using junction table for attendees`);

        // Clear relevant caches
        try {
            cacheManager.remove(`event-${eventId}`);
            cacheManager.remove(`event-attendees-${eventId}`);
            cacheManager.remove(`events-user-${userId}`);
            cacheManager.remove('all-events');
        } catch (e) {
            authDebug.warn('Failed to invalidate caches after addAttendeeSimple', e);
        }

        return true;

    } catch (error) {
        authDebug.error(`Failed to add attendee (simple): ${error}`);
        return false;
    }
}

/**
 * Remove attendee (simple counter decrement using junction table)
 */
export async function removeAttendeeSimple(eventId: string, userId: string): Promise<boolean> {
    try {
        // Get current event
        const currentEvent = await databases.getDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId
        );

        // Check if user is actually attending via junction table
        try {
            const existingAttendance = await databases.listDocuments(
                config.databaseID!,
                config.eventAttendancesCollectionID!,
                [
                    Query.equal('eventId', eventId),
                    Query.equal('userId', userId),
                    Query.limit(1)
                ]
            );

            if (existingAttendance.documents.length === 0) {
                authDebug.info(`User ${userId} is not attending event ${eventId}`);
                return true;
            }

            // Remove the attendance record
            await databases.deleteDocument(
                config.databaseID!,
                config.eventAttendancesCollectionID!,
                existingAttendance.documents[0].$id
            );

            authDebug.info(`Removed junction table record for user ${userId} from event ${eventId}`);
        } catch (error) {
            authDebug.warn('Could not remove attendance record', error);
        }

        // Decrement the count
        const newCount = Math.max(0, (currentEvent.attendeeCount || 0) - 1);

        await databases.updateDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId,
            {
                // Note: attendees array is handled via junction table (event_attendances)
                attendeeCount: newCount,     // Keep counter for performance
                lastActivityAt: new Date().toISOString(),
            }
        );

        authDebug.info(`Simple: Removed attendee ${userId} from event ${eventId}, new count: ${newCount}, using junction table for attendees`);

        // Clear relevant caches
        try {
            cacheManager.remove(`event-${eventId}`);
            cacheManager.remove(`event-attendees-${eventId}`);
            cacheManager.remove(`event-invitees-${eventId}`);
            cacheManager.remove(`events-user-${userId}`);
            cacheManager.remove('all-events');
        } catch (e) {
            authDebug.warn('Failed to invalidate caches after removeAttendeeSimple', e);
        }

        return true;

    } catch (error) {
        authDebug.error(`Failed to remove attendee (simple): ${error}`);
        return false;
    }
}

/**
 * Set attendee count directly
 */
export async function setAttendeeCount(eventId: string, count: number): Promise<boolean> {
    try {
        await databases.updateDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId,
            {
                attendeeCount: Math.max(0, count),
                lastActivityAt: new Date().toISOString(),
            }
        );

        authDebug.info(`Simple: Set attendee count for event ${eventId} to ${count}`);

        // Clear relevant caches
        try {
            cacheManager.remove(`event-${eventId}`);
            cacheManager.remove('all-events');
        } catch (e) {
            authDebug.warn('Failed to invalidate caches after setAttendeeCount', e);
        }

        return true;

    } catch (error) {
        authDebug.error(`Failed to set attendee count: ${error}`);
        return false;
    }
}
