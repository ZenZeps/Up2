import { Query } from 'react-native-appwrite';
import { config, databases } from './lib/appwrite/appwrite';

/**
 * Debug script to check notification tokens collection schema
 */
async function debugNotificationTokensCollection() {
    console.log('🔍 Debugging Notification Tokens Collection...\n');

    const collectionId = config.notificationTokensCollectionID;
    console.log('Collection ID:', collectionId);

    try {
        // Try to list documents to see what attributes exist
        console.log('\n1. Testing collection access...');
        const result = await databases.listDocuments(
            config.databaseID!,
            collectionId,
            [Query.limit(1)]
        );

        console.log('✅ Collection exists and is accessible');
        console.log('Documents found:', result.documents.length);

        if (result.documents.length > 0) {
            console.log('\n2. Sample document structure:');
            const sampleDoc = result.documents[0];
            console.log('Document keys:', Object.keys(sampleDoc));
            console.log('Sample document:', sampleDoc);
        }

        // Try a query with userId to see the exact error
        console.log('\n3. Testing userId query...');
        try {
            await databases.listDocuments(
                config.databaseID!,
                collectionId,
                [
                    Query.equal('userId', 'test_user_id'),
                    Query.limit(1)
                ]
            );
            console.log('✅ userId attribute exists and is queryable');
        } catch (queryError: any) {
            console.log('❌ Error querying userId:', queryError.message);
            console.log('This indicates the userId attribute is missing from the collection schema');
        }

    } catch (error: any) {
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
        }
    }
}

// Run the debug
debugNotificationTokensCollection().catch(console.error);
