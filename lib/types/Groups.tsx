export interface Group {
    $id: string;  // Internal ID used by the app
    id?: string;  // Required ID field for Appwrite - will match $id
    title: string;
    description?: string; // Optional group description
    creatorId: string;
    isPrivate: boolean; // true for private groups, false for public groups
    users?: string[]; // Array of user IDs that belong to this group
    events?: string[]; // Array of event IDs that belong to this group
    memberCount?: number; // Computed field for display
    $createdAt?: string; // Created timestamp from Appwrite
    $updatedAt?: string; // Updated timestamp from Appwrite
}

export interface GroupWithDetails extends Group {
    userCount: number;
    eventCount: number;
    creatorName?: string;
    isUserMember?: boolean; // Whether current user is a member
    canUserJoin?: boolean; // Whether current user can join (for public groups)
}
