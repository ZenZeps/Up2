/**
 * Utility functions for syncing event attendee counts with junction table data
 * Use these functions to fix discrepancies between stored counters and actual attendance
 */

import { getEventAttendees, getEventInvitees } from '@/lib/api/event';
import { config, databases, Query } from '@/lib/appwrite/appwrite';
import { authDebug } from '@/lib/debug/authDebug';

export interface CountSyncResult {
    eventId: string;
    oldAttendeeCount: number;
    newAttendeeCount: number;
    oldInviteCount: number;
    newInviteCount: number;
    updated: boolean;
}

/**
 * Sync attendee and invite counts for a single event
 */
export async function syncEventCounts(eventId: string): Promise<CountSyncResult> {
    try {
        // Get current event data
        const event = await databases.getDocument(config.databaseID!, config.eventsCollectionID!, eventId);
        const oldAttendeeCount = event.attendeeCount || 0;
        const oldInviteCount = event.inviteCount || 0;

        // Get real counts from junction tables
        const attendeeIds = await getEventAttendees(eventId);
        const inviteeIds = await getEventInvitees(eventId);

        const newAttendeeCount = attendeeIds.length;
        const newInviteCount = inviteeIds.length;

        // Check if update is needed
        const needsUpdate = oldAttendeeCount !== newAttendeeCount || oldInviteCount !== newInviteCount;

        if (needsUpdate) {
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

            authDebug.info(`Synced counts for event ${eventId}: attendees ${oldAttendeeCount}→${newAttendeeCount}, invites ${oldInviteCount}→${newInviteCount}`);
        }

        return {
            eventId,
            oldAttendeeCount,
            newAttendeeCount,
            oldInviteCount,
            newInviteCount,
            updated: needsUpdate
        };
    } catch (error) {
        authDebug.error(`Failed to sync counts for event ${eventId}:`, error);
        throw error;
    }
}

/**
 * Sync counts for multiple events
 * @param eventIds - Array of event IDs to sync
 * @param batchSize - Number of events to process at once (default: 5)
 */
export async function syncMultipleEventCounts(
    eventIds: string[],
    batchSize: number = 5
): Promise<CountSyncResult[]> {
    const results: CountSyncResult[] = [];

    // Process in batches to avoid overwhelming the database
    for (let i = 0; i < eventIds.length; i += batchSize) {
        const batch = eventIds.slice(i, i + batchSize);

        const batchResults = await Promise.allSettled(
            batch.map(eventId => syncEventCounts(eventId))
        );

        batchResults.forEach((result) => {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            } else {
                authDebug.error('Failed to sync event in batch:', result.reason);
            }
        });

        // Small delay between batches
        if (i + batchSize < eventIds.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    const updated = results.filter(r => r.updated);
    authDebug.info(`Synced ${eventIds.length} events: ${updated.length} updated, ${eventIds.length - updated.length} already correct`);

    return results;
}

/**
 * Find events that have incorrect attendee counts
 */
export async function findEventsWithIncorrectCounts(limit: number = 50): Promise<string[]> {
    try {
        const events = await databases.listDocuments(
            config.databaseID!,
            config.eventsCollectionID!,
            [
                Query.limit(limit),
                Query.orderDesc('$createdAt')
            ]
        );

        const problematicEvents: string[] = [];

        for (const event of events.documents.slice(0, 10)) { // Check first 10 to avoid rate limits
            try {
                const attendeeIds = await getEventAttendees(event.$id);
                const storedCount = event.attendeeCount || 0;
                const realCount = attendeeIds.length;

                if (storedCount !== realCount) {
                    problematicEvents.push(event.$id);
                    authDebug.warn(`Event ${event.$id} (${event.title}) has count mismatch: stored=${storedCount}, real=${realCount}`);
                }
            } catch (error) {
                authDebug.error(`Failed to check counts for event ${event.$id}:`, error);
            }
        }

        return problematicEvents;
    } catch (error) {
        authDebug.error('Failed to find events with incorrect counts:', error);
        return [];
    }
}
