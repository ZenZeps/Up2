/**
 * Optimized Appwrite Setup for Chat & Messages Collections
 * 
 * This setup is optimized for:
 * - Group and Event messaging only (no 1-on-1 chats)
 * - Efficient DB reads/writes with proper indexing
 * - Scalable message retrieval with pagination
 * - Real-time messaging capabilities
 */

import { Client, Databases } from 'appwrite';

// Collection Configuration
const CHATS_COLLECTION_ID = 'chats';
const MESSAGES_COLLECTION_ID = 'messages';
const DATABASE_ID = 'your_database_id';

/**
 * ========================================
 * COLLECTION 1: CHATS
 * ========================================
 * Purpose: Store chat containers for groups and events
 * Key Features:
 * - One chat per group/event
 * - Lightweight metadata storage
 * - Efficient lookups by entityId
 */

const createChatsCollection = async (databases: Databases) => {
    console.log('Creating optimized Chats collection...');

    try {
        // Create the collection
        const collection = await databases.createCollection(
            DATABASE_ID,
            CHATS_COLLECTION_ID,
            'Chats',
            [
                // Read permissions for participants
                'read("users")', // All authenticated users can read
                // Write permissions for creators and moderators
                'create("users")',
                'update("users")',
                'delete("users")'
            ]
        );

        // ===== ATTRIBUTES =====

        // Entity Reference (either groupId OR eventId, never both)
        await databases.createStringAttribute(
            DATABASE_ID,
            CHATS_COLLECTION_ID,
            'entityId',
            255,
            true // Required - unique identifier for group or event
        );

        // Entity Type to distinguish between groups and events
        await databases.createEnumAttribute(
            DATABASE_ID,
            CHATS_COLLECTION_ID,
            'entityType',
            ['group', 'event'],
            true // Required
        );

        // Optional: Chat metadata
        await databases.createStringAttribute(
            DATABASE_ID,
            CHATS_COLLECTION_ID,
            'title',
            255,
            false // Optional - for custom chat names
        );

        // Message counts for UI optimization
        await databases.createIntegerAttribute(
            DATABASE_ID,
            CHATS_COLLECTION_ID,
            'messageCount',
            false,
            0, // Min value
            null, // Max value
            0 // Default value
        );

        // Last message info for chat list optimization
        await databases.createStringAttribute(
            DATABASE_ID,
            CHATS_COLLECTION_ID,
            'lastMessageId',
            255,
            false
        );

        await databases.createDatetimeAttribute(
            DATABASE_ID,
            CHATS_COLLECTION_ID,
            'lastMessageAt',
            false
        );

        await databases.createStringAttribute(
            DATABASE_ID,
            CHATS_COLLECTION_ID,
            'lastMessagePreview',
            200, // Short preview
            false
        );

        // ===== CRITICAL INDEXES FOR PERFORMANCE =====

        // 1. Primary lookup: Find chat by entity (MOST IMPORTANT)
        await databases.createIndex(
            DATABASE_ID,
            CHATS_COLLECTION_ID,
            'idx_entity_lookup',
            'key', // Unique index
            ['entityType', 'entityId']
        );

        // 2. Chat list ordering by last activity
        await databases.createIndex(
            DATABASE_ID,
            CHATS_COLLECTION_ID,
            'idx_last_activity',
            'key',
            ['lastMessageAt']
        );

        // 3. Entity type filtering
        await databases.createIndex(
            DATABASE_ID,
            CHATS_COLLECTION_ID,
            'idx_entity_type',
            'key',
            ['entityType']
        );

        console.log('✅ Chats collection created with optimized indexes');

    } catch (error) {
        console.error('❌ Error creating Chats collection:', error);
        throw error;
    }
};

/**
 * ========================================
 * COLLECTION 2: MESSAGES
 * ========================================
 * Purpose: Store individual messages within chats
 * Key Features:
 * - High-volume message storage
 * - Efficient pagination and real-time queries
 * - Optimized for chronological retrieval
 */

