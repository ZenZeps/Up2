import { config, databases, ID, Query } from '@/lib/appwrite/appwrite';
import { Chat } from '@/lib/types/Messages';

/**
 * Create a chat for an event
 */
export const createEventChat = async (eventId: string): Promise<Chat> => {
    try {
        const chatData = {
            eventId,
        };

        const { createDocumentSafe } = await import('@/lib/appwrite/safeDb');
        const response = await createDocumentSafe(
            config.databaseID!,
            config.chatsCollectionID!,
            ID.unique(),
            chatData
        );

        return response as unknown as Chat;
    } catch (error) {
        console.error('Error creating event chat:', error);
        throw error;
    }
};

/**
 * Create a chat for a group
 */
export const createGroupChat = async (groupId: string): Promise<Chat> => {
    try {
        const chatData = {
            groupId,
        };

        const { createDocumentSafe } = await import('@/lib/appwrite/safeDb');
        const response = await createDocumentSafe(
            config.databaseID!,
            config.chatsCollectionID!,
            ID.unique(),
            chatData
        );

        return response as unknown as Chat;
    } catch (error) {
        console.error('Error creating group chat:', error);
        throw error;
    }
};

/**
 * Get chat for an event (create if doesn't exist)
 */
export const getOrCreateEventChat = async (eventId: string): Promise<Chat> => {
    try {
        // First try to find existing chat
        const response = await databases.listDocuments(
            config.databaseID!,
            config.chatsCollectionID!,
            [
                Query.equal('eventId', eventId),
                Query.limit(1),
            ]
        );

        if (response.documents.length > 0) {
            return response.documents[0] as unknown as Chat;
        }

        // Create new chat if doesn't exist
        return await createEventChat(eventId);
    } catch (error) {
        console.error('Error getting or creating event chat:', error);
        throw error;
    }
};

/**
 * Get chat for a group (create if doesn't exist)
 */
export const getOrCreateGroupChat = async (groupId: string): Promise<Chat> => {
    try {
        // First try to find existing chat
        const response = await databases.listDocuments(
            config.databaseID!,
            config.chatsCollectionID!,
            [
                Query.equal('groupId', groupId),
                Query.limit(1),
            ]
        );

        if (response.documents.length > 0) {
            return response.documents[0] as unknown as Chat;
        }

        // Create new chat if doesn't exist
        return await createGroupChat(groupId);
    } catch (error) {
        console.error('Error getting or creating group chat:', error);
        throw error;
    }
};

/**
 * Delete a chat (messages will be deleted automatically via cascade)
 */
export const deleteChat = async (chatId: string): Promise<void> => {
    try {
        await databases.deleteDocument(
            config.databaseID!,
            config.chatsCollectionID!,
            chatId
        );
    } catch (error) {
        console.error('Error deleting chat:', error);
        throw error;
    }
};

/**
 * Get messages for a group chat with author details
 */
export const getGroupChatMessages = async (chatId: string) => {
    try {
        // Import here to avoid circular dependencies
        const { getChatMessages } = await import('./messages');
        const messageThread = await getChatMessages(chatId);
        return messageThread.messages || [];
    } catch (error) {
        console.error('Error getting group chat messages:', error);
        return [];
    }
};
