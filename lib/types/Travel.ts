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
    destinationLat?: number; // Latitude of the destination
    destinationLng?: number; // Longitude of the destination
    locationName?: string; // Human readable location name
    friendsNotified?: string[]; // Array of friend user IDs who were notified (for future use)
    $createdAt?: string; // Appwrite system creation timestamp
    $updatedAt?: string; // Appwrite system update timestamp
}

export interface TravelAnnouncementWithUserInfo extends TravelAnnouncement {
    userName: string; // Added for display purposes
    userPhotoUrl?: string; // User's profile photo
}
