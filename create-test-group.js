// Simple group creation test
import { ID } from 'appwrite';
import { config, databases } from './lib/appwrite/appwrite';

async function createTestGroup() {
    try {
        console.log('Creating a test public group...');

        const testGroup = await databases.createDocument(
            config.databaseID,
            config.groupsCollectionID,
            ID.unique(),
            {
                title: "Test Public Group",
                description: "A test group to verify public group functionality",
                creatorId: "test_user_id",
                isPublic: true,
                users: [],
                events: [],
                memberCount: 1
            }
        );

        console.log('✅ Test group created:', testGroup);
        return testGroup;
    } catch (error) {
        console.error('❌ Failed to create test group:', error);
        throw error;
    }
}

createTestGroup();
