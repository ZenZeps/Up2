import { config, databases, Query } from '../appwrite/appwrite';

/**
 * Simple invite tracking utility
 * Note: For production, you should create the 'invites_sent' collection 
 * manually in the Appwrite console with these attributes:
 * - eventId (String, required)
 * - inviterUserId (String, required) 
 * - platform (String, required)
 * - sentAt (DateTime, required)
 */

/**
 * Logs an invite send event if the collection exists
 */
export const logInviteEvent = async (
    eventId: string,
    inviterUserId: string,
    platform: string
): Promise<void> => {
    try {
        // Try to create the log document
        // This will only work if you've manually created the 'invites_sent' collection
        const { createDocumentSafe } = await import('@/lib/appwrite/safeDb');
        await createDocumentSafe(
            config.databaseID!,
            'invites_sent', // Create this collection manually in Appwrite console
            'unique()',
            {
                eventId,
                inviterUserId,
                platform,
                sentAt: new Date().toISOString(),
            }
        );
    } catch (error) {
        // Silently fail if collection doesn't exist
        console.log('Invite tracking collection not found. Create "invites_sent" collection in Appwrite console for tracking.');
    }
};

/**
 * Gets invite statistics for an event (if collection exists) with SCALABILITY LIMITS
 */
export const getInviteStats = async (eventId: string) => {
    try {
        // SCALABILITY FIX: Query with eventId filter instead of loading all invites
        const invites = await databases.listDocuments(
            config.databaseID!,
            'invites_sent',
            [
                Query.equal('eventId', eventId),
                Query.limit(500), // SCALABILITY: Limit to 500 invites max
            ]
        );

        const stats = {
            total: invites.documents.length,
            whatsapp: 0,
            instagram: 0,
            messenger: 0,
            general: 0,
        };

        // No need to filter since we already queried by eventId
        invites.documents.forEach((invite: any) => {
            if (invite.platform in stats) {
                (stats as any)[invite.platform]++;
            }
        });

        console.log(`Invite stats for event ${eventId}: ${stats.total} total invites`);
        return stats;
    } catch (error) {
        console.log('Could not get invite stats - collection may not exist');
        return null;
    }
};
