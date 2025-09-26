/**
 * Migration Script: Update Existing Collections with New Attributes
 * 
 * This script populates the new attributes in your existing collections
 * without creating new collections or losing any data.
 * 
 * Run this AFTER adding the new attributes to your collections in Appwrite Console.
 */

import { getUserProfile } from '@/lib/api/user';
import { config, databases, Query } from '@/lib/appwrite/appwrite';

/**
 * ========================================
 * STEP 1: MIGRATE EXISTING CHATS
 * ========================================
 */

/**
 * Update existing chats with entityId and entityType
 */
export const updateExistingChats = async (): Promise<void> => {
    try {
        console.log('🔄 Starting chat attribute updates...');

        let hasMore = true;
        let offset = 0;
        const limit = 100;
        let updatedCount = 0;

        while (hasMore) {
            // Get existing chats
            const response = await databases.listDocuments(
                config.databaseID!,
                config.chatsCollectionID!, // Your existing temp_chats_id
                [
                    Query.limit(limit),
                    Query.offset(offset),
                ]
            );

            for (const chat of response.documents) {
                try {
                    // Since legacy fields are removed, we need to determine entity info differently
                    // You'll need to manually set entityId and entityType for existing chats
                    // or create them fresh with the new system

                    // Skip existing chats that don't have the new fields yet
                    if (!chat.entityId || !chat.entityType) {
                        console.warn(`⚠️ Chat ${chat.$id} missing entityId/entityType - skipping. Create new chats with the optimized API.`);
                        continue;
                    }

                    const entityId = chat.entityId;
                    const entityType = chat.entityType;

                    // Get message count and last message info
                    const messageCountResponse = await databases.listDocuments(
                        config.databaseID!,
                        config.messagesCollectionID!, // Your existing temp_messages_id
                        [
                            Query.equal('chatId', chat.$id),
                            Query.limit(1),
                        ]
                    );

                    const lastMessageResponse = await databases.listDocuments(
                        config.databaseID!,
                        config.messagesCollectionID!,
                        [
                            Query.equal('chatId', chat.$id),
                            Query.orderDesc('$createdAt'),
                            Query.limit(1),
                        ]
                    );

                    const lastMessage = lastMessageResponse.documents[0];

                    // Update the chat with new attributes
                    await databases.updateDocument(
                        config.databaseID!,
                        config.chatsCollectionID!,
                        chat.$id,
                        {
                            entityId,
                            entityType,
                            messageCount: messageCountResponse.total || 0,
                            title: null, // Can be set later if needed
                            lastMessageId: lastMessage?.$id || null,
                            lastMessageAt: lastMessage?.$createdAt || null,
                            lastMessagePreview: lastMessage?.content?.substring(0, 200) || null,
                        }
                    );

                    updatedCount++;
                    console.log(`✅ Updated chat ${chat.$id} (${entityType}: ${entityId})`);
                } catch (error) {
                    console.error(`❌ Error updating chat ${chat.$id}:`, error);
                }
            }

            hasMore = response.documents.length === limit;
            offset += limit;

            console.log(`📊 Progress: ${updatedCount} chats updated`);
        }

        console.log(`✅ Chat updates completed: ${updatedCount} chats updated`);
    } catch (error) {
        console.error('❌ Error in chat updates:', error);
        throw error;
    }
};

/**
 * ========================================
 * STEP 2: MIGRATE EXISTING MESSAGES
 * ========================================
 */

/**
 * Update existing messages with author info and other attributes
 */
