/**
 * Database Collection Diagnostic Tool
 * Checks if all required collections exist and have proper IDs
 */

import { config, databases } from '../appwrite/appwrite';

async function checkCollectionExists(collectionId: string, collectionName: string) {
    try {
        if (collectionId.startsWith('temp_') || collectionId.includes('_')) {
            console.log(`❌ ${collectionName}: Using placeholder ID (${collectionId})`);
            return false;
        }

        // Try to list documents from the collection to verify it exists
        const response = await databases.listDocuments(config.databaseID!, collectionId);
        console.log(`✅ ${collectionName}: Found (${collectionId}) - ${response.total} documents`);
        return true;
    } catch (error: any) {
        console.log(`❌ ${collectionName}: Not found or invalid ID (${collectionId})`);
        console.log(`   Error: ${error.message || error}`);
        return false;
    }
}

async function runCollectionDiagnostic() {
    console.log('🔍 DATABASE COLLECTION DIAGNOSTIC');
    console.log('================================');

    const collections = [
        { id: config.usersCollectionID, name: 'Users Collection' },
        { id: config.eventsCollectionID, name: 'Events Collection' },
        { id: config.friendRequestsCollectionID, name: 'Friend Requests Collection' },
        { id: config.userFriendshipsCollectionID, name: 'User Friendships Collection (Junction Table)' },
        { id: config.eventAttendancesCollectionID, name: 'Event Attendances Collection (Junction Table)' },
        { id: config.groupsCollectionID, name: 'Groups Collection' },
        { id: config.groupMembershipsCollectionID, name: 'Group Memberships Collection (Junction Table)' },
        { id: config.groupInvitesCollectionID, name: 'Group Invites Collection' },
        { id: config.travelCollectionID, name: 'Travel Collection' },
        { id: config.chatsCollectionID, name: 'Chats Collection' },
        { id: config.messagesCollectionID, name: 'Messages Collection' },
    ];

    console.log('\n📋 Current Configuration:');
    collections.forEach(collection => {
        console.log(`   ${collection.name}: ${collection.id}`);
    });

    console.log('\n🔍 Checking Collection Existence:');

    let validCount = 0;
    for (const collection of collections) {
        const exists = await checkCollectionExists(collection.id!, collection.name);
        if (exists) validCount++;

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📊 DIAGNOSTIC SUMMARY:');
    console.log(`✅ Valid Collections: ${validCount}/${collections.length}`);
    console.log(`❌ Missing/Invalid: ${collections.length - validCount}/${collections.length}`);

    if (validCount < collections.length) {
        console.log('\n🚨 REQUIRED ACTIONS:');
        console.log('1. Create missing collections in your Appwrite database');
        console.log('2. Update your .env.local with actual collection IDs');
        console.log('3. Ensure each collection has proper permissions and indexes');
        console.log('\n📘 For collection creation guide, see:');
        console.log('   - APPLICATION_MIGRATION_GUIDE.md');
        console.log('   - JUNCTION_TABLE_IMPLEMENTATION_COMPLETE.md');
    } else {
        console.log('\n🎉 All collections are properly configured!');
    }
}

// Export for manual usage
export { checkCollectionExists, runCollectionDiagnostic };

// Run automatically if called directly
if (require.main === module) {
    runCollectionDiagnostic().catch(console.error);
}
