import { config, databases, ID, Query } from '@/lib/appwrite/appwrite';
import { Chat, Message, MessageInput, MessageThread, MessageWithAuthor } from '@/lib/types/Messages';
import { sendChatMessageNotification } from '../notifications/notificationUtils';
import { getOrCreateEventChat, getOrCreateGroupChat } from './chats';
import { getUserProfilePhotoUrl } from './profilePhoto';
import { getUserProfile } from './user';

/**
 * Create a new message in a chat
 */
export const createMessage = async (messageInput: MessageInput, authorId: string): Promise<Message> => {
    try {
        if (!messageInput.content.trim()) {
            throw new Error('Message content cannot be empty');
        }

        const messageData = {
            content: messageInput.content.trim(),
            authorId,
            chatId: messageInput.chatId,
            replyToId: messageInput.replyToId || null,
            isEdited: false,
        };

        const { createDocumentSafe } = await import('@/lib/appwrite/safeDb');
        const response = await createDocumentSafe(
            config.databaseID!,
            config.messagesCollectionID!,
            ID.unique(),
            messageData
        );

        const message = response as unknown as Message;

        // Send notifications to other chat participants
        try {
            // Get chat details to find participants
            const chat = await databases.getDocument(
                config.databaseID!,
                config.chatsCollectionID!,
                messageInput.chatId
            ) as unknown as Chat;

            // Get sender's profile for notification
            const senderProfile = await getUserProfile(authorId);
            const senderName = senderProfile
                ? `${senderProfile.firstName} ${senderProfile.lastName}`.trim()
                : 'Someone';

            // Get participants based on chat type with SCALABILITY LIMITS
            let participantIds: string[] = [];

            if (chat.eventId) {
                // For event chats, prefer junction-attendees lookup with LIMIT to prevent crashes
                try {
                    const { getEventAttendees } = await import('./event');
                    const attendees = await getEventAttendees(chat.eventId);
                    participantIds = Array.isArray(attendees) ? attendees.slice(0, 100) : [];
                } catch (e) {
                    // Fallback: read legacy attendees if present on the event document (very rare)
                    try {
                        const event = await databases.getDocument(
                            config.databaseID!,
                            config.eventsCollectionID!,
                            chat.eventId
                        );
                        participantIds = (event.attendees || []).slice(0, 100);
                    } catch (innerErr) {
                        // If even that fails, leave participantIds empty to avoid crashing
                        participantIds = [];
                    }
                }
            } else if (chat.groupId) {
                // For group chats, get group members with LIMIT
                const group = await databases.getDocument(
                    config.databaseID!,
                    config.groupsCollectionID!,
                    chat.groupId
                );
                // SCALABILITY FIX: Limit notifications to first 50 group members
                participantIds = (group.members || []).slice(0, 50);
            }

            // Send notification to other participants (excluding sender)
            const otherParticipants = participantIds.filter(id => id !== authorId);
            if (otherParticipants.length > 0 && otherParticipants.length <= 100) { // Safety check
                await sendChatMessageNotification(
                    otherParticipants,
                    senderName,
                    messageInput.content.trim(),
                    messageInput.chatId,
                    authorId
                );
                console.log(`Sent chat notifications to ${otherParticipants.length} participants`);
            } else if (otherParticipants.length > 100) {
                console.warn(`Skipping notifications for chat with ${otherParticipants.length} participants (too many)`);
            }
        } catch (notificationError) {
            // Don't fail message creation if notifications fail
            console.warn('Failed to send chat message notification:', notificationError);
        }

        return message;
    } catch (error) {
        console.error('Error creating message:', error);
        throw error;
    }
};

// Author data cache for message enrichment - CRITICAL for scalability
const authorDataCache = new Map<string, {
    name: string;
    photoUrl: string | null;
    timestamp: number;
}>();
const AUTHOR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

/**
 * Get messages for a specific chat with SCALABILITY OPTIMIZATIONS
 */
