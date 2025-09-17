// Simplified Travel Announcement types focused on friend location notifications

export interface TravelAnnouncement {
    $id: string;
    id?: string; // For backward compatibility
    userId: string;
    destination: string;
    startDate: string; // ISO string
    endDate: string; // ISO string
    description?: string;
    isPublic: boolean;

    // ✅ CORE: Location-based friend matching
    destinationLat?: number; // For location-based friend discovery
    destinationLng?: number; // For location-based friend discovery
    locationName?: string; // User-friendly location name

    // ✅ CORE: Friend notification tracking
    friendsNotified?: string[]; // Array of friend user IDs who were notified

    // System fields
    createdAt?: string;
    updatedAt?: string;
    $createdAt: string;
    $updatedAt: string;
}

// For creating new travel announcements
export interface CreateTravelAnnouncementData {
    destination: string;
    startDate: string;
    endDate: string;
    description?: string;
    isPublic: boolean;
    destinationLat?: number;
    destinationLng?: number;
    locationName?: string;
}

// For friend location matching
export interface FriendLocationMatch {
    friendUserId: string;
    travelAnnouncementId: string;
    overlapStartDate: string;
    overlapEndDate: string;
    distanceKm?: number;
}
