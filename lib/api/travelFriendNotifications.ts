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
        console.log('🧳 ===== TRAVEL ANNOUNCEMENT CREATION STARTED =====');
        console.log('🧳 Input data:', {
            userId: travel.userId,
            destination: travel.destination,
            startDate: travel.startDate,
            endDate: travel.endDate,
            isPublic: travel.isPublic,
            hasCoordinates: !!(travel.destinationLat && travel.destinationLng),
            userFriendsCount: userFriends.length
        });

        // Debug configuration values
        console.log('🔧 Appwrite Configuration:', {
            databaseID: config.databaseID,
            travelCollectionID: config.travelCollectionID,
            endpoint: config.endpoint,
            projectID: config.projectID
        });

        // Validate required fields
        if (!travel.userId || travel.userId.trim() === '') {
            throw new Error('User ID is required to create travel announcement');
        }

        const travelId = ID.unique();
        console.log('🧳 Generated travel ID:', travelId);

        // Find friends who will be in the same location during the same time
        const friendsToNotify = await findFriendsInSameLocation(
            travel.destinationLat,
            travel.destinationLng,
            travel.startDate,
            travel.endDate,
            userFriends
        );

        console.log('🧳 Friends to notify:', friendsToNotify.length);
        console.log('🧳 Friends to notify array:', friendsToNotify);
        console.log('🧳 Friends array type check:', Array.isArray(friendsToNotify));

        // Create travel data with only valid fields
        const travelData: any = {
            userId: travel.userId,
            destination: travel.destination,
            startDate: new Date(travel.startDate),
            endDate: new Date(travel.endDate),
            description: travel.description || '',
            isPublic: travel.isPublic === true, // Ensure boolean
        };

        // Add optional coordinates if provided
        if (travel.destinationLat !== undefined && travel.destinationLng !== undefined) {
            travelData.destinationLat = Number(travel.destinationLat) || 0;
            travelData.destinationLng = Number(travel.destinationLng) || 0;
        }

        // Add friends notification array
        if (Array.isArray(friendsToNotify) && friendsToNotify.length > 0) {
            travelData.friendsNotified = friendsToNotify;
        } else {
            travelData.friendsNotified = [];
        }

        console.log('🧳 Final travel data structure:', {
            ...travelData,
            startDate: travelData.startDate.toISOString(),
            endDate: travelData.endDate.toISOString()
        });

        const { stripSystemTimestamps } = await import('@/lib/utils/appwriteSanitizer');

        console.log('🧳 Creating travel announcement in collection:', config.travelCollectionID);
        console.log('🧳 Travel data to save:', {
            destination: travelData.destination,
            userId: travelData.userId,
            dates: `${travelData.startDate} to ${travelData.endDate}`
        });

        // Log the complete data being sent to database
        const sanitizedData = stripSystemTimestamps(travelData);
        console.log('🧳 Complete sanitized data being sent to database:', sanitizedData);
        console.log('🧳 Data keys:', Object.keys(sanitizedData));

        // Validate required fields before sending to database
        if (!sanitizedData.userId || !sanitizedData.destination || !sanitizedData.startDate || !sanitizedData.endDate || sanitizedData.isPublic === undefined) {
            throw new Error('Missing required fields for travel announcement');
        }

        // Test collection access before attempting document creation
        try {
            console.log('🔍 Testing collection access...');
            const testDocs = await databases.listDocuments(
                config.databaseID!,
                config.travelCollectionID!,
                [Query.limit(1)]
            );
            console.log('✅ Collection accessible, document count:', testDocs.total);
        } catch (accessError) {
            console.error('❌ Collection access failed:', accessError);
            throw new Error(`Cannot access travel collection: ${accessError instanceof Error ? accessError.message : 'Unknown error'}`);
        }
        console.log('🧳 Database ID:', config.databaseID);
        console.log('🧳 Collection ID:', config.travelCollectionID);

        // Log the exact parameters being passed to createDocument
        console.log('🧳 DETAILED: About to call databases.createDocument with:');
        console.log('🧳 DETAILED: - Database ID:', config.databaseID);
        console.log('🧳 DETAILED: - Collection ID:', config.travelCollectionID);
        console.log('🧳 DETAILED: - Document ID:', travelId);
        console.log('🧳 DETAILED: - Data:', JSON.stringify(sanitizedData, null, 2));
        console.log('🧳 DETAILED: - Data types check:', {
            startDate: typeof sanitizedData.startDate,
            endDate: typeof sanitizedData.endDate,
            startDateValue: sanitizedData.startDate,
            endDateValue: sanitizedData.endDate,
            isStartDateValid: sanitizedData.startDate instanceof Date,
            isEndDateValid: sanitizedData.endDate instanceof Date
        });
        console.log('🧳 DETAILED: - Permissions:', [
            Permission.read(Role.any()),
            Permission.update(Role.user(travel.userId)),
            Permission.delete(Role.user(travel.userId)),
        ]);

        const response = await databases.createDocument(
            config.databaseID!,
            config.travelCollectionID!,
            travelId,
            sanitizedData,
            [
                Permission.read(Role.any()),
                Permission.update(Role.user(travel.userId)),
                Permission.delete(Role.user(travel.userId)),
            ]
        );

        console.log('🧳 Travel announcement created successfully:', response.$id);
        console.log('🧳 DETAILED: Full response from createDocument:', JSON.stringify(response, null, 2));

        // Verify the document was actually created by trying to fetch it
        try {
            const verification = await databases.getDocument(
                config.databaseID!,
                config.travelCollectionID!,
                response.$id
            );
            console.log('✅ Verification: Document exists in database with ID:', verification.$id);
            console.log('✅ Verification: Document data keys:', Object.keys(verification));
            console.log('✅ Verification: Full document data:', JSON.stringify(verification, null, 2));
        } catch (verificationError) {
            console.error('❌ Verification FAILED: Document not found in database:', verificationError);
        }

        // Wait a moment and check again to see if it persists
        console.log('🧳 PERSISTENCE TEST: Waiting 2 seconds then checking if document still exists...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const persistenceCheck = await databases.getDocument(
                config.databaseID!,
                config.travelCollectionID!,
                response.$id
            );
            console.log('✅ PERSISTENCE TEST: Document still exists after 2 seconds:', persistenceCheck.$id);
        } catch (persistenceError) {
            console.error('❌ PERSISTENCE TEST FAILED: Document disappeared after 2 seconds:', persistenceError);
        }

        // Test if we can query for this document in the collection
        try {
            const queryTest = await databases.listDocuments(
                config.databaseID!,
                config.travelCollectionID!,
                [Query.equal('$id', response.$id)]
            );
            console.log('🔍 QUERY TEST: Found', queryTest.documents.length, 'documents with this ID');
            if (queryTest.documents.length > 0) {
                console.log('🔍 QUERY TEST: Document found via query:', queryTest.documents[0].$id);
            }
        } catch (queryError) {
            console.error('❌ QUERY TEST FAILED:', queryError);
        }

        // Test if we can list all documents in the collection to see total count
        // Add retry mechanism for potential eventual consistency issues
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`📊 COLLECTION TEST (Attempt ${attempt}): Checking collection...`);
                const allDocs = await databases.listDocuments(
                    config.databaseID!,
                    config.travelCollectionID!,
                    [Query.limit(100)]
                );
                console.log(`📊 COLLECTION TEST (Attempt ${attempt}): Total documents in travel collection:`, allDocs.total);
                console.log(`📊 COLLECTION TEST (Attempt ${attempt}): Documents returned:`, allDocs.documents.length);
                if (allDocs.documents.length > 0) {
                    console.log(`📊 COLLECTION TEST (Attempt ${attempt}): Sample document IDs:`, allDocs.documents.slice(0, 3).map(d => d.$id));
                    break; // Found documents, no need to retry
                } else if (attempt < 3) {
                    console.log(`📊 COLLECTION TEST (Attempt ${attempt}): No documents found, waiting 1 second before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (collectionError) {
                console.error(`❌ COLLECTION TEST (Attempt ${attempt}) FAILED:`, collectionError);
                if (attempt === 3) break;
            }
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

        return {
            $id: response.$id,
            id: response.$id,
            ...travelData,
            startDate: travelData.startDate.toISOString(),
            endDate: travelData.endDate.toISOString(),
            createdAt: response.$createdAt,
            updatedAt: response.$updatedAt,
            $createdAt: response.$createdAt,
            $updatedAt: response.$updatedAt,
        } as TravelAnnouncement;
    } catch (error) {
        console.error('🧳 createTravelAnnouncementWithFriendNotifications: Error:', error);

        // Log detailed error information
        if (error instanceof Error) {
            console.error('🧳 Error message:', error.message);
            console.error('🧳 Error stack:', error.stack);
        }

        // Check for specific Appwrite errors
        if (error && typeof error === 'object') {
            const appwriteError = error as any;
            if ('type' in appwriteError) {
                console.error('🧳 Appwrite error type:', appwriteError.type);
                console.error('🧳 Appwrite error code:', appwriteError.code);
                console.error('🧳 Appwrite error message:', appwriteError.message);
            }
        }

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