export const getChatMessages = async (chatId: string, limit: number = 50, offset: number = 0): Promise<MessageThread> => {
    try {
        // Get chat details first
        const chat = await databases.getDocument(
            config.databaseID!,
            config.chatsCollectionID!,
            chatId
        ) as unknown as Chat;

        // Get messages for this chat with pagination
        const response = await databases.listDocuments(
            config.databaseID!,
            config.messagesCollectionID!,
            [
                Query.equal('chatId', chatId),
                Query.orderDesc('$createdAt'),
                Query.limit(limit),
                Query.offset(offset), // SCALABILITY: Add pagination support
            ]
        );

        const messages = response.documents as unknown as Message[];
        const messagesWithAuthor = await enrichMessagesWithAuthorInfoOptimized(messages);

        return {
            chat,
            messages: messagesWithAuthor.reverse(), // Show oldest first for chat-like experience
            totalCount: response.total,
            hasMore: response.total > offset + limit, // Indicate if more messages available
        };
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        throw error;
    }
};

/**
 * Get messages for a specific event (convenience method) with pagination
 */
export const getEventMessages = async (eventId: string, limit: number = 50, offset: number = 0): Promise<MessageThread> => {
    try {
        const chat = await getOrCreateEventChat(eventId);
        return await getChatMessages(chat.$id, limit, offset);
    } catch (error) {
        console.error('Error fetching event messages:', error);
        throw error;
    }
};

/**
 * Get messages for a specific group (convenience method) with pagination
 */
export const getGroupMessages = async (groupId: string, limit: number = 50, offset: number = 0): Promise<MessageThread> => {
    try {
        const chat = await getOrCreateGroupChat(groupId);
        return await getChatMessages(chat.$id, limit, offset);
    } catch (error) {
        console.error('Error fetching group messages:', error);
        throw error;
    }
};

/**
 * Create a message for an event (convenience method)
 */
export const createEventMessage = async (eventId: string, content: string, authorId: string): Promise<Message> => {
    try {
        const chat = await getOrCreateEventChat(eventId);
        const messageInput: MessageInput = {
            content,
            chatId: chat.$id,
        };
        return await createMessage(messageInput, authorId);
    } catch (error) {
        console.error('Error creating event message:', error);
        throw error;
    }
};

/**
 * Create a message for a group (convenience method)
 */
export const createGroupMessage = async (groupId: string, content: string, authorId: string): Promise<Message> => {
    try {
        const chat = await getOrCreateGroupChat(groupId);
        const messageInput: MessageInput = {
            content,
            chatId: chat.$id,
        };
        return await createMessage(messageInput, authorId);
    } catch (error) {
        console.error('Error creating group message:', error);
        throw error;
    }
};

/**
 * Update a message (for editing)
 */
export const updateMessage = async (messageId: string, content: string, authorId: string): Promise<Message> => {
    try {
        // First verify the message belongs to the author
        const message = await databases.getDocument(
            config.databaseID!,
            config.messagesCollectionID!,
            messageId
        ) as unknown as Message;

        if (message.authorId !== authorId) {
            throw new Error('You can only edit your own messages');
        }

        const response = await databases.updateDocument(
            config.databaseID!,
            config.messagesCollectionID!,
            messageId,
            {
                content: content.trim(),
                isEdited: true,
            }
        );

        return response as unknown as Message;
    } catch (error) {
        console.error('Error updating message:', error);
        throw error;
    }
};

/**
 * Delete a message
 */
export const deleteMessage = async (messageId: string, authorId: string): Promise<void> => {
    try {
        // First verify the message belongs to the author
        const message = await databases.getDocument(
            config.databaseID!,
            config.messagesCollectionID!,
            messageId
        ) as unknown as Message;

        if (message.authorId !== authorId) {
            throw new Error('You can only delete your own messages');
        }

        await databases.deleteDocument(
            config.databaseID!,
            config.messagesCollectionID!,
            messageId
        );
    } catch (error) {
        console.error('Error deleting message:', error);
        throw error;
    }
};

/**
 * Get recent message count for a chat
 */
export const getMessageCount = async (chatId: string): Promise<number> => {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.messagesCollectionID!,
            [Query.equal('chatId', chatId), Query.limit(1)] // Just get count, not actual documents
        );

        return response.total;
    } catch (error) {
        console.error('Error getting message count:', error);
        return 0;
    }
};

