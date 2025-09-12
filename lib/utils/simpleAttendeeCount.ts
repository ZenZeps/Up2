import { config, databases } from '@/lib/appwrite/appwrite';
import { authDebug } from '@/lib/debug/authDebug';
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

        // Get current attendees array (for UI compatibility)
        const currentAttendees: string[] = Array.isArray(currentEvent.attendees) ? currentEvent.attendees : [];

        // Check if user is already attending
        if (currentAttendees.includes(userId)) {
            authDebug.info(`User ${userId} is already attending event ${eventId}`);
            return true;
        }

        // Add user to attendees array and increment the count
        const updatedAttendees = [...currentAttendees, userId];
        const newCount = (currentEvent.attendeeCount || 0) + 1;

        await databases.updateDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId,
            {
                attendees: updatedAttendees, // Store IDs for UI avatar display
                attendeeCount: newCount,     // Keep counter for performance
                lastActivityAt: new Date().toISOString(),
            }
        );

        authDebug.info(`Simple: Added attendee ${userId} to event ${eventId}, new count: ${newCount}, total attendees: ${updatedAttendees.length}`);

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
 * Remove attendee (simple counter decrement + legacy attendees array)
 */
export async function removeAttendeeSimple(eventId: string, userId: string): Promise<boolean> {
    try {
        // Get current event
        const currentEvent = await databases.getDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId
        );

        // Get current attendees array (for UI compatibility)
        const currentAttendees: string[] = Array.isArray(currentEvent.attendees) ? currentEvent.attendees : [];

        // Check if user is actually attending
        if (!currentAttendees.includes(userId)) {
            authDebug.info(`User ${userId} is not attending event ${eventId}`);
            return true;
        }

        // Remove user from attendees array and decrement the count
        const updatedAttendees = currentAttendees.filter(id => id !== userId);
        const newCount = Math.max(0, (currentEvent.attendeeCount || 0) - 1);

        await databases.updateDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId,
            {
                attendees: updatedAttendees, // Update IDs for UI avatar display
                attendeeCount: newCount,     // Keep counter for performance
                lastActivityAt: new Date().toISOString(),
            }
        );

        authDebug.info(`Simple: Removed attendee ${userId} from event ${eventId}, new count: ${newCount}, total attendees: ${updatedAttendees.length}`);

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
