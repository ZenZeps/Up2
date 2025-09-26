/**
 * Optimized Chat API for Group/Event Messaging
 * 
 * Key Optimizations:
 * - Efficient database queries with proper indexing
 * - Pagination for message loading
 * - Caching for frequently accessed data
 * - Batch operations for better performance
 */

import { config, databases, ID, Query } from '@/lib/appwrite/appwrite';
import { Chat } from '@/lib/types/Messages';

// Cache for chat lookups to reduce database calls
const chatCache = new Map<string, { chat: Chat; timestamp: number }>();
const CHAT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Use existing collection IDs
const CHATS_COLLECTION_ID = config.chatsCollectionID || 'temp_chats_id';
const MESSAGES_COLLECTION_ID = config.messagesCollectionID || 'temp_messages_id';

/**
 * ========================================
 * OPTIMIZED CHAT OPERATIONS
 * ========================================
 */

/**
 * Get or create chat for an entity (group or event)
 * Uses optimized entity lookup index
 */
export const getOrCreateChat = async (
    entityId: string,
    entityType: 'group' | 'event'
): Promise<Chat> => {
    try {
        const cacheKey = `${entityType}-${entityId}`;

        // Check cache first
        const cached = chatCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CHAT_CACHE_TTL) {
            return cached.chat;
        }

        console.log(`🔍 Looking up chat for ${entityType}: ${entityId}`);

        // Query using optimized composite index: [entityType, entityId]
        const response = await databases.listDocuments(
            config.databaseID!,
            CHATS_COLLECTION_ID,
            [
                Query.equal('entityType', entityType),
                Query.equal('entityId', entityId),
                Query.limit(1),
            ]
        );

        let chat: Chat;

        if (response.documents.length > 0) {
            chat = response.documents[0] as unknown as Chat;
            console.log(`✅ Found existing ${entityType} chat:`, chat.$id);
        } else {
            // Create new chat
            console.log(`📝 Creating new ${entityType} chat`);

            const chatData = {
                entityId,
                entityType,
                messageCount: 0,
                title: null, // Can be set later if needed
                lastMessageId: null,
                lastMessageAt: null,
                lastMessagePreview: null,
            };

            const { createDocumentSafe } = await import('@/lib/appwrite/safeDb');
            const newChat = await createDocumentSafe(
                config.databaseID!,
                CHATS_COLLECTION_ID,
                ID.unique(),
                chatData
            );

            chat = newChat as unknown as Chat;
            console.log(`✅ Created new ${entityType} chat:`, chat.$id);
        }

        // Cache the result
        chatCache.set(cacheKey, { chat, timestamp: Date.now() });

        return chat;
    } catch (error) {
        console.error(`❌ Error getting/creating ${entityType} chat:`, error);
        throw error;
    }
};

/**
 * Get chat by ID with caching
 */
export const getChatById = async (chatId: string): Promise<Chat> => {
    try {
        const cacheKey = `chat-${chatId}`;

        // Check cache first
        const cached = chatCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CHAT_CACHE_TTL) {
            return cached.chat;
        }

        const chat = await databases.getDocument(
            config.databaseID!,
            CHATS_COLLECTION_ID,
            chatId
        ) as unknown as Chat;

        // Cache the result
        chatCache.set(cacheKey, { chat, timestamp: Date.now() });

        return chat;
    } catch (error) {
        console.error('❌ Error getting chat by ID:', error);
        throw error;
    }
};

/**
 * Update chat metadata (last message info)
 * Called automatically when messages are created
 */
export const updateChatMetadata = async (
    chatId: string,
    lastMessageId: string,
    lastMessagePreview: string,
    incrementMessageCount: boolean = true
): Promise<void> => {
    try {
        const updateData: any = {
            lastMessageId,
            lastMessageAt: new Date().toISOString(),
            lastMessagePreview: lastMessagePreview.substring(0, 200), // Truncate preview
        };

        if (incrementMessageCount) {
            // Get current message count and increment
            const chat = await getChatById(chatId);
            updateData.messageCount = (chat.messageCount || 0) + 1;
        }

        await databases.updateDocument(
            config.databaseID!,
            CHATS_COLLECTION_ID,
            chatId,
            updateData
        );

        // Invalidate cache
        chatCache.delete(`chat-${chatId}`);

        console.log(`📊 Updated chat metadata for: ${chatId}`);
    } catch (error) {
        console.error('❌ Error updating chat metadata:', error);
        // Don't throw - this is non-critical
    }
};

/**
 * Get chats for multiple entities (batch operation)
 * Useful for displaying chat lists
 */
