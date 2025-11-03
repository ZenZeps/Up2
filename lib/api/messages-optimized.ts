/**
 * Optimized Messages API for Group/Event Messaging
 * 
 * Key Optimizations:
 * - Efficient pagination with cursor-based loading
 * - Author data caching to reduce user lookups
 * - Batch message operations
 * - Real-time message streaming support
 * - Optimized database queries using proper indexes
 */

import { config, databases, ID, Query } from '@/lib/appwrite/appwrite';
import { Message, MessageWithAuthor } from '@/lib/types/Messages';
import { updateChatMetadata } from './chats-optimized';
import { getUserProfile } from './user';

// Use existing collection IDs
const CHATS_COLLECTION_ID = config.chatsCollectionID || 'temp_chats_id';
const MESSAGES_COLLECTION_ID = config.messagesCollectionID || 'temp_messages_id';

// Author cache to reduce user API calls
interface AuthorCache {
    id: string;
    name: string;
    photoUrl: string | null;
    timestamp: number;
}

const authorCache = new Map<string, AuthorCache>();
const AUTHOR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * ========================================
 * MESSAGE CREATION
 * ========================================
 */

/**
 * Create a new message with optimized author lookup and chat metadata update
 */
export const createMessage = async (
    chatId: string,
    content: string,
    authorId: string
): Promise<MessageWithAuthor> => {
    try {
        console.log(`📝 Creating message in chat: ${chatId}`);

        // Get author data (with caching)
        const author = await getCachedAuthor(authorId);

        // Create message data with string fields only (no relationships)
        const messageData = {
            content: content.trim(),
            // New relationship fields
            // sender: authorId, // REMOVED: Not in database schema - causes "Unknown attribute" error
            // chat: chatId, // REMOVED: Not in database schema - causes "Unknown attribute" error
            // Keep string fields for compatibility during transition
            authorId,
            chatId,
            // senderId: authorId, // REMOVED: Not in database schema - causes "Unknown attribute" error
            authorName: author.name,
            authorPhotoUrl: author.photoUrl,
            isEdited: false,
        };

        const { createDocumentSafe } = await import('@/lib/appwrite/safeDb');
        const message = await createDocumentSafe(
            config.databaseID!,
            MESSAGES_COLLECTION_ID,
            ID.unique(),
            messageData
        ) as unknown as Message;

        // Update chat metadata asynchronously (don't wait for it)
        updateChatMetadata(
            chatId,
            message.$id,
            content.substring(0, 200),
            true
        ).catch(error => {
            console.error('⚠️ Failed to update chat metadata:', error);
        });

        const messageWithAuthor: MessageWithAuthor = {
            ...message,
            authorName: author.name,
            authorPhotoUrl: author.photoUrl,
        };

        console.log(`✅ Created message: ${message.$id}`);
        return messageWithAuthor;
    } catch (error) {
        console.error('❌ Error creating message:', error);
        throw error;
    }
};

/**
 * ========================================
 * MESSAGE RETRIEVAL
 * ========================================
 */

/**
 * Get messages for a chat with optimized pagination
 * Uses cursor-based pagination for better performance
 */
export const getChatMessages = async (
    chatId: string,
    limit: number = 50,
    cursor?: string // Message ID to start from (for pagination)
): Promise<{
    messages: MessageWithAuthor[];
    hasMore: boolean;
    nextCursor?: string;
}> => {
    try {
        console.log(`🔍 Loading messages for chat: ${chatId}, limit: ${limit}`);

        const queries = [
            Query.equal('chatId', chatId),
            Query.orderDesc('$createdAt'), // Use index: [chatId, $createdAt]
            Query.limit(limit + 1), // Get one extra to check if there are more
        ];

        // Add cursor for pagination
        if (cursor) {
            queries.push(Query.cursorAfter(cursor));
        }

        const response = await databases.listDocuments(
            config.databaseID!,
            MESSAGES_COLLECTION_ID,
            queries
        );

        const documents = response.documents as unknown as Message[];

        // Check if there are more messages
        const hasMore = documents.length > limit;
        const messages = hasMore ? documents.slice(0, limit) : documents;
        const nextCursor = hasMore ? messages[messages.length - 1].$id : undefined;

        // Enrich messages with author data
        const enrichedMessages = await enrichMessagesWithAuthors(messages);

        console.log(`✅ Loaded ${enrichedMessages.length} messages (hasMore: ${hasMore})`);

        return {
            messages: enrichedMessages,
            hasMore,
            nextCursor,
        };
    } catch (error) {
        console.error('❌ Error getting chat messages:', error);
        throw error;
    }
};