/**
 * SCALABILITY OPTIMIZED: Enrich messages with author information using caching and batching
 * CRITICAL FIX: Reduces API calls from 100+ to 1-5 for typical chat loads
 */
const enrichMessagesWithAuthorInfoOptimized = async (messages: Message[]): Promise<MessageWithAuthor[]> => {
    if (!messages.length) return [];

    try {
        // Get unique author IDs
        const uniqueAuthorIds = [...new Set(messages.map(msg => msg.authorId))];
        const now = Date.now();

        // Check cache first - MAJOR performance improvement
        const cachedData = new Map<string, { name: string; photoUrl: string | null }>();
        const uncachedAuthorIds: string[] = [];

        uniqueAuthorIds.forEach(authorId => {
            const cached = authorDataCache.get(authorId);
            if (cached && (now - cached.timestamp) < AUTHOR_CACHE_TTL) {
                cachedData.set(authorId, { name: cached.name, photoUrl: cached.photoUrl });
            } else {
                uncachedAuthorIds.push(authorId);
            }
        });

        console.log(`Message author cache: ${cachedData.size} cached, ${uncachedAuthorIds.length} need fetching`);

        // Only fetch uncached author data in BATCHES (not sequential calls)
        if (uncachedAuthorIds.length > 0) {
            // BATCH PROCESSING: Process authors in chunks of 10 to prevent API overload
            const BATCH_SIZE = 10;
            const batches: string[][] = [];

            for (let i = 0; i < uncachedAuthorIds.length; i += BATCH_SIZE) {
                batches.push(uncachedAuthorIds.slice(i, i + BATCH_SIZE));
            }

            // Process batches in parallel with controlled concurrency
            for (const batch of batches) {
                const batchResults = await Promise.allSettled([
                    ...batch.map(async (authorId) => {
                        const profile = await getUserProfile(authorId);
                        return {
                            authorId,
                            name: profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown User' : 'Unknown User'
                        };
                    }),
                    ...batch.map(async (authorId) => {
                        const photoUrl = await getUserProfilePhotoUrl(authorId);
                        return { authorId, photoUrl };
                    })
                ]);

                // Process batch results and update cache
                const profileResults = batchResults.slice(0, batch.length);
                const photoResults = batchResults.slice(batch.length);

                batch.forEach((authorId, index) => {
                    const profileResult = profileResults[index];
                    const photoResult = photoResults[index];

                    const name = profileResult.status === 'fulfilled' ? (profileResult.value as { authorId: string; name: string }).name : 'Unknown User';
                    const photoUrl = photoResult.status === 'fulfilled' ? (photoResult.value as { authorId: string; photoUrl: string | null }).photoUrl : null;

                    // Cache the result for future use
                    authorDataCache.set(authorId, { name, photoUrl, timestamp: now });
                    cachedData.set(authorId, { name, photoUrl });
                });
            }
        }

        // Enrich messages with cached/fetched author info
        return messages.map(message => ({
            ...message,
            authorName: cachedData.get(message.authorId)?.name || 'Unknown User',
            authorPhotoUrl: cachedData.get(message.authorId)?.photoUrl || null,
        }));
    } catch (error) {
        console.error('Error enriching messages with author info (optimized):', error);
        // Return messages with default author info if enrichment fails
        return messages.map(message => ({
            ...message,
            authorName: 'Unknown User',
            authorPhotoUrl: null,
        }));
    }
};

/**
 * Enrich messages with author information
 */
const enrichMessagesWithAuthorInfo = async (messages: Message[]): Promise<MessageWithAuthor[]> => {
    // SCALABILITY: Redirect to optimized version
    return enrichMessagesWithAuthorInfoOptimized(messages);
};

/**
 * Subscribe to real-time message updates (for future implementation)
 */
export const subscribeToMessages = (chatId: string, callback?: (message: Message) => void) => {
    // TODO: Implement real-time subscriptions using Appwrite Realtime API
    // This would listen for new messages and call the callback function
    console.log('Real-time message subscriptions not yet implemented');
};
