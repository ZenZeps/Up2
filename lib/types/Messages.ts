export interface Chat {
    $id: string;  // Internal ID used by the app
    id?: string;  // Required ID field for Appwrite - will match $id
    eventId?: string; // Reference to event (optional)
    groupId?: string; // Reference to group (optional)
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
