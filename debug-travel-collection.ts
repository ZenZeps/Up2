// Debug script to investigate travel announcement collection issue
import { getFriendsTravelAnnouncements, getUserTravelAnnouncements } from '@/lib/api/travel';
import { config, databases, Query } from '@/lib/appwrite/appwrite';

const debugTravelCollection = async () => {
    console.log('🔍 TRAVEL COLLECTION DEBUG');
    console.log('Travel Collection ID:', config.travelCollectionID);

    try {
        // Test 1: Direct database query to see if collection exists and has data
        console.log('\n📋 Test 1: Direct collection query');
        const directQuery = await databases.listDocuments(
            config.databaseID!,
            config.travelCollectionID!,
            [Query.orderDesc('$createdAt'), Query.limit(10)]
        );
        console.log(`Found ${directQuery.documents.length} documents in travel collection`);
        if (directQuery.documents.length > 0) {
            console.log('Sample document structure:', {
                id: directQuery.documents[0].$id,
                userId: directQuery.documents[0].userId,
                destination: directQuery.documents[0].destination,
                fields: Object.keys(directQuery.documents[0])
            });
        }

        // Test 2: Try to get user travel announcements 
        console.log('\n👤 Test 2: getUserTravelAnnouncements');
        const sampleUserId = directQuery.documents[0]?.userId || 'test_user_id';
        const userTravel = await getUserTravelAnnouncements(sampleUserId);
        console.log(`getUserTravelAnnouncements returned ${userTravel.length} results for user ${sampleUserId}`);

        // Test 3: Try to get friends travel announcements
        console.log('\n👥 Test 3: getFriendsTravelAnnouncements');
        const allUserIds = [...new Set(directQuery.documents.map(doc => doc.userId))];
        console.log('All user IDs found:', allUserIds);
        const friendsTravel = await getFriendsTravelAnnouncements(allUserIds.slice(0, 5));
        console.log(`getFriendsTravelAnnouncements returned ${friendsTravel.length} results`);

        // Test 4: Check for any errors in data format
        console.log('\n🔍 Test 4: Data validation');
        directQuery.documents.forEach((doc, index) => {
            const requiredFields = ['userId', 'destination', 'startDate', 'endDate'];
            const missingFields = requiredFields.filter(field => !doc[field]);
            if (missingFields.length > 0) {
                console.log(`Document ${index} missing fields:`, missingFields);
            }
        });

    } catch (error) {
        console.error('❌ Error in travel collection debug:', error);

        // Check if it's a collection not found error
        if (error instanceof Error && error.message?.includes('Collection with the requested ID could not be found')) {
            console.log('🚨 COLLECTION NOT FOUND - Travel collection may have been deleted!');
            console.log('Expected Collection ID:', config.travelCollectionID);
        }
    }
};

// Run the debug
debugTravelCollection().catch(console.error);
