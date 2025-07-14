export interface TravelAnnouncement {
    $id: string;
    id?: string; // Optional field for consistency - will match $id when returned from API
    userId: string; // The user who is traveling
    destination: string; // Where they're traveling to
    startDate: string; // ISO format - when travel starts
    endDate: string; // ISO format - when travel ends
    description?: string; // Optional description/notes about the trip
    isPublic: boolean; // Whether this travel is visible to friends
    createdAt: string; // When the announcement was created
    updatedAt?: string; // When it was last updated
}

export interface TravelAnnouncementWithUserInfo extends TravelAnnouncement {
    userName: string; // Added for display purposes
    userPhotoUrl?: string; // User's profile photo
}
