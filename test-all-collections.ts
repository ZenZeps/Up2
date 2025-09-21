// Debug script to test all collection IDs and see which ones are valid
import { config, databases, Query } from '@/lib/appwrite/appwrite';

export const testAllCollections = async () => {
    console.log('🔍 TESTING ALL COLLECTION IDs');

    const collections = {
        users: config.usersCollectionID,
        events: config.eventsCollectionID,
        friendships: config.userFriendshipsCollectionID,
        eventAttendances: config.eventAttendancesCollectionID,
        travel: config.travelCollectionID,
        groups: config.groupsCollectionID,
        groupMemberships: config.groupMembershipsCollectionID,
        chats: config.chatsCollectionID,
        messages: config.messagesCollectionID,
    };

    for (const [name, collectionId] of Object.entries(collections)) {
        try {
            console.log(`\n📋 Testing ${name} collection: ${collectionId}`);

            if (!collectionId || collectionId.includes('temp_') || collectionId === 'event_attendances') {
                console.log(`❌ ${name}: Invalid collection ID - ${collectionId}`);
                continue;
            }

            const response = await databases.listDocuments(
                config.databaseID!,
                collectionId,
                [Query.limit(1)]
            );

            console.log(`✅ ${name}: Collection exists, ${response.total} documents`);
        } catch (error) {
            if (error instanceof Error && error.message.includes('Collection with the requested ID could not be found')) {
                console.log(`❌ ${name}: Collection NOT FOUND - ${collectionId}`);
            } else {
                console.log(`❌ ${name}: Error - ${error}`);
            }
        }
    }
};

export { };

