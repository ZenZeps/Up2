import { config, databases, ID, Query } from '@/lib/appwrite/appwrite';
import { TravelAnnouncement } from '@/lib/types/Travel';
import { Permission, Role } from 'react-native-appwrite';

/**
 * Create a new travel announcement
 */
export async function createTravelAnnouncement(travel: Omit<TravelAnnouncement, '$id' | 'id' | 'createdAt' | 'updatedAt'>): Promise<TravelAnnouncement> {
    try {
        const travelId = ID.unique();
        const now = new Date().toISOString();

        const travelData = {
            userId: travel.userId,
            destination: travel.destination,
            startDate: travel.startDate,
            endDate: travel.endDate,
            description: travel.description || '',
            isPublic: travel.isPublic,
            createdAt: now,
            updatedAt: now,
        };

        const response = await databases.createDocument(
            config.databaseID!,
            config.travelCollectionID!, // We'll need to add this to the config
            travelId,
            travelData,
            [
                Permission.read(Role.any()), // Friends can see public travel announcements
                Permission.update(Role.user(travel.userId)),
                Permission.delete(Role.user(travel.userId)),
            ]
        );

        return {
            $id: response.$id,
            id: response.$id, // Set id to match $id for consistency
            ...travelData,
        } as TravelAnnouncement;
    } catch (error) {
        console.error('Error creating travel announcement:', error);
        throw error;
    }
}

/**
 * Get travel announcements for a specific user
 */
export async function getUserTravelAnnouncements(userId: string): Promise<TravelAnnouncement[]> {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            [
                Query.equal('userId', userId),
                Query.orderDesc('startDate')
            ]
        );

        return response.documents as unknown as TravelAnnouncement[];
    } catch (error) {
        console.error('Error fetching user travel announcements:', error);
        return [];
    }
}

/**
 * Get travel announcements from friends for the feed
 */
export async function getFriendsTravelAnnouncements(friendIds: string[]): Promise<TravelAnnouncement[]> {
    if (friendIds.length === 0) return [];

    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            [
                Query.equal('userId', friendIds),
                Query.equal('isPublic', true),
                Query.orderDesc('createdAt')
            ]
        );

        return response.documents as unknown as TravelAnnouncement[];
    } catch (error) {
        console.error('Error fetching friends travel announcements:', error);
        return [];
    }
}

/**
 * Get active travel for a user (currently traveling or future travel)
 */
export async function getActiveTravelForUser(userId: string): Promise<TravelAnnouncement[]> {
    try {
        const now = new Date().toISOString();

        const response = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            [
                Query.equal('userId', userId),
                Query.greaterThanEqual('endDate', now), // Travel that hasn't ended yet
                Query.orderAsc('startDate')
            ]
        );

        return response.documents as unknown as TravelAnnouncement[];
    } catch (error) {
        console.error('Error fetching active travel:', error);
        return [];
    }
}

/**
 * Update a travel announcement
 */
export async function updateTravelAnnouncement(
    travelId: string,
    updates: Partial<Omit<TravelAnnouncement, '$id' | 'id' | 'userId' | 'createdAt'>>
): Promise<TravelAnnouncement> {
    try {
        const updateData = {
            ...updates,
            updatedAt: new Date().toISOString(),
        };

        const response = await databases.updateDocument(
            config.databaseID!,
            config.travelCollectionID!,
            travelId,
            updateData
        );

        return response as unknown as TravelAnnouncement;
    } catch (error) {
        console.error('Error updating travel announcement:', error);
        throw error;
    }
}

/**
 * Delete a travel announcement
 */
export async function deleteTravelAnnouncement(travelId: string): Promise<void> {
    try {
        await databases.deleteDocument(
            config.databaseID!,
            config.travelCollectionID!,
            travelId
        );
    } catch (error) {
        console.error('Error deleting travel announcement:', error);
        throw error;
    }
}

/**
 * Check if a user is traveling on a specific date
 */
export async function isUserTravelingOnDate(userId: string, date: string): Promise<boolean> {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            [
                Query.equal('userId', userId),
                Query.lessThanEqual('startDate', date),
                Query.greaterThanEqual('endDate', date)
            ]
        );

        return response.documents.length > 0;
    } catch (error) {
        console.error('Error checking if user is traveling:', error);
        return false;
    }
}
