import { config, databases, ID, Query } from '@/lib/appwrite/appwrite';
import { Chat, Message, MessageInput, MessageThread, MessageWithAuthor } from '@/lib/types/Messages';
import { getOrCreateEventChat, getOrCreateGroupChat } from './chats';
import { getUserProfilePhotoUrl } from './profilePhoto';
import { getUserProfile } from './user';
import { sendChatMessageNotification } from '../notifications/notificationUtils';

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

        const response = await databases.createDocument(
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

            // Get participants based on chat type
            let participantIds: string[] = [];
            
            if (chat.eventId) {
                // For event chats, get event attendees
                const event = await databases.getDocument(
                    config.databaseID!,
                    config.eventsCollectionID!,
                    chat.eventId
                );
                participantIds = event.attendees || [];
            } else if (chat.groupId) {
                // For group chats, get group members
                const group = await databases.getDocument(
                    config.databaseID!,
                    config.groupsCollectionID!,
                    chat.groupId
                );
                participantIds = group.members || [];
            }

            // Send notification to other participants
            if (participantIds.length > 1) {
                await sendChatMessageNotification(
                    participantIds,
                    senderName,
                    messageInput.content.trim(),
                    messageInput.chatId,
                    authorId
                );
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

/**
 * Get messages for a specific chat
 */
export const getChatMessages = async (chatId: string, limit: number = 50): Promise<MessageThread> => {
    try {
        // Get chat details first
        const chat = await databases.getDocument(
            config.databaseID!,
            config.chatsCollectionID!,
            chatId
        ) as unknown as Chat;

        // Get messages for this chat
        const response = await databases.listDocuments(
            config.databaseID!,
            config.messagesCollectionID!,
            [
                Query.equal('chatId', chatId),
                Query.orderDesc('$createdAt'),
                Query.limit(limit),
            ]
        );

        const messages = response.documents as unknown as Message[];
        const messagesWithAuthor = await enrichMessagesWithAuthorInfo(messages);

        return {
            chat,
            messages: messagesWithAuthor.reverse(), // Show oldest first for chat-like experience
            totalCount: response.total,
        };
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        throw error;
    }
};

/**
 * Get messages for a specific event (convenience method)
 */
export const getEventMessages = async (eventId: string, limit: number = 50): Promise<MessageThread> => {
    try {
        const chat = await getOrCreateEventChat(eventId);
        return await getChatMessages(chat.$id, limit);
    } catch (error) {
        console.error('Error fetching event messages:', error);
        throw error;
    }
};

/**
 * Get messages for a specific group (convenience method)
 */
export const getGroupMessages = async (groupId: string, limit: number = 50): Promise<MessageThread> => {
    try {
        const chat = await getOrCreateGroupChat(groupId);
        return await getChatMessages(chat.$id, limit);
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
 * Enrich messages with author information
 */
const enrichMessagesWithAuthorInfo = async (messages: Message[]): Promise<MessageWithAuthor[]> => {
    try {
        // Get unique author IDs
        const uniqueAuthorIds = [...new Set(messages.map(msg => msg.authorId))];

        // Fetch author profiles and photos in parallel
        const [authorProfiles, authorPhotos] = await Promise.all([
            Promise.all(uniqueAuthorIds.map(async (authorId) => {
                try {
                    const profile = await getUserProfile(authorId);
                    return { authorId, profile };
                } catch {
                    return { authorId, profile: null };
                }
            })),
            Promise.all(uniqueAuthorIds.map(async (authorId) => {
                try {
                    const photoUrl = await getUserProfilePhotoUrl(authorId);
                    return { authorId, photoUrl };
                } catch {
                    return { authorId, photoUrl: null };
                }
            }))
        ]);

        // Create lookup maps
        const profileMap = new Map(
            authorProfiles.map(({ authorId, profile }) => [
                authorId,
                profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown User' : 'Unknown User'
            ])
        );

        const photoMap = new Map(
            authorPhotos.map(({ authorId, photoUrl }) => [authorId, photoUrl])
        );

        // Enrich messages with author info
        return messages.map(message => ({
            ...message,
            authorName: profileMap.get(message.authorId) || 'Unknown User',
            authorPhotoUrl: photoMap.get(message.authorId) || null,
        }));
    } catch (error) {
        console.error('Error enriching messages with author info:', error);
        // Return messages with default author info if enrichment fails
        return messages.map(message => ({
            ...message,
            authorName: 'Unknown User',
            authorPhotoUrl: null,
        }));
    }
};

/**
 * Subscribe to real-time message updates (for future implementation)
 */
export const subscribeToMessages = (chatId: string, callback?: (message: Message) => void) => {
    // TODO: Implement real-time subscriptions using Appwrite Realtime API
    // This would listen for new messages and call the callback function
    console.log('Real-time message subscriptions not yet implemented');
};
