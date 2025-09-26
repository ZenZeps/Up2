/**
 * Migration Script: Transition to Optimized Chat/Message APIs
 * 
 * This script helps you migrate your existing data and code to use the
 * optimized chat and message collections with proper indexing.
 * 
 * IMPORTANT: Run this after setting up the optimized collections in Appwrite
 * using the setup-optimized-chat-collections.ts script.
 */

import { config, databases, Query } from '@/lib/appwrite/appwrite';

/**
 * ========================================
 * DATA MIGRATION FUNCTIONS
 * ========================================
 */

/**
 * Migrate existing chats to the new schema
 * Adds entityId, entityType, and other metadata fields
 */
export const migrateExistingChats = async (): Promise<void> => {
    try {
        console.log('🔄 Starting chat migration...');

        // Get all existing chats
        let hasMore = true;
        let offset = 0;
        const limit = 100;
        let migratedCount = 0;

        while (hasMore) {
            const response = await databases.listDocuments(
                config.databaseID!,
                'temp_chats_id', // Your current collection ID
                [
                    Query.limit(limit),
                    Query.offset(offset),
                ]
            );

            for (const chat of response.documents) {
                try {
                    // Determine entity type and ID from existing data
                    let entityId: string;
                    let entityType: 'group' | 'event';

                    if (chat.eventId) {
                        entityId = chat.eventId;
                        entityType = 'event';
                    } else if (chat.groupId) {
                        entityId = chat.groupId;
                        entityType = 'group';
                    } else {
                        console.warn(`⚠️ Chat ${chat.$id} has no eventId or groupId, skipping`);
                        continue;
                    }

                    // Get message count for this chat
                    const messageCountResponse = await databases.listDocuments(
                        config.databaseID!,
                        'temp_messages_id', // Your current messages collection ID
                        [
                            Query.equal('chatId', chat.$id),
                            Query.limit(1),
                        ]
                    );

                    // Get last message info
                    const lastMessageResponse = await databases.listDocuments(
                        config.databaseID!,
                        'temp_messages_id',
                        [
                            Query.equal('chatId', chat.$id),
                            Query.orderDesc('$createdAt'),
                            Query.limit(1),
                        ]
                    );

                    const lastMessage = lastMessageResponse.documents[0];

                    // Create the optimized chat document
                    const optimizedChatData = {
                        entityId,
                        entityType,
                        messageCount: messageCountResponse.total || 0,
                        title: null,
                        lastMessageId: lastMessage?.$id || null,
                        lastMessageAt: lastMessage?.$createdAt || null,
                        lastMessagePreview: lastMessage?.content?.substring(0, 200) || null,
                        // Keep legacy fields for compatibility
                        eventId: chat.eventId || undefined,
                        groupId: chat.groupId || undefined,
                    };

                    // Create in new collection
                    await databases.createDocument(
                        config.databaseID!,
                        config.chatsCollectionID!, // New optimized collection
                        chat.$id, // Keep same ID
                        optimizedChatData
                    );

                    migratedCount++;
                    console.log(`✅ Migrated chat ${chat.$id} (${entityType}: ${entityId})`);
                } catch (error) {
                    console.error(`❌ Error migrating chat ${chat.$id}:`, error);
                }
            }

            hasMore = response.documents.length === limit;
            offset += limit;

            console.log(`📊 Progress: ${migratedCount} chats migrated`);
        }

        console.log(`✅ Chat migration completed: ${migratedCount} chats migrated`);
    } catch (error) {
        console.error('❌ Error in chat migration:', error);
        throw error;
    }
};

/**
 * Migrate existing messages to the new schema
 * Adds authorName and authorPhotoUrl for better performance
 */
export const migrateExistingMessages = async (): Promise<void> => {
    try {
        console.log('🔄 Starting message migration...');

        // Import user API
        const { getUserProfile } = await import('@/lib/api/user');

        let hasMore = true;
        let offset = 0;
        const limit = 100;
        let migratedCount = 0;

        while (hasMore) {
            const response = await databases.listDocuments(
                config.databaseID!,
                'temp_messages_id', // Your current collection ID
                [
                    Query.limit(limit),
                    Query.offset(offset),
                ]
            );

            // Process messages in batches
            const messageBatch = response.documents;
            const userIds = [...new Set(messageBatch.map(msg => msg.authorId))];

            // Batch fetch user data
            const userDataMap = new Map();
            await Promise.all(
                userIds.map(async (userId) => {
                    try {
                        const user = await getUserProfile(userId);
                        if (user) {
                            userDataMap.set(userId, {
                                name: user.name || `${user.firstName} ${user.lastName}`.trim() || 'Unknown User',
                                photoUrl: user.photoId || null,
                            });
                        } else {
                            userDataMap.set(userId, {
                                name: 'Unknown User',
                                photoUrl: null,
                            });
                        }
                    } catch (error) {
                        console.warn(`⚠️ Could not fetch user ${userId}:`, error);
                        userDataMap.set(userId, {
                            name: 'Unknown User',
                            photoUrl: null,
                        });
                    }
                })
            );

            // Migrate each message
            for (const message of messageBatch) {
                try {
                    const userData = userDataMap.get(message.authorId);

                    const optimizedMessageData = {
                        content: message.content,
                        authorId: message.authorId,
                        chatId: message.chatId,
                        authorName: userData?.name || 'Unknown User',
                        authorPhotoUrl: userData?.photoUrl || null,
                        isEdited: message.isEdited || false,
                        replyToId: message.replyToId || undefined,
                        attachments: message.attachments || undefined,
                    };

                    // Create in new collection
                    await databases.createDocument(
                        config.databaseID!,
                        config.messagesCollectionID!, // New optimized collection
                        message.$id, // Keep same ID
                        optimizedMessageData
                    );

                    migratedCount++;

                    if (migratedCount % 50 === 0) {
                        console.log(`📊 Progress: ${migratedCount} messages migrated`);
                    }
                } catch (error) {
                    console.error(`❌ Error migrating message ${message.$id}:`, error);
                }
            }

            hasMore = response.documents.length === limit;
            offset += limit;
        }

        console.log(`✅ Message migration completed: ${migratedCount} messages migrated`);
    } catch (error) {
        console.error('❌ Error in message migration:', error);
        throw error;
    }
};