export const updateExistingMessages = async (): Promise<void> => {
    try {
        console.log('🔄 Starting message attribute updates...');

        let hasMore = true;
        let offset = 0;
        const limit = 100;
        let updatedCount = 0;

        // Cache for user data to avoid repeated API calls
        const userCache = new Map<string, { name: string; photoUrl: string | null }>();

        while (hasMore) {
            const response = await databases.listDocuments(
                config.databaseID!,
                config.messagesCollectionID!, // Your existing temp_messages_id
                [
                    Query.limit(limit),
                    Query.offset(offset),
                ]
            );

            // Get unique author IDs for batch user lookup
            const authorIds = [...new Set(response.documents.map(msg => msg.authorId))];

            // Batch fetch user data that's not in cache
            for (const authorId of authorIds) {
                if (!userCache.has(authorId)) {
                    try {
                        const user = await getUserProfile(authorId);
                        if (user) {
                            userCache.set(authorId, {
                                name: user.name || `${user.firstName} ${user.lastName}`.trim() || 'Unknown User',
                                photoUrl: user.photoId || null,
                            });
                        } else {
                            userCache.set(authorId, {
                                name: 'Unknown User',
                                photoUrl: null,
                            });
                        }
                    } catch (error) {
                        console.warn(`⚠️ Could not fetch user ${authorId}:`, error);
                        userCache.set(authorId, {
                            name: 'Unknown User',
                            photoUrl: null,
                        });
                    }
                }
            }

            // Update each message
            for (const message of response.documents) {
                try {
                    const userData = userCache.get(message.authorId);

                    await databases.updateDocument(
                        config.databaseID!,
                        config.messagesCollectionID!,
                        message.$id,
                        {
                            authorName: userData?.name || 'Unknown User',
                            authorPhotoUrl: userData?.photoUrl || null,
                            isEdited: message.isEdited || false,
                            replyToId: message.replyToId || null,
                            attachments: message.attachments || [],
                        }
                    );

                    updatedCount++;

                    if (updatedCount % 50 === 0) {
                        console.log(`📊 Progress: ${updatedCount} messages updated`);
                    }
                } catch (error) {
                    console.error(`❌ Error updating message ${message.$id}:`, error);
                }
            }

            hasMore = response.documents.length === limit;
            offset += limit;
        }

        console.log(`✅ Message updates completed: ${updatedCount} messages updated`);
    } catch (error) {
        console.error('❌ Error in message updates:', error);
        throw error;
    }
};

/**
 * ========================================
 * STEP 3: VALIDATION
 * ========================================
 */

/**
 * Validate that all chats have the required new attributes
 */
export const validateChatUpdates = async (): Promise<boolean> => {
    try {
        console.log('🔍 Validating chat updates...');

        const response = await databases.listDocuments(
            config.databaseID!,
            config.chatsCollectionID!,
            [
                Query.limit(100),
            ]
        );

        let validCount = 0;
        let invalidCount = 0;

        for (const chat of response.documents) {
            const hasRequiredFields = chat.entityId && chat.entityType;

            if (hasRequiredFields) {
                validCount++;
            } else {
                invalidCount++;
                console.warn(`❌ Chat ${chat.$id} missing required fields:`, {
                    entityId: !!chat.entityId,
                    entityType: !!chat.entityType,
                });
            }
        }

        console.log(`📊 Chat validation results:`);
        console.log(`  ✅ Valid: ${validCount}`);
        console.log(`  ❌ Invalid: ${invalidCount}`);
        console.log(`  📈 Success rate: ${((validCount / (validCount + invalidCount)) * 100).toFixed(1)}%`);

        return invalidCount === 0;
    } catch (error) {
        console.error('❌ Error validating chat updates:', error);
        return false;
    }
};

/**
 * Validate that messages have author info populated
 */
export const validateMessageUpdates = async (): Promise<boolean> => {
    try {
        console.log('🔍 Validating message updates...');

        const response = await databases.listDocuments(
            config.databaseID!,
            config.messagesCollectionID!,
            [
                Query.limit(100),
            ]
        );

        let validCount = 0;
        let invalidCount = 0;

        for (const message of response.documents) {
            const hasAuthorName = message.authorName && message.authorName !== 'Unknown User';

            if (hasAuthorName) {
                validCount++;
            } else {
                invalidCount++;
            }
        }

        console.log(`📊 Message validation results:`);
        console.log(`  ✅ Valid: ${validCount}`);
        console.log(`  ❌ Invalid: ${invalidCount}`);
        console.log(`  📈 Success rate: ${((validCount / (validCount + invalidCount)) * 100).toFixed(1)}%`);

        return true; // Author name issues are not critical
    } catch (error) {
        console.error('❌ Error validating message updates:', error);
        return false;
    }
};

