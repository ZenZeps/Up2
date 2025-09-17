// Main travel API - extends friend notification system with full travel management
import {
    createTravelAnnouncementWithFriendNotifications,
    findFriendsInSameLocation,
    getFriendsCurrentlyTraveling,
    getFriendsOverlappingTravel
} from './travelFriendNotifications';

import { config, databases, Query } from '@/lib/appwrite/appwrite';
import { TravelAnnouncement } from '@/lib/types/Travel';

/**
 * Get travel announcements from a list of friends
 */
export async function getFriendsTravelAnnouncements(
    friendIds: string[],
    limit: number = 50
): Promise<TravelAnnouncement[]> {
    try {
        if (!friendIds || friendIds.length === 0) {
            return [];
        }

        const response = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            [
                Query.equal('userId', friendIds),
                Query.orderDesc('$createdAt'),
                Query.limit(limit)
            ]
        );

        return response.documents.map(doc => ({
            $id: doc.$id,
            id: doc.$id,
            userId: doc.userId,
            destination: doc.destination,
            startDate: doc.startDate,
            endDate: doc.endDate,
            description: doc.description || '',
            isPublic: doc.isPublic,
            destinationLat: doc.destinationLat,
            destinationLng: doc.destinationLng,
            locationName: doc.locationName,
            friendsNotified: doc.friendsNotified || [],
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            $createdAt: doc.$createdAt,
            $updatedAt: doc.$updatedAt,
        })) as TravelAnnouncement[];
    } catch (error) {
        console.error('Error fetching friends travel announcements:', error);
        throw error;
    }
}

/**
 * Get user's travel announcements (for calendar integration)
 */
export async function getUserTravelAnnouncements(
    userId: string,
    limit: number = 100
): Promise<TravelAnnouncement[]> {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            [
                Query.equal('userId', userId),
                Query.orderDesc('$createdAt'),
                Query.limit(limit)
            ]
        );

        return response.documents.map(doc => ({
            $id: doc.$id,
            id: doc.$id,
            userId: doc.userId,
            destination: doc.destination,
            startDate: doc.startDate,
            endDate: doc.endDate,
            description: doc.description || '',
            isPublic: doc.isPublic,
            destinationLat: doc.destinationLat,
            destinationLng: doc.destinationLng,
            locationName: doc.locationName,
            friendsNotified: doc.friendsNotified || [],
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            $createdAt: doc.$createdAt,
            $updatedAt: doc.$updatedAt,
        })) as TravelAnnouncement[];
    } catch (error) {
        console.error('Error fetching user travel announcements:', error);
        throw error;
    }
}

/**
 * Get travel announcements for calendar date range
 */
export async function getTravelForDateRange(
    userId: string,
    startDate: string,
    endDate: string
): Promise<TravelAnnouncement[]> {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            [
                Query.equal('userId', userId),
                Query.greaterThanEqual('endDate', startDate), // Travel ends after range start
                Query.lessThanEqual('startDate', endDate), // Travel starts before range end
                Query.orderAsc('startDate')
            ]
        );

        return response.documents.map(doc => ({
            $id: doc.$id,
            id: doc.$id,
            userId: doc.userId,
            destination: doc.destination,
            startDate: doc.startDate,
            endDate: doc.endDate,
            description: doc.description || '',
            isPublic: doc.isPublic,
            destinationLat: doc.destinationLat,
            destinationLng: doc.destinationLng,
            locationName: doc.locationName,
            friendsNotified: doc.friendsNotified || [],
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            $createdAt: doc.$createdAt,
            $updatedAt: doc.$updatedAt,
        })) as TravelAnnouncement[];
    } catch (error) {
        console.error('Error fetching travel for date range:', error);
        throw error;
    }
}

/**
 * Check if user is traveling on a specific date
 */
export async function isUserTravelingOnDate(
    userId: string,
    date: Date
): Promise<boolean> {
    try {
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format

        const response = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            [
                Query.equal('userId', userId),
                Query.lessThanEqual('startDate', `${dateStr}T23:59:59.999Z`),
                Query.greaterThanEqual('endDate', `${dateStr}T00:00:00.000Z`),
                Query.limit(1)
            ]
        );

        return response.documents.length > 0;
    } catch (error) {
        console.error('Error checking if user is traveling on date:', error);
        return false;
    }
}