/**
 * ========================================
 * CODE MIGRATION HELPERS
 * ========================================
 */

/**
 * Update your imports to use the optimized APIs
 * 
 * Replace your current imports:
 * 
 * OLD:
 * import { getOrCreateEventChat, getOrCreateGroupChat, createMessage, getChatMessages } from '@/lib/api/chats';
 * import { createMessage, getChatMessages } from '@/lib/api/messages';
 * 
 * NEW:
 * import { getOrCreateEventChat, getOrCreateGroupChat } from '@/lib/api/chats-optimized';
 * import { createMessage, getChatMessages } from '@/lib/api/messages-optimized';
 */

/**
 * Migration checklist for your code:
 * 
 * 1. Update imports to use -optimized files
 * 2. Update getChatMessages calls to handle new return format:
 *    OLD: const messages = await getChatMessages(chatId, 50, offset);
 *    NEW: const { messages, hasMore, nextCursor } = await getChatMessages(chatId, 50, cursor);
 * 
 * 3. Update Chat interface usage to use entityId/entityType:
 *    OLD: if (chat.eventId) { ... }
 *    NEW: if (chat.entityType === 'event') { const eventId = chat.entityId; ... }
 * 
 * 4. Add real-time subscriptions where needed:
 *    const unsubscribe = subscribeToMessages(chatId, (message) => {
 *        // Handle new message
 *    });
 */

/**
 * ========================================
 * VALIDATION FUNCTIONS
 * ========================================
 */

/**
 * Validate that migration was successful
 */
export const validateMigration = async (): Promise<{
    chats: { old: number; new: number; match: boolean };
    messages: { old: number; new: number; match: boolean };
}> => {
    try {
        console.log('🔍 Validating migration...');

        // Count old chats
        const oldChatResponse = await databases.listDocuments(
            config.databaseID!,
            'temp_chats_id',
            [Query.limit(1)]
        );

        // Count new chats
        const newChatResponse = await databases.listDocuments(
            config.databaseID!,
            config.chatsCollectionID!,
            [Query.limit(1)]
        );

        // Count old messages
        const oldMessageResponse = await databases.listDocuments(
            config.databaseID!,
            'temp_messages_id',
            [Query.limit(1)]
        );

        // Count new messages
        const newMessageResponse = await databases.listDocuments(
            config.databaseID!,
            config.messagesCollectionID!,
            [Query.limit(1)]
        );

        const result = {
            chats: {
                old: oldChatResponse.total || 0,
                new: newChatResponse.total || 0,
                match: (oldChatResponse.total || 0) === (newChatResponse.total || 0),
            },
            messages: {
                old: oldMessageResponse.total || 0,
                new: newMessageResponse.total || 0,
                match: (oldMessageResponse.total || 0) === (newMessageResponse.total || 0),
            },
        };

        console.log('📊 Migration validation results:');
        console.log(`  Chats: ${result.chats.old} → ${result.chats.new} (${result.chats.match ? '✅' : '❌'})`);
        console.log(`  Messages: ${result.messages.old} → ${result.messages.new} (${result.messages.match ? '✅' : '❌'})`);

        return result;
    } catch (error) {
        console.error('❌ Error validating migration:', error);
        throw error;
    }
};

/**
 * ========================================
 * CLEANUP FUNCTIONS
 * ========================================
 */

/**
 * Remove old collections after successful migration
 * WARNING: This is irreversible! Only run after thorough testing.
 */
export const cleanupOldCollections = async (): Promise<void> => {
    console.log('⚠️ This will permanently delete old collections!');
    console.log('⚠️ Make sure you have validated the migration first!');

    // Uncomment the following lines only when you're ready to cleanup:
    /*
    try {
        console.log('🗑️ Deleting old collections...');
        
        await databases.deleteCollection(config.databaseID!, 'temp_chats_id');
        await databases.deleteCollection(config.databaseID!, 'temp_messages_id');
        
        console.log('✅ Old collections deleted successfully');
    } catch (error) {
        console.error('❌ Error deleting old collections:', error);
        throw error;
    }
    */
};

/**
 * ========================================
 * MAIN MIGRATION RUNNER
 * ========================================
 */

export const runFullMigration = async (): Promise<void> => {
    try {
        console.log('🚀 Starting full migration process...');

        // Step 1: Migrate chats
        await migrateExistingChats();

        // Step 2: Migrate messages
        await migrateExistingMessages();

        // Step 3: Validate migration
        const validation = await validateMigration();

        if (validation.chats.match && validation.messages.match) {
            console.log('🎉 Migration completed successfully!');
            console.log('');
            console.log('Next steps:');
            console.log('1. Update your code to use the optimized APIs');
            console.log('2. Test thoroughly in development');
            console.log('3. Update your collection IDs in config to use the new collections');
            console.log('4. Remove old collections when ready using cleanupOldCollections()');
        } else {
            console.log('❌ Migration validation failed. Please check the data manually.');
        }
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
};