/**
 * Get recent messages across multiple chats
 * Useful for notification previews or activity feeds
 */
export const getRecentMessages = async (
    chatIds: string[],
    limit: number = 20
): Promise<MessageWithAuthor[]> => {
    try {
        if (chatIds.length === 0) return [];

        console.log(`🔍 Loading recent messages from ${chatIds.length} chats`);

        const response = await databases.listDocuments(
            config.databaseID!,
            MESSAGES_COLLECTION_ID,
            [
                Query.equal('chatId', chatIds),
                Query.orderDesc('$createdAt'),
                Query.limit(limit),
            ]
        );

        const messages = response.documents as unknown as Message[];
        const enrichedMessages = await enrichMessagesWithAuthors(messages);

        console.log(`✅ Loaded ${enrichedMessages.length} recent messages`);
        return enrichedMessages;
    } catch (error) {
        console.error('❌ Error getting recent messages:', error);
        throw error;
    }
};

/**
 * Search messages within a chat
 * Uses full-text search if available
 */
export const searchMessagesInChat = async (
    chatId: string,
    searchQuery: string,
    limit: number = 20
): Promise<MessageWithAuthor[]> => {
    try {
        console.log(`🔍 Searching messages in chat: ${chatId}, query: "${searchQuery}"`);

        const response = await databases.listDocuments(
            config.databaseID!,
            MESSAGES_COLLECTION_ID,
            [
                Query.equal('chatId', chatId),
                Query.search('content', searchQuery),
                Query.orderDesc('$createdAt'),
                Query.limit(limit),
            ]
        );

        const messages = response.documents as unknown as Message[];
        const enrichedMessages = await enrichMessagesWithAuthors(messages);

        console.log(`✅ Found ${enrichedMessages.length} messages matching "${searchQuery}"`);
        return enrichedMessages;
    } catch (error) {
        console.error('❌ Error searching messages:', error);
        throw error;
    }
};

/**
 * ========================================
 * MESSAGE OPERATIONS
 * ========================================
 */

/**
 * Update message content (for editing)
 */
export const updateMessage = async (
    messageId: string,
    newContent: string
): Promise<Message> => {
    try {
        console.log(`✏️ Updating message: ${messageId}`);

        const updatedMessage = await databases.updateDocument(
            config.databaseID!,
            MESSAGES_COLLECTION_ID,
            messageId,
            {
                content: newContent.trim(),
                isEdited: true,
            }
        );

        console.log(`✅ Updated message: ${messageId}`);
        return updatedMessage as unknown as Message;
    } catch (error) {
        console.error('❌ Error updating message:', error);
        throw error;
    }
};

/**
 * Delete a message
 */
export const deleteMessage = async (messageId: string): Promise<void> => {
    try {
        console.log(`🗑️ Deleting message: ${messageId}`);

        await databases.deleteDocument(
            config.databaseID!,
            MESSAGES_COLLECTION_ID,
            messageId
        );

        console.log(`✅ Deleted message: ${messageId}`);
    } catch (error) {
        console.error('❌ Error deleting message:', error);
        throw error;
    }
};

/**
 * Get message by ID with author data
 */
