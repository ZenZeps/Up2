/**
 * 🔄 Query Helpers for Relationship Transition
 * 
 * These functions try relationship fields first, then fall back to string fields
 * for backward compatibility during the migration period.
 */

import { config, databases, Query } from '@/lib/appwrite/appwrite';

/**
 * Query events by creator - tries relationship field first, falls back to string field
 */
export const queryEventsByCreator = async (creatorId: string) => {
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
            console.log(`✅ Found ${events.documents.length} events using creator relationship field`);
            return events.documents;
        } catch (relationshipError) {
            // Fallback to string field if relationship not available yet
            console.log('⏭️ Falling back to creatorId string field');
            const events = await databases.listDocuments(
                config.databaseID!,
                config.eventsCollectionID!,
                [
                    Query.equal('creatorId', creatorId),
                    Query.orderDesc('$createdAt')
                ]
            );
            console.log(`✅ Found ${events.documents.length} events using creatorId string field`);
            return events.documents;
        }
    } catch (error) {
        console.error('Error querying events by creator:', error);
        throw error;
    }
};

/**
 * Query event attendances by user - tries relationship field first
 */
export const queryAttendancesByUser = async (userId: string) => {
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
            console.log(`✅ Found ${attendances.documents.length} attendances using user relationship field`);
            return attendances.documents;
        } catch (relationshipError) {
            // Fallback to string field
            console.log('⏭️ Falling back to userId string field for attendances');
            const attendances = await databases.listDocuments(
                config.databaseID!,
                config.eventAttendancesCollectionID!,
                [
                    Query.equal('userId', userId),
                    Query.orderDesc('$createdAt')
                ]
            );
            console.log(`✅ Found ${attendances.documents.length} attendances using userId string field`);
            return attendances.documents;
        }
    } catch (error) {
        console.error('Error querying attendances by user:', error);
        throw error;
    }
};

/**
 * Query event attendances by event - tries relationship field first
 */
export const queryAttendancesByEvent = async (eventId: string) => {
    try {
        // Try relationship field first
        try {
            const attendances = await databases.listDocuments(
                config.databaseID!,
                config.eventAttendancesCollectionID!,
                [
                    Query.equal('event', eventId),
                    Query.orderDesc('$createdAt')
                ]
            );
            console.log(`✅ Found ${attendances.documents.length} attendances using event relationship field`);
            return attendances.documents;
        } catch (relationshipError) {
            // Fallback to string field
            console.log('⏭️ Falling back to eventId string field for attendances');
            const attendances = await databases.listDocuments(
                config.databaseID!,
                config.eventAttendancesCollectionID!,
                [
                    Query.equal('eventId', eventId),
                    Query.orderDesc('$createdAt')
                ]
            );
            console.log(`✅ Found ${attendances.documents.length} attendances using eventId string field`);
            return attendances.documents;
        }
    } catch (error) {
        console.error('Error querying attendances by event:', error);
        throw error;
    }
};

/**
 * Query group memberships by user - tries relationship field first
 */
export const queryMembershipsByUser = async (userId: string) => {
    try {
        // Try relationship field first
        try {
            const memberships = await databases.listDocuments(
                config.databaseID!,
                config.groupMembershipsCollectionID!,
                [
                    Query.equal('user', userId),
                    Query.orderDesc('$createdAt')
                ]
            );
            console.log(`✅ Found ${memberships.documents.length} memberships using user relationship field`);
            return memberships.documents;
        } catch (relationshipError) {
            // Fallback to string field
            console.log('⏭️ Falling back to userId string field for memberships');
            const memberships = await databases.listDocuments(
                config.databaseID!,
                config.groupMembershipsCollectionID!,
                [
                    Query.equal('userId', userId),
                    Query.orderDesc('$createdAt')
                ]
            );
            console.log(`✅ Found ${memberships.documents.length} memberships using userId string field`);
            return memberships.documents;
        }
    } catch (error) {
        console.error('Error querying memberships by user:', error);
        throw error;
    }
};