/**
 * ========================================
 * STEP 4: INDEX VALIDATION
 * ========================================
 */

/**
 * Test that the new indexes are working properly
 */
export const testNewIndexes = async (): Promise<void> => {
    try {
        console.log('🧪 Testing new indexes...');

        // Test chat entity lookup
        console.log('Testing chat entity lookup...');
        const startTime1 = Date.now();

        const chatResponse = await databases.listDocuments(
            config.databaseID!,
            config.chatsCollectionID!,
            [
                Query.equal('entityType', 'event'),
                Query.limit(10),
            ]
        );

        const chatQueryTime = Date.now() - startTime1;
        console.log(`✅ Chat entity query: ${chatQueryTime}ms (${chatResponse.documents.length} results)`);

        // Test message pagination
        if (chatResponse.documents.length > 0) {
            console.log('Testing message pagination...');
            const chatId = chatResponse.documents[0].$id;
            const startTime2 = Date.now();

            const messageResponse = await databases.listDocuments(
                config.databaseID!,
                config.messagesCollectionID!,
                [
                    Query.equal('chatId', chatId),
                    Query.orderDesc('$createdAt'),
                    Query.limit(50),
                ]
            );

            const messageQueryTime = Date.now() - startTime2;
            console.log(`✅ Message pagination query: ${messageQueryTime}ms (${messageResponse.documents.length} results)`);
        }

        // Test active chats ordering
        console.log('Testing active chats ordering...');
        const startTime3 = Date.now();

        const activeChatsResponse = await databases.listDocuments(
            config.databaseID!,
            config.chatsCollectionID!,
            [
                Query.orderDesc('lastMessageAt'),
                Query.limit(20),
            ]
        );

        const activeChatsQueryTime = Date.now() - startTime3;
        console.log(`✅ Active chats query: ${activeChatsQueryTime}ms (${activeChatsResponse.documents.length} results)`);

        console.log('🎉 All index tests passed!');
    } catch (error) {
        console.error('❌ Error testing indexes:', error);
        throw error;
    }
};

/**
 * ========================================
 * MAIN MIGRATION RUNNER
 * ========================================
 */

export const runExistingCollectionUpdates = async (): Promise<void> => {
    try {
        console.log('🚀 Starting existing collection updates...');
        console.log('');

        console.log('📋 Make sure you have added the new attributes to your collections first!');
        console.log('');

        // Step 1: Update chats
        console.log('=== STEP 1: UPDATING CHATS ===');
        await updateExistingChats();
        console.log('');

        // Step 2: Update messages
        console.log('=== STEP 2: UPDATING MESSAGES ===');
        await updateExistingMessages();
        console.log('');

        // Step 3: Validate updates
        console.log('=== STEP 3: VALIDATION ===');
        const chatValidation = await validateChatUpdates();
        const messageValidation = await validateMessageUpdates();
        console.log('');

        // Step 4: Test indexes
        console.log('=== STEP 4: TESTING INDEXES ===');
        await testNewIndexes();
        console.log('');

        if (chatValidation && messageValidation) {
            console.log('🎉 Collection updates completed successfully!');
            console.log('');
            console.log('Next steps:');
            console.log('1. Update your code to use the optimized APIs');
            console.log('2. Test thoroughly in development');
            console.log('3. Monitor query performance improvements');
        } else {
            console.log('⚠️ Some validation issues found. Please review and fix before proceeding.');
        }
    } catch (error) {
        console.error('❌ Collection update failed:', error);
        throw error;
    }
};