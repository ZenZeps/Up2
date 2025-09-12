import { config, databases } from '@/lib/appwrite/appwrite';
import { authDebug } from '@/lib/debug/authDebug';

/**
 * Utility to ensure attendee counts are always accurate
 * This handles cases where junction tables might not be configured
 */

/**
 * Add attendee with fallback count management
 */
export async function addAttendeeWithFallback(eventId: string, userId: string): Promise<boolean> {
    try {
        // Try the junction table approach first
        const { addEventAttendee } = await import('@/lib/api/event');
        const junctionSuccess = await addEventAttendee(eventId, userId);

        if (junctionSuccess) {
            authDebug.info(`Successfully added attendee via junction table: ${userId} to event ${eventId}`);
            return true;
        }

        // Fallback: Manual count management
        authDebug.info(`Junction table not available, using fallback attendee count management`);

        // Get current event to check attendee count
        const currentEvent = await databases.getDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId
        );

        // Increment attendee count
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

        authDebug.info(`Fallback: Updated attendee count to ${newCount} for event ${eventId}`);
        return true;

    } catch (error) {
        authDebug.error(`Failed to add attendee with fallback: ${error}`);
        return false;
    }
}

/**
 * Remove attendee with fallback count management
 */
export async function removeAttendeeWithFallback(eventId: string, userId: string): Promise<boolean> {
    try {
        // Try the junction table approach first
        const { removeEventAttendee } = await import('@/lib/api/event');
        const junctionSuccess = await removeEventAttendee(eventId, userId);

        if (junctionSuccess) {
            authDebug.info(`Successfully removed attendee via junction table: ${userId} from event ${eventId}`);
            return true;
        }

        // Fallback: Manual count management
        authDebug.info(`Junction table not available, using fallback attendee count management`);

        // Get current event to check attendee count
        const currentEvent = await databases.getDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId
        );

        // Decrement attendee count (don't go below 0)
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

        authDebug.info(`Fallback: Updated attendee count to ${newCount} for event ${eventId}`);
        return true;

    } catch (error) {
        authDebug.error(`Failed to remove attendee with fallback: ${error}`);
        return false;
    }
}

/**
 * Ensure all events have accurate attendee counts
 * This can be called to fix any events with incorrect counts
 */
export async function syncEventAttendeeCounts(): Promise<{ fixed: number; errors: number }> {
    let fixed = 0;
    let errors = 0;

    try {
        authDebug.info('Starting attendee count synchronization...');

        // Get all events
        const eventsResponse = await databases.listDocuments(
            config.databaseID!,
            config.eventsCollectionID!,
            [] // No filters - get all events
        );

        for (const event of eventsResponse.documents) {
            try {
                // Try to get actual attendee count from junction table
                const { getEventAttendees } = await import('@/lib/api/event');
                const attendeeIds = await getEventAttendees(event.$id);
                const actualCount = attendeeIds.length;
                const storedCount = event.attendeeCount || 0;

                if (actualCount !== storedCount) {
                    // Update the count
                    await databases.updateDocument(
                        config.databaseID!,
                        config.eventsCollectionID!,
                        event.$id,
                        {
                            attendeeCount: actualCount,
                            lastActivityAt: new Date().toISOString(),
                        }
                    );

                    authDebug.info(`Fixed attendee count for event ${event.$id}: ${storedCount} → ${actualCount}`);
                    fixed++;
                }
            } catch (eventError) {
                authDebug.error(`Failed to sync attendee count for event ${event.$id}:`, eventError);
                errors++;
            }
        }

        authDebug.info(`Attendee count sync complete: ${fixed} fixed, ${errors} errors`);
        return { fixed, errors };

    } catch (error) {
        authDebug.error('Failed to sync attendee counts:', error);
        return { fixed, errors: errors + 1 };
    }
}

/**
 * Quick check to validate if an event's attendee count is accurate
 */
export async function validateEventAttendeeCount(eventId: string): Promise<{ isValid: boolean; storedCount: number; actualCount: number }> {
    try {
        // Get event document
        const event = await databases.getDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId
        );

        // Get actual attendees from junction table
        const { getEventAttendees } = await import('@/lib/api/event');
        const attendeeIds = await getEventAttendees(eventId);

        const storedCount = event.attendeeCount || 0;
        const actualCount = attendeeIds.length;
        const isValid = storedCount === actualCount;

        authDebug.info(`Attendee count validation for event ${eventId}: stored=${storedCount}, actual=${actualCount}, valid=${isValid}`);

        return { isValid, storedCount, actualCount };

    } catch (error) {
        authDebug.error(`Failed to validate attendee count for event ${eventId}:`, error);
        return { isValid: false, storedCount: 0, actualCount: 0 };
    }
}