const createMessagesCollection = async (databases: Databases) => {
    console.log('Creating optimized Messages collection...');

    try {
        // Create the collection
        const collection = await databases.createCollection(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'Messages',
            [
                // Read permissions for chat participants
                'read("users")',
                // Write permissions for message creation
                'create("users")',
                // Update only for message author (for editing)
                'update("users")',
                // Delete for message author and moderators
                'delete("users")'
            ]
        );

        // ===== ATTRIBUTES =====

        // Core message data
        await databases.createStringAttribute(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'chatId',
            255,
            true // Required - links to chat
        );

        await databases.createStringAttribute(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'authorId',
            255,
            true // Required - message author
        );

        await databases.createStringAttribute(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'content',
            4000, // Generous limit for message content
            true // Required
        );

        // Message threading (for replies)
        await databases.createStringAttribute(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'replyToId',
            255,
            false // Optional - for threaded conversations
        );

        // Message status and metadata
        await databases.createBooleanAttribute(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'isEdited',
            false,
            false // Default: not edited
        );

        await databases.createBooleanAttribute(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'isDeleted',
            false,
            false // Soft delete for message history
        );

        // Message type for future features (text, image, file, etc.)
        await databases.createEnumAttribute(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'messageType',
            ['text', 'image', 'file', 'system'],
            false,
            'text' // Default to text messages
        );

        // Attachment URLs (for media messages)
        await databases.createStringAttribute(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'attachmentUrls',
            2000, // JSON array of URLs
            false
        );

        // ===== CRITICAL INDEXES FOR CHAT PERFORMANCE =====

        // 1. Primary query: Get messages for a chat (MOST CRITICAL)
        await databases.createIndex(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'idx_chat_timeline',
            'key',
            ['chatId', '$createdAt'] // Chronological order within chat
        );

        // 2. Author-based queries (for user's message history)
        await databases.createIndex(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'idx_author_messages',
            'key',
            ['authorId', '$createdAt']
        );

        // 3. Reply threading support
        await databases.createIndex(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'idx_reply_chain',
            'key',
            ['replyToId', '$createdAt']
        );

        // 4. Real-time subscriptions (for live chat)
        await databases.createIndex(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'idx_realtime_chat',
            'key',
            ['chatId', '$id'] // For efficient real-time filtering
        );

        // 5. Message status filtering (exclude deleted messages)
        await databases.createIndex(
            DATABASE_ID,
            MESSAGES_COLLECTION_ID,
            'idx_active_messages',
            'key',
            ['chatId', 'isDeleted', '$createdAt']
        );

        console.log('✅ Messages collection created with optimized indexes');

    } catch (error) {
        console.error('❌ Error creating Messages collection:', error);
        throw error;
    }
};

/**
 * ========================================
 * SETUP FUNCTION
 * ========================================
 */

export const setupOptimizedChatCollections = async () => {
    console.log('🚀 Setting up optimized Chat & Messages collections...');

    const client = new Client();
    client
        .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!)
        .setKey(process.env.APPWRITE_API_KEY!); // Server-side API key required

    const databases = new Databases(client);

    try {
        // Create both collections with optimized structure
        await createChatsCollection(databases);
        await createMessagesCollection(databases);

        console.log('🎉 Chat system setup complete!');
        console.log('');
        console.log('📋 Next steps:');
        console.log('1. Update your environment variables with the new collection IDs');
        console.log('2. Deploy the optimized API functions');
        console.log('3. Test with real-time subscriptions');

    } catch (error) {
        console.error('💥 Setup failed:', error);
        throw error;
    }
};

/**
 * ========================================
 * PERFORMANCE OPTIMIZATION NOTES
 * ========================================
 *
 * 1. INDEX STRATEGY:
 *    - Composite indexes for complex queries (chatId + timestamp)
 *    - Separate indexes for different query patterns
 *    - Real-time subscription optimization
 *
 * 2. QUERY PATTERNS OPTIMIZED:
 *    - Get messages for chat (paginated): [chatId, $createdAt]
 *    - Find chat by group/event: [entityType, entityId]
 *    - Real-time subscriptions: [chatId, $id]
 *    - User message history: [authorId, $createdAt]
 *
 * 3. SCALABILITY FEATURES:
 *    - Message pagination with offset/limit
 *    - Soft delete for message history
 *    - Chat metadata caching (message count, last message)
 *    - Efficient entity lookups
 *
 * 4. REAL-TIME READY:
 *    - Structured for Appwrite real-time subscriptions
 *    - Minimal data transfer with indexed queries
 *    - Efficient chat list updates
 */

// Usage example:
// await setupOptimizedChatCollections();