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

        // Create travel data with only valid fields matching Appwrite schema
        const travelData: any = {
            userId: travel.userId,
            destination: travel.destination,
            startDate: travel.startDate, // ISO string format for Appwrite datetime field
            endDate: travel.endDate,     // ISO string format for Appwrite datetime field  
            description: travel.description || '',
            isPublic: travel.isPublic === true, // Ensure boolean
        };

        // Add optional coordinates if provided
        if (travel.destinationLat !== undefined && travel.destinationLng !== undefined) {
            travelData.destinationLat = Number(travel.destinationLat) || 0;
            travelData.destinationLng = Number(travel.destinationLng) || 0;
        }

        // Add friends notification array (ensure it's always an array)
        travelData.friendsNotified = Array.isArray(friendsToNotify) ? friendsToNotify : [];

        const { stripSystemTimestamps } = await import('@/lib/utils/appwriteSanitizer');

        const sanitizedData = stripSystemTimestamps(travelData);

        console.log('🔍 Debug data before/after sanitization:', {
            beforeSanitization: {
                startDate: travelData.startDate,
                endDate: travelData.endDate,
                startDateType: typeof travelData.startDate,
                endDateType: typeof travelData.endDate
            },
            afterSanitization: {
                startDate: sanitizedData.startDate,
                endDate: sanitizedData.endDate,
                startDateType: typeof sanitizedData.startDate,
                endDateType: typeof sanitizedData.endDate
            }
        });

        // Validate required fields
        if (!sanitizedData.userId || !sanitizedData.destination || !sanitizedData.startDate || !sanitizedData.endDate || sanitizedData.isPublic === undefined) {
            console.error('❌ Missing required fields:', {
                userId: !!sanitizedData.userId,
                destination: !!sanitizedData.destination,
                startDate: !!sanitizedData.startDate,
                endDate: !!sanitizedData.endDate,
                isPublic: sanitizedData.isPublic,
                actualData: sanitizedData
            });
            throw new Error('Missing required fields for travel announcement');
        }

        console.log('🚀 Creating travel announcement with data:', {
            ...sanitizedData,
            userId: sanitizedData.userId?.substring(0, 8) + '...'
        });

        let response: any;
        try {
            response = await databases.createDocument(
                config.databaseID!,
                config.travelCollectionID!,
                travelId,
                sanitizedData,
                [
                    Permission.read(Role.any()), // Allow anyone to read (enables collection queries)
                    Permission.update(Role.user(travel.userId)), // Only owner can update
                    Permission.delete(Role.user(travel.userId)), // Only owner can delete
                ]
            );

            console.log('✅ Travel announcement created successfully:', response.$id);

            // Test: Try to immediately read back the document we just created
            try {
                const testRead = await databases.getDocument(
                    config.databaseID!,
                    config.travelCollectionID!,
                    response.$id
                );
                console.log('✅ Immediate read test successful:', testRead.$id);
            } catch (readError) {
                console.error('❌ Immediate read test failed:', readError);
            }

            // Test: Try to query the collection to see if the document appears in lists
            try {
                // First attempt immediately
                let testQuery = await databases.listDocuments(
                    config.databaseID!,
                    config.travelCollectionID!,
                    [
                        Query.equal('userId', travel.userId),
                        Query.orderAsc('$createdAt'),
                        Query.limit(10)
                    ]
                );

                let containsNewDoc = testQuery.documents.some(doc => doc.$id === response.$id);

                // If not found, wait 500ms and try again (indexing delay)
                if (!containsNewDoc && testQuery.documents.length > 0) {
                    console.log('🔬 Document not in initial query, retrying after 500ms...');
                    await new Promise(resolve => setTimeout(resolve, 500));

                    testQuery = await databases.listDocuments(
                        config.databaseID!,
                        config.travelCollectionID!,
                        [
                            Query.equal('userId', travel.userId),
                            Query.orderAsc('$createdAt'),
                            Query.limit(10)
                        ]
                    );
                    containsNewDoc = testQuery.documents.some(doc => doc.$id === response.$id);
                }

                console.log('✅ Collection query test:', {
                    found: testQuery.documents.length,
                    total: testQuery.total,
                    containsNewDoc,
                    newDocId: response.$id.substring(0, 8) + '...',
                    allDocIds: testQuery.documents.map(doc => doc.$id.substring(0, 8) + '...')
                });
            } catch (queryError) {
                console.error('❌ Collection query test failed:', queryError);
            }

        } catch (dbError: any) {
            console.error('❌ Database creation failed:', {
                error: dbError,
                message: dbError?.message,
                code: dbError?.code,
                type: dbError?.type,
                collectionID: config.travelCollectionID,
                databaseID: config.databaseID,
                data: sanitizedData
            });
            throw new Error(`Failed to create travel announcement: ${dbError?.message || dbError}`);
        }



        // CRITICAL DIAGNOSIS: Test collection configuration from client side
        try {
            console.log('🔬 CRITICAL DIAGNOSIS: Testing collection access patterns...');
            console.log('🔬 Target user ID:', travel.userId);
            console.log('🔬 Target user ID type:', typeof travel.userId);

            // Test 1: Basic listDocuments with different limits
            console.log('\n🔬 Test 1: Basic collection listing...');
            for (const limit of [1, 10, 100]) {
                try {
                    const basicQuery = await databases.listDocuments(
                        config.databaseID!,
                        config.travelCollectionID!,
                        [Query.limit(limit)]
                    );
                    console.log(`🔬 Limit ${limit}: Found ${basicQuery.documents.length} documents (total: ${basicQuery.total})`);
                } catch (limitError) {
                    console.error(`🔬 Limit ${limit} failed:`, limitError instanceof Error ? limitError.message : limitError);
                }
            }

            // Test 2: Try without any queries
            console.log('\n🔬 Test 2: No query parameters...');
            try {
                const noQueryParams = await databases.listDocuments(
                    config.databaseID!,
                    config.travelCollectionID!
                );
                console.log(`🔬 No params: Found ${noQueryParams.documents.length} documents (total: ${noQueryParams.total})`);
            } catch (noParamsError) {
                console.error('🔬 No params failed:', noParamsError instanceof Error ? noParamsError.message : noParamsError);
            }

            // Test 3: Try different ordering
            console.log('\n🔬 Test 3: Different ordering...');
            for (const orderQuery of [Query.orderAsc('$createdAt'), Query.orderDesc('$createdAt')]) {
                try {
                    const orderTest = await databases.listDocuments(
                        config.databaseID!,
                        config.travelCollectionID!,
                        [orderQuery, Query.limit(10)]
                    );
                    console.log(`🔬 Order test: Found ${orderTest.documents.length} documents`);
                } catch (orderError) {
                    console.error('🔬 Order test failed:', orderError instanceof Error ? orderError.message : orderError);
                }
            }

            // Test 4: Try user-specific queries
            console.log('\n🔬 Test 4: User-specific queries...');
            const userQueryTests = [
                ['array format', [travel.userId]],
                ['string format', travel.userId]
            ];

            for (const [testName, userIdValue] of userQueryTests) {
                try {
                    const userQuery = await databases.listDocuments(
                        config.databaseID!,
                        config.travelCollectionID!,
                        [
                            Query.equal('userId', userIdValue),
                            Query.orderAsc('$createdAt'),
                            Query.limit(10)
                        ]
                    );
                    console.log(`🔬 User query (${testName}): Found ${userQuery.documents.length} documents`);
                    if (userQuery.documents.length > 0) {
                        console.log(`🔬 User query (${testName}) sample IDs:`, userQuery.documents.slice(0, 3).map(d => d.$id));
                    }
                } catch (userError) {
                    console.error(`🔬 User query (${testName}) failed:`, userError instanceof Error ? userError.message : userError);
                }
            }

            console.log('\n🔬 HYPOTHESIS: The issue appears to be with collection-level permissions or document security settings.');
            console.log('🔬 Individual documents can be accessed by ID, but collection queries return 0 results.');
            console.log('🔬 This suggests document-level permissions are working but collection-level queries are blocked.');

        } catch (diagnosisError) {
            console.error('❌ CRITICAL DIAGNOSIS FAILED:', diagnosisError);
        }

        // Send notifications to friends who will be in the same location
        if (friendsToNotify.length > 0) {
            await notifyFriendsAboutTravel(response.$id, travel.userId, friendsToNotify, travel.destination, travel.startDate, travel.endDate);
        }

        console.log('🔍 Debug travelData before return:', {
            startDate: travelData.startDate,
            endDate: travelData.endDate,
            startDateType: typeof travelData.startDate,
            endDateType: typeof travelData.endDate
        });

        return {
            $id: response.$id,
            id: response.$id,
            ...travelData,
            startDate: travelData.startDate, // Already an ISO string
            endDate: travelData.endDate,     // Already an ISO string
            createdAt: response.$createdAt,
            updatedAt: response.$updatedAt,
            $createdAt: response.$createdAt,
            $updatedAt: response.$updatedAt,
        } as TravelAnnouncement;
    } catch (error) {
        console.error('Error creating travel announcement:', error);

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
            Query.orderAsc('$createdAt'),
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
            Query.orderAsc('$createdAt'),
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