export const getMessageById = async (messageId: string): Promise<MessageWithAuthor> => {
    try {
        const message = await databases.getDocument(
            config.databaseID!,
            MESSAGES_COLLECTION_ID,
            messageId
        ) as unknown as Message;

        const enrichedMessages = await enrichMessagesWithAuthors([message]);
        return enrichedMessages[0];
    } catch (error) {
        console.error('❌ Error getting message by ID:', error);
        throw error;
    }
};

/**
 * ========================================
 * AUTHOR DATA MANAGEMENT
 * ========================================
 */

/**
 * Get cached author data or fetch from API
 */
const getCachedAuthor = async (authorId: string): Promise<AuthorCache> => {
    const cached = authorCache.get(authorId);

    if (cached && Date.now() - cached.timestamp < AUTHOR_CACHE_TTL) {
        return cached;
    }

    try {
        // Fetch user data
        const user = await getUserProfile(authorId);

        const authorData: AuthorCache = {
            id: authorId,
            name: user?.name || (user ? `${user.firstName} ${user.lastName}`.trim() : '') || 'Unknown User',
            photoUrl: user?.photoId || null,
            timestamp: Date.now(),
        };

        // Cache the result
        authorCache.set(authorId, authorData);
        return authorData;
    } catch (error) {
        console.error(`⚠️ Error fetching author data for ${authorId}:`, error);

        // Return fallback data
        const fallbackData: AuthorCache = {
            id: authorId,
            name: 'Unknown User',
            photoUrl: null,
            timestamp: Date.now(),
        };

        authorCache.set(authorId, fallbackData);
        return fallbackData;
    }
};

/**
 * Enrich messages with author data (batch operation)
 */
const enrichMessagesWithAuthors = async (messages: Message[]): Promise<MessageWithAuthor[]> => {
    if (messages.length === 0) return [];

    // Get unique author IDs
    const authorIds = [...new Set(messages.map(m => m.authorId))];

    // Batch fetch author data
    const authorPromises = authorIds.map(id => getCachedAuthor(id).catch(error => {
        console.error(`⚠️ Failed to get author ${id}:`, error);
        return {
            id,
            name: 'Unknown User',
            photoUrl: null,
            timestamp: Date.now(),
        };
    }));

    const authors = await Promise.all(authorPromises);
    const authorMap = new Map(authors.map(a => [a.id, a]));

    // Enrich messages
    return messages.map(message => {
        const author = authorMap.get(message.authorId);
        return {
            ...message,
            authorName: author?.name || message.authorName || 'Unknown User',
            authorPhotoUrl: author?.photoUrl || message.authorPhotoUrl,
        } as MessageWithAuthor;
    });
};

/**
 * Clear author cache (call when user logs out)
 */
export const clearAuthorCache = (): void => {
    authorCache.clear();
    console.log('🧹 Author cache cleared');
};

/**
 * ========================================
 * REAL-TIME SUPPORT
 * ========================================
 */

/**
 * Subscribe to new messages in a chat
 * Returns unsubscribe function
 * 
 * Note: For React Native Appwrite, real-time subscriptions work differently.
 * This is a placeholder implementation. For production, you may want to use
 * polling or server-sent events depending on your setup.
 */
export const subscribeToMessages = (
    chatId: string,
    onMessage: (message: MessageWithAuthor) => void,
    onError?: (error: any) => void
): (() => void) => {
    console.log(`🔔 Setting up message subscription for chat: ${chatId}`);

    // For React Native, you might implement polling or use a different approach
    // This is a placeholder that demonstrates the interface

    let isActive = true;

    // Example polling implementation (replace with real-time when available)
    const pollForMessages = async () => {
        try {
            if (!isActive) return;

            // Get the latest message to check for new ones
            const { messages } = await getChatMessages(chatId, 1);

            if (messages.length > 0) {
                // You would need to implement logic to detect "new" messages
                // This is just a demonstration
            }

            // Poll every 5 seconds (adjust as needed)
            setTimeout(pollForMessages, 5000);
        } catch (error) {
            if (onError && isActive) onError(error);
        }
    };

    // Start polling (comment this out if you have real-time)
    // pollForMessages();

    // Return cleanup function
    return () => {
        isActive = false;
        console.log(`🔕 Unsubscribed from chat: ${chatId}`);
    };
};

