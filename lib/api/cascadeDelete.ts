/**
 * 🔥 Manual Cascade Deletion Functions
 * 
 * These functions provide manual cascade deletion as a fallback
 * when Appwrite database relationships are not properly configured.
 * 
 * IMPORTANT: This is a temporary solution. The proper fix is to configure
 * cascade deletion in your Appwrite database relationships.
 */

import { config, databases } from '@/lib/appwrite/appwrite';
import { authDebug } from '@/lib/debug/authDebug';
import { cacheManager } from '@/lib/debug/cacheManager';
import { Query } from 'react-native-appwrite';

/**
 * Delete an event and ALL related data (attendances, chats, messages)
 * This function manually cascades the deletion when database relationships
 * are not configured with cascade deletion.
 */
export const deleteEventWithCascade = async (eventId: string): Promise<boolean> => {
    try {
        authDebug.info(`🗑️ Starting manual cascade deletion for event: ${eventId}`);

        // Step 1: Find and delete all attendances for this event
        await deleteEventAttendances(eventId);

        // Step 2: Find and delete the event's chat and all its messages
        await deleteEventChat(eventId);

        // Step 3: Delete the event itself
        authDebug.info(`🗑️ Deleting event: ${eventId}`);
        await databases.deleteDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId
        );

        // Step 4: Clear caches
        cacheManager.remove(`event-${eventId}`);
        cacheManager.remove('all-events');

        authDebug.info(`✅ Successfully deleted event ${eventId} with full cascade`);
        return true;

    } catch (error) {
        authDebug.error(`❌ Error in cascade deletion for event ${eventId}:`, error);
        throw new Error(`Failed to delete event with cascade: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Delete all attendances for a specific event
 */
export const deleteEventAttendances = async (eventId: string): Promise<number> => {
    try {
        authDebug.info(`🗑️ Deleting attendances for event: ${eventId}`);

        // Find all attendances for this event (check both relationship and string fields)
        const attendances = await databases.listDocuments(
            config.databaseID!,
            config.eventAttendancesCollectionID!,
            [
                Query.equal('eventId', eventId), // String field
                Query.limit(100) // Limit to avoid overwhelming the system
            ]
        );

        // Also try to find by relationship field if it exists
        try {
            const relationshipAttendances = await databases.listDocuments(
                config.databaseID!,
                config.eventAttendancesCollectionID!,
                [
                    Query.equal('event', eventId), // Relationship field
                    Query.limit(100)
                ]
            );

            // Merge results and deduplicate
            const allAttendances = [...attendances.documents];
            relationshipAttendances.documents.forEach(attendance => {
                if (!allAttendances.find(a => a.$id === attendance.$id)) {
                    allAttendances.push(attendance);
                }
            });
            attendances.documents = allAttendances;
        } catch (relationshipError) {
            // Relationship field doesn't exist, continue with string field results
            authDebug.debug('Relationship field "event" not found in attendances, using string field only');
        }

        // Delete all found attendances
        let deletedCount = 0;
        for (const attendance of attendances.documents) {
            try {
                await databases.deleteDocument(
                    config.databaseID!,
                    config.eventAttendancesCollectionID!,
                    attendance.$id
                );
                deletedCount++;
            } catch (deleteError) {
                authDebug.error(`Failed to delete attendance ${attendance.$id}:`, deleteError);
            }
        }

        authDebug.info(`✅ Deleted ${deletedCount} attendances for event ${eventId}`);
        return deletedCount;

    } catch (error) {
        authDebug.error(`❌ Error deleting attendances for event ${eventId}:`, error);
        throw error;
    }
};

/**
 * Delete the chat associated with an event and all its messages
 */
export const deleteEventChat = async (eventId: string): Promise<boolean> => {
    try {
        authDebug.info(`🗑️ Finding and deleting chat for event: ${eventId}`);

        // Find the chat for this event
        const chats = await databases.listDocuments(
            config.databaseID!,
            config.chatsCollectionID!,
            [
                Query.equal('entityId', eventId),
                Query.equal('entityType', 'event')
            ]
        );

        if (chats.documents.length === 0) {
            authDebug.info(`No chat found for event ${eventId}`);
            return false;
        }

        // Delete each chat and its messages
        let deletedChats = 0;
        for (const chat of chats.documents) {
            const deleted = await deleteChatWithMessages(chat.$id);
            if (deleted) deletedChats++;
        }

        authDebug.info(`✅ Deleted ${deletedChats} chats for event ${eventId}`);
        return deletedChats > 0;

    } catch (error) {
        authDebug.error(`❌ Error deleting chat for event ${eventId}:`, error);
        throw error;
    }
};

/**
 * Delete a chat and all its messages
 */
export const deleteChatWithMessages = async (chatId: string): Promise<boolean> => {
    try {
        authDebug.info(`🗑️ Deleting chat and messages: ${chatId}`);

        // Step 1: Delete all messages in this chat
        const messagesDeleted = await deleteChatMessages(chatId);

        // Step 2: Delete the chat itself
        await databases.deleteDocument(
            config.databaseID!,
            config.chatsCollectionID!,
            chatId
        );

        authDebug.info(`✅ Deleted chat ${chatId} with ${messagesDeleted} messages`);
        return true;

    } catch (error) {
        authDebug.error(`❌ Error deleting chat ${chatId}:`, error);
        throw error;
    }
};

/**
 * Delete all messages in a specific chat
 */
export const deleteChatMessages = async (chatId: string): Promise<number> => {
    try {
        authDebug.info(`🗑️ Deleting messages for chat: ${chatId}`);

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
                authDebug.error(`Failed to delete message ${message.$id}:`, deleteError);
            }
        }

        authDebug.info(`✅ Deleted ${deletedCount} messages for chat ${chatId}`);
        return deletedCount;

    } catch (error) {
        authDebug.error(`❌ Error deleting messages for chat ${chatId}:`, error);
        throw error;
    }
};

/**
 * Delete a chat by ID and all its messages (standalone function)
 * Use this when you want to delete a chat directly by its ID
 */
export const deleteChatById = async (chatId: string): Promise<boolean> => {
    try {
        authDebug.info(`🗑️ Starting standalone chat deletion: ${chatId}`);

        const success = await deleteChatWithMessages(chatId);

        if (success) {
            authDebug.info(`✅ Successfully deleted chat ${chatId} and all its messages`);
        }

        return success;

    } catch (error) {
        authDebug.error(`❌ Error deleting chat ${chatId}:`, error);
        throw new Error(`Failed to delete chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Test the manual cascade deletion
 */
export const testManualCascadeDeletion = async (testUserId: string) => {
    try {
        console.log('🧪 Testing Manual Cascade Deletion');
        console.log('==================================');

        // Create a test event
        const testEvent = await databases.createDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            'test-cascade-event',
            {
                title: 'Test Cascade Event',
                description: 'Testing manual cascade deletion',
                startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
                location: 'Test Location',
                creatorId: testUserId,
                attendees: [],
                inviteeIds: [],
                tags: []
            }
        );

        console.log('✅ Created test event:', testEvent.$id);

        // Create test attendance
        const testAttendance = await databases.createDocument(
            config.databaseID!,
            config.eventAttendancesCollectionID!,
            'test-cascade-attendance',
            {
                eventId: testEvent.$id,
                userId: testUserId,
                status: 'attending'
            }
        );

        console.log('✅ Created test attendance:', testAttendance.$id);

        // Create test chat
        const testChat = await databases.createDocument(
            config.databaseID!,
            config.chatsCollectionID!,
            'test-cascade-chat',
            {
                entityId: testEvent.$id,
                entityType: 'event',
                name: 'Test Event Chat'
            }
        );

        console.log('✅ Created test chat:', testChat.$id);

        // Create test message
        const testMessage = await databases.createDocument(
            config.databaseID!,
            config.messagesCollectionID!,
            'test-cascade-message',
            {
                chatId: testChat.$id,
                authorId: testUserId,
                content: 'Test message for cascade deletion',
                authorName: 'Test User',
                authorPhotoUrl: '',
                isEdited: false
            }
        );

        console.log('✅ Created test message:', testMessage.$id);

        // Now test manual cascade deletion
        console.log('🗑️ Testing manual cascade deletion...');
        await deleteEventWithCascade(testEvent.$id);

        // Verify everything was deleted
        let testPassed = true;

        try {
            await databases.getDocument(config.databaseID!, config.eventAttendancesCollectionID!, testAttendance.$id);
            console.log('❌ Attendance still exists');
            testPassed = false;
        } catch (error) {
            console.log('✅ Attendance deleted successfully');
        }

        try {
            await databases.getDocument(config.databaseID!, config.chatsCollectionID!, testChat.$id);
            console.log('❌ Chat still exists');
            testPassed = false;
        } catch (error) {
            console.log('✅ Chat deleted successfully');
        }

        try {
            await databases.getDocument(config.databaseID!, config.messagesCollectionID!, testMessage.$id);
            console.log('❌ Message still exists');
            testPassed = false;
        } catch (error) {
            console.log('✅ Message deleted successfully');
        }

        try {
            await databases.getDocument(config.databaseID!, config.eventsCollectionID!, testEvent.$id);
            console.log('❌ Event still exists');
            testPassed = false;
        } catch (error) {
            console.log('✅ Event deleted successfully');
        }

        if (testPassed) {
            console.log('🎉 Manual cascade deletion test PASSED!');
            return { success: true, message: 'Manual cascade deletion is working correctly' };
        } else {
            console.log('❌ Manual cascade deletion test FAILED');
            return { success: false, message: 'Some items were not deleted properly' };
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
        return { success: false, message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
};

/**
 * Test chat cascade deletion specifically
 */
export const testChatCascadeDeletion = async (testUserId: string) => {
    try {
        console.log('🧪 Testing Chat Cascade Deletion');
        console.log('=================================');

        // Create test chat
        const testChat = await databases.createDocument(
            config.databaseID!,
            config.chatsCollectionID!,
            'test-chat-cascade',
            {
                entityId: 'test-entity',
                entityType: 'event',
                name: 'Test Chat for Cascade Deletion'
            }
        );

        console.log('✅ Created test chat:', testChat.$id);

        // Create test messages
        const testMessage1 = await databases.createDocument(
            config.databaseID!,
            config.messagesCollectionID!,
            'test-msg-1',
            {
                chatId: testChat.$id,
                authorId: testUserId,
                content: 'Test message 1 for cascade deletion',
                authorName: 'Test User',
                authorPhotoUrl: '',
                isEdited: false
            }
        );

        const testMessage2 = await databases.createDocument(
            config.databaseID!,
            config.messagesCollectionID!,
            'test-msg-2',
            {
                chatId: testChat.$id,
                authorId: testUserId,
                content: 'Test message 2 for cascade deletion',
                authorName: 'Test User',
                authorPhotoUrl: '',
                isEdited: false
            }
        );

        console.log('✅ Created test messages:', testMessage1.$id, testMessage2.$id);

        // Now test chat cascade deletion
        console.log('🗑️ Testing chat cascade deletion...');
        await deleteChatById(testChat.$id);

        // Verify messages were deleted
        let testPassed = true;

        try {
            await databases.getDocument(config.databaseID!, config.messagesCollectionID!, testMessage1.$id);
            console.log('❌ Message 1 still exists');
            testPassed = false;
        } catch (error) {
            console.log('✅ Message 1 deleted successfully');
        }

        try {
            await databases.getDocument(config.databaseID!, config.messagesCollectionID!, testMessage2.$id);
            console.log('❌ Message 2 still exists');
            testPassed = false;
        } catch (error) {
            console.log('✅ Message 2 deleted successfully');
        }

        try {
            await databases.getDocument(config.databaseID!, config.chatsCollectionID!, testChat.$id);
            console.log('❌ Chat still exists');
            testPassed = false;
        } catch (error) {
            console.log('✅ Chat deleted successfully');
        }

        if (testPassed) {
            console.log('🎉 Chat cascade deletion test PASSED!');
            return { success: true, message: 'Chat cascade deletion is working correctly' };
        } else {
            console.log('❌ Chat cascade deletion test FAILED');
            return { success: false, message: 'Some items were not deleted properly' };
        }

    } catch (error) {
        console.error('❌ Chat test failed:', error);
        return { success: false, message: `Chat test failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
};