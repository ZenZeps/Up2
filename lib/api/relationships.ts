/**
 * 🔄 Relationship API Helpers
 * 
 * These helpers work with both string references AND relationship attributes
 * during the migration period. Once migration is complete, you can simplify these.
 */

import { config, databases, ID, Query } from '@/lib/appwrite/appwrite';

/**
 * Create an event with relationship support
 */
export const createEventWithRelationship = async (eventData: any, userId: string) => {
    try {
        const payload = {
            ...eventData,
            // Use relationship field (new)
            creator: userId,
            // Keep string field temporarily for compatibility (remove after migration)
            creatorId: userId
        };

        const event = await databases.createDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            ID.unique(),
            payload
        );

        return event;
    } catch (error) {
        console.error('Error creating event with relationship:', error);
        throw error;
    }
};

/**
 * Create event attendance with relationship support
 */
export const createEventAttendanceWithRelationship = async (eventId: string, userId: string, status: string = 'attending') => {
    try {
        const payload = {
            // Use relationship fields (new)
            event: eventId,
            user: userId,
            // Keep string fields temporarily for compatibility
            eventId,
            userId,
            status
        };

        const attendance = await databases.createDocument(
            config.databaseID!,
            config.eventAttendancesCollectionID!,
            ID.unique(),
            payload
        );

        return attendance;
    } catch (error) {
        console.error('Error creating attendance with relationship:', error);
        throw error;
    }
};

/**
 * Create group membership with relationship support
 */
export const createGroupMembershipWithRelationship = async (groupId: string, userId: string, role: string = 'member') => {
    try {
        const payload = {
            // Use relationship fields (new)
            group: groupId,
            user: userId,
            // Keep string fields temporarily for compatibility
            groupId,
            userId,
            role
        };

        const membership = await databases.createDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            ID.unique(),
            payload
        );

        return membership;
    } catch (error) {
        console.error('Error creating membership with relationship:', error);
        throw error;
    }
};

/**
 * Create user friendship with relationship support
 */
export const createUserFriendshipWithRelationship = async (userId1: string, userId2: string, status: string = 'accepted') => {
    try {
        const payload = {
            // Use relationship fields (new)
            user1: userId1,
            user2: userId2,
            // Keep string fields temporarily for compatibility
            userId1,
            userId2,
            status
        };

        const friendship = await databases.createDocument(
            config.databaseID!,
            config.userFriendshipsCollectionID!,
            ID.unique(),
            payload
        );

        return friendship;
    } catch (error) {
        console.error('Error creating friendship with relationship:', error);
        throw error;
    }
};

/**
 * Create message with relationship support
 */
export const createMessageWithRelationship = async (chatId: string, senderId: string, content: string) => {
    try {
        const payload = {
            // Use relationship fields (new)
            chat: chatId,
            sender: senderId,
            // Keep string fields temporarily for compatibility
            chatId,
            senderId,
            content
        };

        const message = await databases.createDocument(
            config.databaseID!,
            config.messagesCollectionID!,
            ID.unique(),
            payload
        );

        return message;
    } catch (error) {
        console.error('Error creating message with relationship:', error);
        throw error;
    }
};

/**
 * Query events by creator using relationship
 */
export const getEventsByCreatorRelationship = async (creatorId: string) => {
    try {
        // Try relationship field first
        try {
            const events = await databases.listDocuments(
                config.databaseID!,
                config.eventsCollectionID!,
                [
                    Query.equal('creator', creatorId),
                    Query.orderDesc('$createdAt')
                ]
            );
            return events.documents;
        } catch (relationshipError) {
            // Fallback to string field if relationship not available yet
            console.log('Falling back to string field query');
            const events = await databases.listDocuments(
                config.databaseID!,
                config.eventsCollectionID!,
                [
                    Query.equal('creatorId', creatorId),
                    Query.orderDesc('$createdAt')
                ]
            );
            return events.documents;
        }
    } catch (error) {
        console.error('Error getting events by creator:', error);
        throw error;
    }
};

/**
 * Query attendances by user using relationship
 */
