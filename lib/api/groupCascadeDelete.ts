/**
 * 🔥 Manual Cascade Deletion Functions for Groups
 * 
 * These functions provide manual cascade deletion for groups
 * when Appwrite database relationships are not properly configured.
 * 
 * When a group is deleted, we need to cascade delete:
 * - All group memberships
 * - All group events and their related data (attendances, chats, messages)
 * - All group chats and their messages
 */

import { config, databases } from '@/lib/appwrite/appwrite';
import { authDebug } from '@/lib/debug/authDebug';
import { cacheManager } from '@/lib/debug/cacheManager';
import { Query } from 'react-native-appwrite';
import { deleteEventWithCascade } from './cascadeDelete';

/**
 * Delete a group and ALL related data (memberships, events, chats, messages)
 * This function manually cascades the deletion when database relationships
 * are not configured with cascade deletion.
 */
export const deleteGroupWithCascade = async (groupId: string): Promise<boolean> => {
    try {
        authDebug.info(`🗑️ Starting manual cascade deletion for group: ${groupId}`);

        // Step 1: Find and delete all group events (which will cascade to their attendances, chats, messages)
        await deleteGroupEvents(groupId);

        // Step 2: Find and delete group-specific chats and messages
        await deleteGroupChats(groupId);

        // Step 3: Find and delete all group memberships
        await deleteGroupMemberships(groupId);

        // Step 4: Delete the group itself
        authDebug.info(`🗑️ Deleting group: ${groupId}`);
        await databases.deleteDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId
        );

        // Step 5: Clear caches
        cacheManager.remove(`group-${groupId}`);
        cacheManager.remove('all-groups');

        authDebug.info(`✅ Successfully deleted group ${groupId} with full cascade`);
        return true;

    } catch (error) {
        authDebug.error(`❌ Error in cascade deletion for group ${groupId}:`, error);
        throw new Error(`Failed to delete group with cascade: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Delete all events created by this group
 */
export const deleteGroupEvents = async (groupId: string): Promise<number> => {
    try {
        authDebug.info(`🗑️ Deleting events for group: ${groupId}`);

        // Find all events for this group
        const events = await databases.listDocuments(
            config.databaseID!,
            config.eventsCollectionID!,
            [
                Query.equal('groupId', groupId),
                Query.limit(100) // Limit to avoid overwhelming the system
            ]
        );

        // Delete each event using the existing cascade deletion
        let deletedCount = 0;
        for (const event of events.documents) {
            try {
                const success = await deleteEventWithCascade(event.$id);
                if (success) deletedCount++;
            } catch (deleteError) {
                authDebug.error(`Failed to delete group event ${event.$id}:`, deleteError);
            }
        }

        authDebug.info(`✅ Deleted ${deletedCount} events for group ${groupId}`);
        return deletedCount;

    } catch (error) {
        authDebug.error(`❌ Error deleting events for group ${groupId}:`, error);
        throw error;
    }
};

/**
 * Delete all chats associated with a group and all their messages
 */
export const deleteGroupChats = async (groupId: string): Promise<boolean> => {
    try {
        authDebug.info(`🗑️ Finding and deleting chats for group: ${groupId}`);

        // Find chats for this group
        const chats = await databases.listDocuments(
            config.databaseID!,
            config.chatsCollectionID!,
            [
                Query.equal('entityId', groupId),
                Query.equal('entityType', 'group')
            ]
        );

        if (chats.documents.length === 0) {
            authDebug.info(`No chats found for group ${groupId}`);
            return false;
        }

        // Delete each chat and its messages
        let deletedChats = 0;
        for (const chat of chats.documents) {
            const deleted = await deleteGroupChatWithMessages(chat.$id);
            if (deleted) deletedChats++;
        }

        authDebug.info(`✅ Deleted ${deletedChats} chats for group ${groupId}`);
        return deletedChats > 0;

    } catch (error) {
        authDebug.error(`❌ Error deleting chats for group ${groupId}:`, error);
        throw error;
    }
};

/**
 * Delete a group chat and all its messages
 */
export const deleteGroupChatWithMessages = async (chatId: string): Promise<boolean> => {
    try {
        authDebug.info(`🗑️ Deleting group chat and messages: ${chatId}`);

        // Step 1: Delete all messages in this chat
        const messagesDeleted = await deleteGroupChatMessages(chatId);

        // Step 2: Delete the chat itself
        await databases.deleteDocument(
            config.databaseID!,
            config.chatsCollectionID!,
            chatId
        );

        authDebug.info(`✅ Deleted group chat ${chatId} with ${messagesDeleted} messages`);
        return true;

    } catch (error) {
        authDebug.error(`❌ Error deleting group chat ${chatId}:`, error);
        throw error;
    }
};

/**
 * Delete all messages in a group chat
 */
export const deleteGroupChatMessages = async (chatId: string): Promise<number> => {
    try {
        authDebug.info(`🗑️ Deleting messages for group chat: ${chatId}`);

        // Find all messages for this chat (check both relationship and string fields)
        const messages = await databases.listDocuments(
            config.databaseID!,
            config.messagesCollectionID!,
            [
                Query.equal('chatId', chatId), // String field
                Query.limit(100) // Limit to avoid overwhelming the system
            ]
        );

        // Also try to find by relationship field if it exists
        try {
            const relationshipMessages = await databases.listDocuments(
                config.databaseID!,
                config.messagesCollectionID!,
                [
                    Query.equal('chat', chatId), // Relationship field
                    Query.limit(100)
                ]
            );

            // Merge results and deduplicate
            const allMessages = [...messages.documents];
            relationshipMessages.documents.forEach(message => {
                if (!allMessages.find(m => m.$id === message.$id)) {
                    allMessages.push(message);
                }
            });
            messages.documents = allMessages;
        } catch (relationshipError) {
            // Relationship field doesn't exist, continue with string field results
            authDebug.debug('Relationship field "chat" not found in messages, using string field only');
        }

        // Delete all found messages
        let deletedCount = 0;
        for (const message of messages.documents) {
            try {
                await databases.deleteDocument(
                    config.databaseID!,
                    config.messagesCollectionID!,
                    message.$id
                );
                deletedCount++;
            } catch (deleteError) {
                authDebug.error(`Failed to delete group message ${message.$id}:`, deleteError);
            }
        }

        authDebug.info(`✅ Deleted ${deletedCount} messages for group chat ${chatId}`);
        return deletedCount;

    } catch (error) {
        authDebug.error(`❌ Error deleting messages for group chat ${chatId}:`, error);
        throw error;
    }
};

/**
 * Delete all memberships for a specific group
 */
export const deleteGroupMemberships = async (groupId: string): Promise<number> => {
    try {
        authDebug.info(`🗑️ Deleting memberships for group: ${groupId}`);

        // Find all memberships for this group (check both relationship and string fields)
        const memberships = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            [
                Query.equal('groupId', groupId), // String field
                Query.limit(100) // Limit to avoid overwhelming the system
            ]
        );

        // Also try to find by relationship field if it exists
        try {
            const relationshipMemberships = await databases.listDocuments(
                config.databaseID!,
                config.groupMembershipsCollectionID!,
                [
                    Query.equal('group', groupId), // Relationship field
                    Query.limit(100)
                ]
            );

            // Merge results and deduplicate
            const allMemberships = [...memberships.documents];
            relationshipMemberships.documents.forEach(membership => {
                if (!allMemberships.find(m => m.$id === membership.$id)) {
                    allMemberships.push(membership);
                }
            });
            memberships.documents = allMemberships;
        } catch (relationshipError) {
            // Relationship field doesn't exist, continue with string field results
            authDebug.debug('Relationship field "group" not found in memberships, using string field only');
        }

        // Delete all found memberships
        let deletedCount = 0;
        for (const membership of memberships.documents) {
            try {
                await databases.deleteDocument(
                    config.databaseID!,
                    config.groupMembershipsCollectionID!,
                    membership.$id
                );
                deletedCount++;
            } catch (deleteError) {
                authDebug.error(`Failed to delete group membership ${membership.$id}:`, deleteError);
            }
        }

        authDebug.info(`✅ Deleted ${deletedCount} memberships for group ${groupId}`);
        return deletedCount;

    } catch (error) {
        authDebug.error(`❌ Error deleting memberships for group ${groupId}:`, error);
        throw error;
    }
};

/**
 * Test the group cascade deletion
 */
export const testGroupCascadeDeletion = async (testUserId: string) => {
    try {
        console.log('🧪 Testing Group Cascade Deletion');
        console.log('==================================');

        // Create a test group
        const testGroup = await databases.createDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            'test-cascade-group',
            {
                title: 'Test Cascade Group',
                description: 'Testing group cascade deletion',
                creatorId: testUserId,
                isPrivate: false,
                category: 'Social'
            }
        );

        console.log('✅ Created test group:', testGroup.$id);

        // Create test membership
        const testMembership = await databases.createDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            'test-cascade-membership',
            {
                groupId: testGroup.$id,
                userId: testUserId,
                role: 'owner',
                joinedAt: new Date().toISOString()
            }
        );

        console.log('✅ Created test membership:', testMembership.$id);

        // Create test group event
        const testEvent = await databases.createDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            'test-group-event',
            {
                title: 'Test Group Event',
                description: 'Testing group event cascade deletion',
                startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
                location: 'Test Location',
                creatorId: testUserId,
                groupId: testGroup.$id,
                attendees: [],
                inviteeIds: [],
                tags: []
            }
        );

        console.log('✅ Created test group event:', testEvent.$id);

        // Create test group chat
        const testChat = await databases.createDocument(
            config.databaseID!,
            config.chatsCollectionID!,
            'test-group-chat',
            {
                entityId: testGroup.$id,
                entityType: 'group',
                name: 'Test Group Chat'
            }
        );

        console.log('✅ Created test group chat:', testChat.$id);

        // Create test message
        const testMessage = await databases.createDocument(
            config.databaseID!,
            config.messagesCollectionID!,
            'test-group-message',
            {
                chatId: testChat.$id,
                authorId: testUserId,
                content: 'Test message for group cascade deletion',
                authorName: 'Test User',
                authorPhotoUrl: '',
                isEdited: false
            }
        );

        console.log('✅ Created test group message:', testMessage.$id);

        // Now test group cascade deletion
        console.log('🗑️ Testing group cascade deletion...');
        await deleteGroupWithCascade(testGroup.$id);

        // Verify everything was deleted
        let testPassed = true;

        try {
            await databases.getDocument(config.databaseID!, config.groupMembershipsCollectionID!, testMembership.$id);
            console.log('❌ Group membership still exists');
            testPassed = false;
        } catch (error) {
            console.log('✅ Group membership deleted successfully');
        }

        try {
            await databases.getDocument(config.databaseID!, config.eventsCollectionID!, testEvent.$id);
            console.log('❌ Group event still exists');
            testPassed = false;
        } catch (error) {
            console.log('✅ Group event deleted successfully');
        }

        try {
            await databases.getDocument(config.databaseID!, config.chatsCollectionID!, testChat.$id);
            console.log('❌ Group chat still exists');
            testPassed = false;
        } catch (error) {
            console.log('✅ Group chat deleted successfully');
        }

        try {
            await databases.getDocument(config.databaseID!, config.messagesCollectionID!, testMessage.$id);
            console.log('❌ Group message still exists');
            testPassed = false;
        } catch (error) {
            console.log('✅ Group message deleted successfully');
        }

        try {
            await databases.getDocument(config.databaseID!, config.groupsCollectionID!, testGroup.$id);
            console.log('❌ Group still exists');
            testPassed = false;
        } catch (error) {
            console.log('✅ Group deleted successfully');
        }

        if (testPassed) {
            console.log('🎉 Group cascade deletion test PASSED!');
            return { success: true, message: 'Group cascade deletion is working correctly' };
        } else {
            console.log('❌ Group cascade deletion test FAILED');
            return { success: false, message: 'Some group items were not deleted properly' };
        }

    } catch (error) {
        console.error('❌ Group test failed:', error);
        return { success: false, message: `Group test failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
};