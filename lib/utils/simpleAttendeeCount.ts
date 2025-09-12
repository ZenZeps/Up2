import { config, databases } from '@/lib/appwrite/appwrite';
import { authDebug } from '@/lib/debug/authDebug';
import { cacheManager } from '../debug/cacheManager';

/**
 * Simple attendee count management - just increment/decrement the counter
 * This bypasses the complex junction table logic and directly manages the count
 */

/**
 * Add attendee (simple counter increment)
 */
export async function addAttendeeSimple(eventId: string, userId: string): Promise<boolean> {
    try {
        // Get current event
        const currentEvent = await databases.getDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId
        );

        // Simply increment the count
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

        authDebug.info(`Simple: Added attendee ${userId} to event ${eventId}, new count: ${newCount}`);

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
 * Remove attendee (simple counter decrement)
 */
export async function removeAttendeeSimple(eventId: string, userId: string): Promise<boolean> {
    try {
        // Get current event
        const currentEvent = await databases.getDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId
        );

        // Simply decrement the count (don't go below 0)
        const newCount = Math.max(0, (currentEvent.attendeeCount || 0) - 1);

        await databases.updateDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId,
            {
                attendeeCount: newCount,
                lastActivityAt: new Date().toISOString(),
            }
        );

        authDebug.info(`Simple: Removed attendee ${userId} from event ${eventId}, new count: ${newCount}`);

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