export const getAttendancesByUserRelationship = async (userId: string) => {
    try {
        // Try relationship field first
        try {
            const attendances = await databases.listDocuments(
                config.databaseID!,
                config.eventAttendancesCollectionID!,
                [
                    Query.equal('user', userId),
                    Query.orderDesc('$createdAt')
                ]
            );
            return attendances.documents;
        } catch (relationshipError) {
            // Fallback to string field
            const attendances = await databases.listDocuments(
                config.databaseID!,
                config.eventAttendancesCollectionID!,
                [
                    Query.equal('userId', userId),
                    Query.orderDesc('$createdAt')
                ]
            );
            return attendances.documents;
        }
    } catch (error) {
        console.error('Error getting attendances by user:', error);
        throw error;
    }
};

/**
 * Query messages by sender using relationship
 */
export const getMessagesBySenderRelationship = async (senderId: string) => {
    try {
        // Try relationship field first
        try {
            const messages = await databases.listDocuments(
                config.databaseID!,
                config.messagesCollectionID!,
                [
                    Query.equal('sender', senderId),
                    Query.orderDesc('$createdAt')
                ]
            );
            return messages.documents;
        } catch (relationshipError) {
            // Fallback to string field
            const messages = await databases.listDocuments(
                config.databaseID!,
                config.messagesCollectionID!,
                [
                    Query.equal('senderId', senderId),
                    Query.orderDesc('$createdAt')
                ]
            );
            return messages.documents;
        }
    } catch (error) {
        console.error('Error getting messages by sender:', error);
        throw error;
    }
};

/**
 * Test cascade deletion functionality
 */
export const testCascadeDeletion = async () => {
    console.log('🧪 Testing cascade deletion...');

    try {
        // Create a test user
        const testUser = await databases.createDocument(
            config.databaseID!,
            config.usersCollectionID!,
            ID.unique(),
            {
                name: 'Test User for Cascade',
                email: `test-cascade-${Date.now()}@example.com`,
                username: `testcascade${Date.now()}`
            }
        );

        console.log('✅ Created test user:', testUser.$id);

        // Create a test event
        const testEvent = await createEventWithRelationship({
            title: 'Test Event for Cascade',
            description: 'This will be deleted when user is deleted',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 86400000).toISOString() // +1 day
        }, testUser.$id);

        console.log('✅ Created test event:', testEvent.$id);

        // Create an attendance
        const testAttendance = await createEventAttendanceWithRelationship(
            testEvent.$id,
            testUser.$id,
            'attending'
        );

        console.log('✅ Created test attendance:', testAttendance.$id);

        console.log('⏳ Waiting 2 seconds before deletion test...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Now delete the user - this should cascade delete the event and attendance
        await databases.deleteDocument(
            config.databaseID!,
            config.usersCollectionID!,
            testUser.$id
        );

        console.log('✅ Deleted test user');

        // Check if event and attendance were cascade deleted
        try {
            await databases.getDocument(
                config.databaseID!,
                config.eventsCollectionID!,
                testEvent.$id
            );
            console.log('❌ Event was NOT cascade deleted - relationships may not be set up correctly');
        } catch (error) {
            console.log('✅ Event was cascade deleted successfully');
        }

        try {
            await databases.getDocument(
                config.databaseID!,
                config.eventAttendancesCollectionID!,
                testAttendance.$id
            );
            console.log('❌ Attendance was NOT cascade deleted - relationships may not be set up correctly');
        } catch (error) {
            console.log('✅ Attendance was cascade deleted successfully');
        }

        console.log('🎉 Cascade deletion test completed!');

    } catch (error) {
        console.error('❌ Error in cascade deletion test:', error);
        throw error;
    }
};

export default {
    createEventWithRelationship,
    createEventAttendanceWithRelationship,
    createGroupMembershipWithRelationship,
    createUserFriendshipWithRelationship,
    createMessageWithRelationship,
    getEventsByCreatorRelationship,
    getAttendancesByUserRelationship,
    getMessagesBySenderRelationship,
    testCascadeDeletion
};