export const getBatchChats = async (
    entities: Array<{ id: string; type: 'group' | 'event' }>
): Promise<Chat[]> => {
    try {
        console.log(`🔍 Batch loading ${entities.length} chats`);

        // Check cache first
        const chats: Chat[] = [];
        const uncachedEntities: Array<{ id: string; type: 'group' | 'event' }> = [];

        for (const entity of entities) {
            const cacheKey = `${entity.type}-${entity.id}`;
            const cached = chatCache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < CHAT_CACHE_TTL) {
                chats.push(cached.chat);
            } else {
                uncachedEntities.push(entity);
            }
        }

        // Fetch uncached chats
        if (uncachedEntities.length > 0) {
            // Create queries for each entity type
            const groupIds = uncachedEntities.filter(e => e.type === 'group').map(e => e.id);
            const eventIds = uncachedEntities.filter(e => e.type === 'event').map(e => e.id);

            const queries: Promise<any>[] = [];

            if (groupIds.length > 0) {
                queries.push(
                    databases.listDocuments(
                        config.databaseID!,
                        CHATS_COLLECTION_ID,
                        [
                            Query.equal('entityType', 'group'),
                            Query.equal('entityId', groupIds),
                            Query.limit(groupIds.length),
                        ]
                    )
                );
            }

            if (eventIds.length > 0) {
                queries.push(
                    databases.listDocuments(
                        config.databaseID!,
                        CHATS_COLLECTION_ID,
                        [
                            Query.equal('entityType', 'event'),
                            Query.equal('entityId', eventIds),
                            Query.limit(eventIds.length),
                        ]
                    )
                );
            }

            const results = await Promise.all(queries);

            // Process results and cache them
            for (const result of results) {
                for (const doc of result.documents) {
                    const chat = doc as unknown as Chat;
                    chats.push(chat);

                    // Cache the result
                    const cacheKey = `${chat.entityType}-${chat.entityId}`;
                    chatCache.set(cacheKey, { chat, timestamp: Date.now() });
                }
            }
        }

        console.log(`✅ Loaded ${chats.length} chats (${chats.length - uncachedEntities.length} from cache)`);
        return chats;
    } catch (error) {
        console.error('❌ Error in batch chat loading:', error);
        throw error;
    }
};

/**
 * Get active chats ordered by last activity
 * For chat list UI
 */
export const getActiveChats = async (
    entityIds: string[],
    entityType?: 'group' | 'event',
    limit: number = 50
): Promise<Chat[]> => {
    try {
        const queries = [
            Query.orderDesc('lastMessageAt'),
            Query.limit(limit),
        ];

        if (entityType) {
            queries.push(Query.equal('entityType', entityType));
        }

        if (entityIds.length > 0) {
            queries.push(Query.equal('entityId', entityIds));
        }

        const response = await databases.listDocuments(
            config.databaseID!,
            CHATS_COLLECTION_ID,
            queries
        );

        const chats = response.documents as unknown as Chat[];

        // Cache the results
        for (const chat of chats) {
            const cacheKey = `${chat.entityType}-${chat.entityId}`;
            chatCache.set(cacheKey, { chat, timestamp: Date.now() });
        }

        console.log(`✅ Loaded ${chats.length} active chats`);
        return chats;
    } catch (error) {
        console.error('❌ Error getting active chats:', error);
        throw error;
    }
};

/**
 * Clear chat cache (call when user logs out or when needed)
 */
export const clearChatCache = (): void => {
    chatCache.clear();
    console.log('🧹 Chat cache cleared');
};

/**
 * ========================================
 * LEGACY COMPATIBILITY FUNCTIONS
 * ========================================
 * These maintain compatibility with your existing code
 */

export const getOrCreateEventChat = async (eventId: string): Promise<Chat> => {
    return getOrCreateChat(eventId, 'event');
};

export const getOrCreateGroupChat = async (groupId: string): Promise<Chat> => {
    return getOrCreateChat(groupId, 'group');
};

export const createEventChat = async (eventId: string): Promise<Chat> => {
    return getOrCreateChat(eventId, 'event');
};

export const createGroupChat = async (groupId: string): Promise<Chat> => {
    return getOrCreateChat(groupId, 'group');
};

/**
 * Delete a chat and all its messages
 * Note: Messages should be deleted via cascade rules in Appwrite
 */
export const deleteChat = async (chatId: string): Promise<void> => {
    try {
        await databases.deleteDocument(
            config.databaseID!,
            CHATS_COLLECTION_ID,
            chatId
        );

        // Clear from cache
        chatCache.delete(`chat-${chatId}`);

        console.log(`🗑️ Deleted chat: ${chatId}`);
    } catch (error) {
        console.error('❌ Error deleting chat:', error);
        throw error;
    }
};