export interface UserProfile {
    $id: string;
    name: string;
    email: string;
    isPublic: boolean;
    preferences: string[];
    friends: string[];
    photoId?: string;
    notificationToken?: string;
    notificationsEnabled?: boolean;
    createdAt?: string;
    updatedAt?: string;
} 