/**
 * Query group memberships by group - tries relationship field first
 */
export const queryMembershipsByGroup = async (groupId: string) => {
    try {
        // Try relationship field first
        try {
            const memberships = await databases.listDocuments(
                config.databaseID!,
                config.groupMembershipsCollectionID!,
                [
                    Query.equal('group', groupId),
                    Query.orderDesc('$createdAt')
                ]
            );
            console.log(`✅ Found ${memberships.documents.length} memberships using group relationship field`);
            return memberships.documents;
        } catch (relationshipError) {
            // Fallback to string field
            console.log('⏭️ Falling back to groupId string field for memberships');
            const memberships = await databases.listDocuments(
                config.databaseID!,
                config.groupMembershipsCollectionID!,
                [
                    Query.equal('groupId', groupId),
                    Query.orderDesc('$createdAt')
                ]
            );
            console.log(`✅ Found ${memberships.documents.length} memberships using groupId string field`);
            return memberships.documents;
        }
    } catch (error) {
        console.error('Error querying memberships by group:', error);
        throw error;
    }
};

/**
 * Query messages by sender - tries relationship field first
 */
export const queryMessagesBySender = async (senderId: string) => {
    try {
        // Try relationship field first
        try {
            const messages = await databases.listDocuments(
                config.databaseID!,
                config.messagesCollectionID!,
                [
                    // Query.equal('sender', senderId), // REMOVED: Not in database schema - causes "Unknown attribute" error
                    Query.equal('authorId', senderId), // Use string field instead
                    Query.orderDesc('$createdAt')
                ]
            );
            console.log(`✅ Found ${messages.documents.length} messages using sender relationship field`);
            return messages.documents;
        } catch (relationshipError) {
            // Fallback to string fields
            console.log('⏭️ Falling back to senderId/authorId string fields for messages');
            let messages;
            try {
                messages = await databases.listDocuments(
                    config.databaseID!,
                    config.messagesCollectionID!,
                    [
                        Query.equal('senderId', senderId),
                        Query.orderDesc('$createdAt')
                    ]
                );
            } catch (senderIdError) {
                // Try authorId as alternative
                messages = await databases.listDocuments(
                    config.databaseID!,
                    config.messagesCollectionID!,
                    [
                        Query.equal('authorId', senderId),
                        Query.orderDesc('$createdAt')
                    ]
                );
            }
            console.log(`✅ Found ${messages.documents.length} messages using string field`);
            return messages.documents;
        }
    } catch (error) {
        console.error('Error querying messages by sender:', error);
        throw error;
    }
};

/**
 * Query messages by chat - tries relationship field first
 */
export const queryMessagesByChat = async (chatId: string) => {
    try {
        // Try relationship field first
        try {
            const messages = await databases.listDocuments(
                config.databaseID!,
                config.messagesCollectionID!,
                [
                    // Query.equal('chat', chatId), // REMOVED: Not in database schema - causes "Unknown attribute" error
                    Query.equal('chatId', chatId), // Use string field instead
                    Query.orderDesc('$createdAt')
                ]
            );
            console.log(`✅ Found ${messages.documents.length} messages using chat relationship field`);
            return messages.documents;
        } catch (relationshipError) {
            // Fallback to string field
            console.log('⏭️ Falling back to chatId string field for messages');
            const messages = await databases.listDocuments(
                config.databaseID!,
                config.messagesCollectionID!,
                [
                    Query.equal('chatId', chatId),
                    Query.orderDesc('$createdAt')
                ]
            );
            console.log(`✅ Found ${messages.documents.length} messages using chatId string field`);
            return messages.documents;
        }
    } catch (error) {
        console.error('Error querying messages by chat:', error);
        throw error;
    }
};

export default {
    queryEventsByCreator,
    queryAttendancesByUser,
    queryAttendancesByEvent,
    queryMembershipsByUser,
    queryMembershipsByGroup,
    queryMessagesBySender,
    queryMessagesByChat
};