export interface Group {
    $id: string;  // Internal ID used by the app
    id?: string;  // Required ID field for Appwrite - will match $id
    title: string;
    creatorId: string;
    users?: string[]; // Array of user IDs that belong to this group
    events?: string[]; // Array of event IDs that belong to this group
    $createdAt?: string; // Created timestamp from Appwrite
    $updatedAt?: string; // Updated timestamp from Appwrite
}

export interface GroupWithDetails extends Group {
    userCount: number;
    eventCount: number;
    creatorName?: string;
}