/**
 * Get travel days for calendar highlighting
 */
export async function getTravelDaysInMonth(
    userId: string,
    year: number,
    month: number
): Promise<string[]> {
    try {
        // Create date range for the month
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0);

        const travel = await getTravelForDateRange(
            userId,
            startOfMonth.toISOString(),
            endOfMonth.toISOString()
        );

        const travelDays = new Set<string>();

        travel.forEach(trip => {
            const tripStart = new Date(trip.startDate);
            const tripEnd = new Date(trip.endDate);

            // Generate all days between start and end dates
            const currentDate = new Date(Math.max(tripStart.getTime(), startOfMonth.getTime()));
            const endDate = new Date(Math.min(tripEnd.getTime(), endOfMonth.getTime()));

            while (currentDate <= endDate) {
                travelDays.add(currentDate.toISOString().split('T')[0]);
                currentDate.setDate(currentDate.getDate() + 1);
            }
        });

        return Array.from(travelDays);
    } catch (error) {
        console.error('Error getting travel days in month:', error);
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
 * Get current travel for a user (if traveling today)
 */
export async function getCurrentTravel(userId: string): Promise<TravelAnnouncement | null> {
    try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const response = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            [
                Query.equal('userId', userId),
                Query.lessThanEqual('startDate', `${todayStr}T23:59:59.999Z`),
                Query.greaterThanEqual('endDate', `${todayStr}T00:00:00.000Z`),
                Query.limit(1)
            ]
        );

        if (response.documents.length === 0) {
            return null;
        }

        const doc = response.documents[0];
        return {
            $id: doc.$id,
            id: doc.$id,
            userId: doc.userId,
            destination: doc.destination,
            startDate: doc.startDate,
            endDate: doc.endDate,
            description: doc.description || '',
            isPublic: doc.isPublic,
            destinationLat: doc.destinationLat,
            destinationLng: doc.destinationLng,
            locationName: doc.locationName,
            friendsNotified: doc.friendsNotified || [],
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            $createdAt: doc.$createdAt,
            $updatedAt: doc.$updatedAt,
        } as TravelAnnouncement;
    } catch (error) {
        console.error('Error getting current travel:', error);
        return null;
    }
}

/**
 * Get active travel for a user (current and future travel that hasn't ended yet)
 */
export async function getActiveTravelForUser(userId: string, limit: number = 10): Promise<TravelAnnouncement[]> {
    try {
        const now = new Date().toISOString();

        const response = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            [
                Query.equal('userId', userId),
                Query.greaterThanEqual('endDate', now), // Travel that hasn't ended yet
                Query.limit(limit), // SCALABILITY: Limit active travel results
                Query.orderAsc('startDate')
            ]
        );

        return response.documents.map(doc => ({
            $id: doc.$id,
            id: doc.$id,
            userId: doc.userId,
            destination: doc.destination,
            startDate: doc.startDate,
            endDate: doc.endDate,
            description: doc.description || '',
            isPublic: doc.isPublic,
            destinationLat: doc.destinationLat,
            destinationLng: doc.destinationLng,
            locationName: doc.locationName,
            friendsNotified: doc.friendsNotified || [],
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            $createdAt: doc.$createdAt,
            $updatedAt: doc.$updatedAt,
        })) as TravelAnnouncement[];
    } catch (error) {
        console.error('Error fetching active travel:', error);
        return [];
    }
}

/**
 * Simple wrapper for backward compatibility  
 */
export async function createTravelAnnouncement(
    travel: {
        userId: string;
        destination: string;
        startDate: string;
        endDate: string;
        description?: string;
        isPublic: boolean;
        destinationLat?: number;
        destinationLng?: number;
        locationName?: string;
    },
    userFriends: string[] = []
): Promise<TravelAnnouncement> {
    return createTravelAnnouncementWithFriendNotifications(travel, userFriends);
}

// Re-export friend notification functions for compatibility
export {
    createTravelAnnouncementWithFriendNotifications,
    findFriendsInSameLocation,
    getFriendsCurrentlyTraveling,
    getFriendsOverlappingTravel
};

