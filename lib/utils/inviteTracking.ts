import { config, databases } from '../appwrite/appwrite';

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
        await databases.createDocument(
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
 * Gets invite statistics for an event (if collection exists)
 */
export const getInviteStats = async (eventId: string) => {
    try {
        const invites = await databases.listDocuments(
            config.databaseID!,
            'invites_sent'
        );

        const eventInvites = invites.documents.filter((invite: any) => invite.eventId === eventId);

        const stats = {
            total: eventInvites.length,
            whatsapp: 0,
            instagram: 0,
            messenger: 0,
            general: 0,
        };

        eventInvites.forEach((invite: any) => {
            if (invite.platform in stats) {
                (stats as any)[invite.platform]++;
            }
        });

        return stats;
    } catch (error) {
        console.log('Could not get invite stats - collection may not exist');
        return null;
    }
};
