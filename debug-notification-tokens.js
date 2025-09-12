const { Client, Databases, Query } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

/**
 * Debug script to check notification tokens collection schema
 */
async function debugNotificationTokensCollection() {
    console.log('🔍 Debugging Notification Tokens Collection...\n');

    // Initialize Appwrite client
    const client = new Client();
    client
        .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT)
        .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID)
        .setKey(process.env.EXPO_PUBLIC_API_KEY); // You'll need an API key for server-side access

    const databases = new Databases(client);
    const databaseId = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID;
    const collectionId = process.env.EXPO_PUBLIC_APPWRITE_NOTIFICATION_TOKENS_ID;

    console.log('Database ID:', databaseId);
    console.log('Collection ID:', collectionId);

    try {
        // Try to list documents to see what attributes exist
        console.log('\n1. Testing collection access...');
        const result = await databases.listDocuments(
            databaseId,
            collectionId,
            [Query.limit(1)]
        );

        console.log('✅ Collection exists and is accessible');
        console.log('Documents found:', result.documents.length);

        if (result.documents.length > 0) {
            console.log('\n2. Sample document structure:');
            const sampleDoc = result.documents[0];
            console.log('Document keys:', Object.keys(sampleDoc));
            console.log('Sample document:', JSON.stringify(sampleDoc, null, 2));
        }

        // Try a query with userId to see the exact error
        console.log('\n3. Testing userId query...');
        try {
            await databases.listDocuments(
                databaseId,
                collectionId,
                [
                    Query.equal('userId', 'test_user_id'),
                    Query.limit(1)
                ]
            );
            console.log('✅ userId attribute exists and is queryable');
        } catch (queryError) {
            console.log('❌ Error querying userId:', queryError.message);
            console.log('This indicates the userId attribute is missing from the collection schema');
        }

    } catch (error) {
        console.log('❌ Collection access failed:', error.message);

        if (error.message?.includes('Collection with the requested ID could not be found')) {
            console.log('\n📋 TO FIX: Create the notification_tokens collection in Appwrite');
            console.log('Required attributes:');
            console.log('- userId (String, required)');
            console.log('- deviceToken (String, required)');
            console.log('- deviceType (String, required)');
            console.log('- enabled (Boolean, required, default: true)');
            console.log('- lastUsed (String, required)');
            console.log('- deviceId (String, optional)');
            console.log('- appVersion (String, optional)');
        } else if (error.message?.includes('Missing or invalid API key')) {
            console.log('\n📋 TO FIX: Add EXPO_PUBLIC_API_KEY to .env.local for server-side access');
            console.log('You can create an API key in your Appwrite console under Project Settings > API Keys');
        }
    }
}

// Run the debug
debugNotificationTokensCollection().catch(console.error);
