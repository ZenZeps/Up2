import { config, databases, ID, Query } from '@/lib/appwrite/appwrite';
import { TravelAnnouncement } from '@/lib/types/Travel';
import { Permission, Role } from 'react-native-appwrite';

/**
 * Create a travel announcement and notify friends in the same location
 */
export async function createTravelAnnouncementWithFriendNotifications(
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
    try {
        // Validate required fields
        if (!travel.userId || travel.userId.trim() === '') {
            throw new Error('User ID is required to create travel announcement');
        }

        const travelId = ID.unique();

        // Find friends who will be in the same location during the same time
        const friendsToNotify = await findFriendsInSameLocation(
            travel.destinationLat,
            travel.destinationLng,
            travel.startDate,
            travel.endDate,
            userFriends
        );

        const travelData = {
            userId: travel.userId,
            destination: travel.destination,
            startDate: travel.startDate,
            endDate: travel.endDate,
            description: travel.description || '',
            isPublic: travel.isPublic,
            destinationLat: travel.destinationLat,
            destinationLng: travel.destinationLng,
            friendsNotified: friendsToNotify,
        };

        const { stripSystemTimestamps } = await import('@/lib/utils/appwriteSanitizer');

        const response = await databases.createDocument(
            config.databaseID!,
            config.travelCollectionID!,
            travelId,
            stripSystemTimestamps(travelData),
            [
                Permission.read(Role.any()),
                Permission.update(Role.user(travel.userId)),
                Permission.delete(Role.user(travel.userId)),
            ]
        );

        // Send notifications to friends who will be in the same location
        if (friendsToNotify.length > 0) {
            await notifyFriendsAboutTravel(response.$id, travel.userId, friendsToNotify, travel.destination, travel.startDate, travel.endDate);
        }

        return {
            $id: response.$id,
            id: response.$id,
            ...travelData,
            createdAt: response.$createdAt,
            updatedAt: response.$updatedAt,
            $createdAt: response.$createdAt,
            $updatedAt: response.$updatedAt,
        } as TravelAnnouncement;
    } catch (error) {
        console.error('Error creating travel announcement with friend notifications:', error);
        throw error;
    }
}

/**
 * Find friends who will be in the same location during overlapping time periods
 */
export async function findFriendsInSameLocation(
    destinationLat?: number,
    destinationLng?: number,
    startDate?: string,
    endDate?: string,
    userFriends: string[] = [],
    radiusKm: number = 50
): Promise<string[]> {
    try {
        if (!destinationLat || !destinationLng || !startDate || !endDate || userFriends.length === 0) {
            return [];
        }

        // Calculate approximate lat/lng bounds
        const latOffset = radiusKm / 111; // 1 degree lat ≈ 111km
        const lngOffset = radiusKm / (111 * Math.cos(destinationLat * Math.PI / 180));

        // Find friends' travel announcements that overlap in location and time
        const queries = [
            Query.equal('userId', userFriends), // Only friends
            Query.equal('isPublic', true), // Only public travel announcements
            // Location overlap
            Query.greaterThanEqual('destinationLat', destinationLat - latOffset),
            Query.lessThanEqual('destinationLat', destinationLat + latOffset),
            Query.greaterThanEqual('destinationLng', destinationLng - lngOffset),
            Query.lessThanEqual('destinationLng', destinationLng + lngOffset),
            // Time overlap: their trip ends after our trip starts AND their trip starts before our trip ends
            Query.greaterThanEqual('endDate', startDate),
            Query.lessThanEqual('startDate', endDate),
            Query.limit(100)
        ];

        const response = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            queries
        );

        // Extract unique friend user IDs
        const friendsInLocation = [...new Set(
            response.documents.map(doc => doc.userId).filter(userId => userFriends.includes(userId))
        )];

        return friendsInLocation;
    } catch (error) {
        console.error('Error finding friends in same location:', error);
        return [];
    }
}

/**
 * Find friends who are currently in a specific location
 */
export async function findFriendsCurrentlyInLocation(
    destinationLat: number,
    destinationLng: number,
    userFriends: string[] = [],
    radiusKm: number = 50
): Promise<string[]> {
    try {
        const now = new Date().toISOString();

        return await findFriendsInSameLocation(
            destinationLat,
            destinationLng,
            now, // Start date is now
            now, // End date is now (currently there)
            userFriends,
            radiusKm
        );
    } catch (error) {
        console.error('Error finding friends currently in location:', error);
        return [];
    }
}

/**
 * Get travel announcements from friends who will be in the same location during user's trip
 */
export async function getFriendsOverlappingTravel(
    userTravelId: string,
    userFriends: string[] = []
): Promise<TravelAnnouncement[]> {
    try {
        // Get the user's travel announcement first
        const userTravel = await databases.getDocument(
            config.databaseID!,
            config.travelCollectionID!,
            userTravelId
        ) as unknown as TravelAnnouncement;

        if (!userTravel.destinationLat || !userTravel.destinationLng) {
            return [];
        }

        // Find friends in the same location during the same time
        const friendsInLocation = await findFriendsInSameLocation(
            userTravel.destinationLat,
            userTravel.destinationLng,
            userTravel.startDate,
            userTravel.endDate,
            userFriends
        );

        if (friendsInLocation.length === 0) {
            return [];
        }

        // Get the actual travel announcements for these friends
        const queries = [
            Query.equal('userId', friendsInLocation),
            Query.equal('isPublic', true),
            Query.orderDesc('$createdAt'),
            Query.limit(50)
        ];

        const response = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            queries
        );

        return response.documents as unknown as TravelAnnouncement[];
    } catch (error) {
        console.error('Error getting friends overlapping travel:', error);
        return [];
    }
}

/**
 * Send notifications to friends about travel overlap
 * This would integrate with your notification system
 */
async function notifyFriendsAboutTravel(
    travelId: string,
    userId: string,
    friendIds: string[],
    destination: string,
    startDate: string,
    endDate: string
): Promise<void> {
    try {
        // This would integrate with your existing notification system
        // For now, we'll just log the notification intent
        console.log('🌍 Travel Notification:', {
            travelId,
            userId,
            friendIds,
            destination,
            startDate,
            endDate,
            message: `Your friend will be in ${destination} from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}!`
        });

        // TODO: Integrate with your push notification system
        // await sendPushNotification(friendIds, {
        //   title: `Friend traveling to ${destination}!`,
        //   body: `You'll both be in ${destination} at the same time!`,
        //   data: { travelId, type: 'travel_overlap' }
        // });

    } catch (error) {
        console.error('Error notifying friends about travel:', error);
        // Don't throw error - notification failure shouldn't prevent travel creation
    }
}

/**
 * Get friends who are currently traveling (for discovery)
 */
export async function getFriendsCurrentlyTraveling(userFriends: string[] = []): Promise<TravelAnnouncement[]> {
    try {
        if (userFriends.length === 0) {
            return [];
        }

        const now = new Date().toISOString();

        const queries = [
            Query.equal('userId', userFriends),
            Query.equal('isPublic', true),
            Query.lessThanEqual('startDate', now), // Trip has started
            Query.greaterThanEqual('endDate', now), // Trip hasn't ended
            Query.orderDesc('$createdAt'),
            Query.limit(50)
        ];

        const response = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            queries
        );

        return response.documents as unknown as TravelAnnouncement[];
    } catch (error) {
        console.error('Error getting friends currently traveling:', error);
        return [];
    }
}
