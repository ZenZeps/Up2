// Debug script to investigate travel announcement collection issue
const { Client, Databases, Query } = require('react-native-appwrite');

// Configuration
const config = {
    endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || "https://syd.cloud.appwrite.io/v1",
    projectID: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || "685944b1003ba9c421ea",
    databaseID: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || "68594f14003e54ada2a4",
    travelCollectionID: process.env.EXPO_PUBLIC_APPWRITE_TRAVEL_COLLECTION_ID || "68594f4d0034f9a3bb1b",
};

// Initialize Appwrite
const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectID);

const databases = new Databases(client);

const debugTravelCollection = async () => {
    console.log('🔍 TRAVEL COLLECTION DEBUG');
    console.log('Travel Collection ID:', config.travelCollectionID);
    console.log('Database ID:', config.databaseID);
    console.log('Project ID:', config.projectID);

    try {
        // Test 1: Direct database query to see if collection exists and has data
        console.log('\n📋 Test 1: Direct collection query');
        const directQuery = await databases.listDocuments(
            config.databaseID,
            config.travelCollectionID,
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

            // Show all documents
            console.log('\nAll travel documents:');
            directQuery.documents.forEach((doc, index) => {
                console.log(`${index + 1}. ${doc.destination} by ${doc.userId} (${doc.startDate} to ${doc.endDate})`);
            });
        } else {
            console.log('❌ NO DOCUMENTS FOUND - This explains why travel announcements are not showing');
        }

        // Test 2: List all collections to see if travel collection exists
        console.log('\n📋 Test 2: List all collections in database');
        try {
            // Note: This requires admin privileges, might not work from client
            const collections = await databases.list();
            console.log('Available collections:', collections.collections?.map(c => ({ id: c.$id, name: c.name })));
        } catch (listError) {
            console.log('Cannot list collections (requires admin access)');
        }

    } catch (error) {
        console.error('❌ Error in travel collection debug:', error);

        // Check specific error types
        if (error.type === 'document_not_found') {
            console.log('🚨 COLLECTION NOT FOUND - Travel collection may have been deleted!');
        } else if (error.type === 'collection_not_found') {
            console.log('🚨 COLLECTION DOES NOT EXIST - Travel collection was deleted!');
        }

        console.log('Error details:', {
            type: error.type,
            code: error.code,
            message: error.message
        });
    }
};

// Run the debug
debugTravelCollection().catch(console.error);