/**
 * ========================================
 * UTILITY FUNCTIONS
 * ========================================
 */

/**
 * Get message count for a chat
 * Uses the messageCount field from chat metadata for efficiency
 */
export const getMessageCount = async (chatId: string): Promise<number> => {
    try {
        const { getChatById } = await import('./chats-optimized');
        const chat = await getChatById(chatId);
        return chat.messageCount || 0;
    } catch (error) {
        console.error('❌ Error getting message count:', error);
        // Fallback to direct count (less efficient)
        try {
            const response = await databases.listDocuments(
                config.databaseID!,
                MESSAGES_COLLECTION_ID,
                [
                    Query.equal('chatId', chatId),
                    Query.limit(1),
                ]
            );
            return response.total || 0;
        } catch (fallbackError) {
            console.error('❌ Fallback message count failed:', fallbackError);
            return 0;
        }
    }
};

/**
 * Mark messages as read (for future read receipt feature)
 * This is a placeholder for future implementation
 */
export const markMessagesAsRead = async (
    chatId: string,
    userId: string
): Promise<void> => {
    // TODO: Implement read receipts
    console.log(`📖 Marking messages as read for user ${userId} in chat ${chatId}`);
};

/**
 * ========================================
 * CONVENIENCE FUNCTIONS FOR EVENTS/GROUPS
 * ========================================
 */

/**
 * Get messages for a specific event (optimized version)
 */
export const getEventMessages = async (
    eventId: string,
    limit: number = 50,
    cursor?: string
): Promise<{
    messages: MessageWithAuthor[];
    hasMore: boolean;
    nextCursor?: string;
}> => {
    try {
        const { getOrCreateChat } = await import('./chats-optimized');
        const chat = await getOrCreateChat(eventId, 'event');
        return await getChatMessages(chat.$id, limit, cursor);
    } catch (error) {
        console.error('❌ Error fetching event messages:', error);
        throw error;
    }
};

/**
 * Get messages for a specific group (optimized version)
 */
export const getGroupMessages = async (
    groupId: string,
    limit: number = 50,
    cursor?: string
): Promise<{
    messages: MessageWithAuthor[];
    hasMore: boolean;
    nextCursor?: string;
}> => {
    try {
        const { getOrCreateChat } = await import('./chats-optimized');
        const chat = await getOrCreateChat(groupId, 'group');
        return await getChatMessages(chat.$id, limit, cursor);
    } catch (error) {
        console.error('❌ Error fetching group messages:', error);
        throw error;
    }
};

/**
 * Create a message for an event (optimized version)
 */
export const createEventMessage = async (
    eventId: string,
    content: string,
    authorId: string
): Promise<MessageWithAuthor> => {
    try {
        const { getOrCreateChat } = await import('./chats-optimized');
        const chat = await getOrCreateChat(eventId, 'event');
        return await createMessage(chat.$id, content, authorId);
    } catch (error) {
        console.error('❌ Error creating event message:', error);
        throw error;
    }
};

/**
 * Create a message for a group (optimized version)
 */
export const createGroupMessage = async (
    groupId: string,
    content: string,
    authorId: string
): Promise<MessageWithAuthor> => {
    try {
        const { getOrCreateChat } = await import('./chats-optimized');
        const chat = await getOrCreateChat(groupId, 'group');
        return await createMessage(chat.$id, content, authorId);
    } catch (error) {
        console.error('❌ Error creating group message:', error);
        throw error;
    }
};