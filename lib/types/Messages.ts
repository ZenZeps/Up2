export interface Chat {
    $id: string;  // Internal ID used by the app
    id?: string;  // Required ID field for Appwrite - will match $id

    // Entity reference (group or event)
    entityId: string; // ID of the group or event
    entityType: 'group' | 'event'; // Type of entity

    // Legacy fields for backward compatibility
    eventId?: string; // Reference to event (optional) - deprecated, use entityId + entityType
    groupId?: string; // Reference to group (optional) - deprecated, use entityId + entityType

    // Chat metadata
    messageCount?: number; // Total number of messages in this chat
    title?: string | null; // Optional chat title

    // Last message tracking for efficient chat list display
    lastMessageId?: string | null; // ID of the last message
    lastMessageAt?: string | null; // Timestamp of last message
    lastMessagePreview?: string | null; // Preview of last message content

    // Timestamps
    $createdAt?: string; // Created timestamp from Appwrite
    $updatedAt?: string; // Updated timestamp from Appwrite
}

export interface Message {
    $id: string;  // Internal ID used by the app
    id?: string;  // Required ID field for Appwrite - will match $id
    content: string; // The message text
    authorId: string; // User ID of who sent the message
    chatId: string; // Reference to the chat this message belongs to
    authorName?: string; // Computed field for display
    authorPhotoUrl?: string | null; // Computed field for display

    // Metadata
    $createdAt?: string; // Created timestamp from Appwrite
    $updatedAt?: string; // Updated timestamp from Appwrite

    // Optional features for future expansion
    isEdited?: boolean; // Whether message was edited
    replyToId?: string; // For threading/replies
    attachments?: string[]; // For file/image attachments
}

export interface MessageWithAuthor extends Message {
    authorName: string;
    authorPhotoUrl?: string | null;
}

export interface MessageThread {
    chat: Chat;
    messages: MessageWithAuthor[];
    totalCount: number;
    hasMore?: boolean; // SCALABILITY: Indicates if more messages are available for pagination
}

export interface MessageInput {
    content: string;
    chatId: string;
    replyToId?: string;
}
