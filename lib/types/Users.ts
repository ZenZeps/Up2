export interface UserProfile {
    $id: string;
    firstName: string;
    lastName: string;
    email: string;
    isPublic: boolean;
    preferences: string[];
    friends?: string[];
    photoId?: string;
    notificationToken?: string;
    notificationsEnabled?: boolean;
    about?: string;
    nationality?: string;
    age?: number;
    createdAt?: string;
    updatedAt?: string;

    // ✅ NEW: Optimized fields for enterprise scalability
    accountStatus?: 'active' | 'suspended' | 'deleted';
    lastActive?: string;
    friendCount?: number;
    groupCount?: number;
    popularityScore?: number;
    lastLocationLat?: number;
    lastLocationLng?: number;
} 