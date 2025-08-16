// New optimized database types for enterprise scale

export interface UserFriendship {
    $id: string;
    userId1: string;
    userId2: string;
    status: 'pending' | 'accepted' | 'blocked' | 'declined';
    requesterId: string;
    acceptedAt?: string;
    $createdAt: string;
    $updatedAt: string;
}

export interface EventAttendance {
    $id: string;
    eventId: string;
    userId: string;
    status: 'invited' | 'attending' | 'not_attending' | 'maybe';
    invitedBy?: string;
    respondedAt?: string;
    $createdAt: string;
    $updatedAt: string;
}

// Enhanced User type (keeping backward compatibility)
export interface OptimizedUserProfile {
    $id: string;
    firstName: string;
    lastName: string;
    email: string;
    isPublic: boolean;
    photoId?: string;

    // ✅ NEW: Optimized fields (add these gradually)
    accountStatus?: 'active' | 'suspended' | 'deleted';
    lastActive?: string;
    friendCount?: number;
    groupCount?: number;
    popularityScore?: number;
    lastLocationLat?: number;
    lastLocationLng?: number;

    // ⚠️ DEPRECATED: Keep for backward compatibility during migration
    friends?: string[];
    preferences?: string[];

    // ... other existing fields
    notificationToken?: string;
    notificationsEnabled?: boolean;
    about?: string;
    nationality?: string;
    age?: number;
    createdAt?: string;
    updatedAt?: string;
}

// Enhanced Event type (keeping backward compatibility)
export interface OptimizedEvent {
    $id: string;
    id?: string;
    title: string;
    location: string;
    startTime: string;
    endTime: string;
    creatorId: string;
    description?: string;
    tags: string[];
    isPrivate?: boolean;
    groupId?: string;
    groupName?: string;

    // ✅ NEW: Optimized fields (add these gradually)
    attendeeCount?: number;
    inviteCount?: number;
    viewCount?: number;
    popularityScore?: number;
    locationLat?: number;
    locationLng?: number;
    searchKeywords?: string[];
    categoryTags?: string[];
    responseRate?: number;
    lastActivityAt?: string;

    // ⚠️ DEPRECATED: Keep for backward compatibility during migration
    inviteeIds?: string[];
    attendees?: string[];
    isAttending?: boolean;
}

// Migration status tracking
export interface MigrationStatus {
    userId: string;
    friendsMigrated: boolean;
    eventsMigrated: boolean;
    lastMigrationCheck: string;
    errors?: string[];
}
