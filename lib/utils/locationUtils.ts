import * as Location from 'expo-location';

// Calculate distance between two coordinates using Haversine formula
export const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Get user's current location
export const getCurrentUserLocation = async (): Promise<Location.LocationObject | null> => {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
            return null;
        }

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
        return location;
    } catch (error) {
        console.error('Error getting user location:', error);
        return null;
    }
};

// Geocode a location string to coordinates
export const geocodeLocation = async (
    locationString: string
): Promise<{ latitude: number; longitude: number } | null> => {
    try {
        const geocoded = await Location.geocodeAsync(locationString);
        if (geocoded.length > 0) {
            return {
                latitude: geocoded[0].latitude,
                longitude: geocoded[0].longitude,
            };
        }
        return null;
    } catch (error) {
        console.error('Error geocoding location:', error);
        return null;
    }
};

// Filter events by location and proximity
export const filterEventsByLocation = (
    events: any[],
    userLocation: Location.LocationObject | null,
    searchLocation?: { latitude: number; longitude: number },
    proximityKm: number = 25
) => {
    const referenceLocation = searchLocation || userLocation?.coords;

    if (!referenceLocation) {
        return events; // Return all events if no reference location
    }

    return events.filter((event) => {
        // Check if event has coordinates (from your database)
        if (event.locationLat && event.locationLng) {
            const distance = calculateDistance(
                referenceLocation.latitude,
                referenceLocation.longitude,
                event.locationLat,
                event.locationLng
            );
            return distance <= proximityKm;
        }

        return false; // Exclude events without coordinates
    });
};

// Filter events by date
export const filterEventsByDate = (events: any[], targetDate: Date) => {
    const targetDateStr = targetDate.toDateString();

    return events.filter((event) => {
        const eventDate = new Date(event.startTime);
        return eventDate.toDateString() === targetDateStr;
    });
};

// Combined filter function
export const filterEventsByLocationAndDate = (
    events: any[],
    filters: {
        userLocation?: Location.LocationObject | null;
        searchLocation?: { latitude: number; longitude: number };
        targetDate?: Date;
        proximityKm?: number;
    }
) => {
    let filteredEvents = events;

    // Apply location filter
    if (filters.userLocation || filters.searchLocation) {
        filteredEvents = filterEventsByLocation(
            filteredEvents,
            filters.userLocation || null,
            filters.searchLocation,
            filters.proximityKm || 25
        );
    }

    // Apply date filter
    if (filters.targetDate) {
        filteredEvents = filterEventsByDate(filteredEvents, filters.targetDate);
    }

    return filteredEvents;
};

// Mock coordinates for common cities (temporary solution)
// TODO: Replace with actual coordinates from your database
export const getMockCoordinatesForLocation = (locationString: string) => {
    const mockCoordinates: { [key: string]: { latitude: number; longitude: number } } = {
        'sydney': { latitude: -33.8688, longitude: 151.2093 },
        'melbourne': { latitude: -37.8136, longitude: 144.9631 },
        'brisbane': { latitude: -27.4698, longitude: 153.0251 },
        'perth': { latitude: -31.9505, longitude: 115.8605 },
        'adelaide': { latitude: -34.9285, longitude: 138.6007 },
        'gold coast': { latitude: -28.0167, longitude: 153.4000 },
        'newcastle': { latitude: -32.9267, longitude: 151.7789 },
        'canberra': { latitude: -35.2809, longitude: 149.1300 },
        'darwin': { latitude: -12.4634, longitude: 130.8456 },
        'hobart': { latitude: -42.8821, longitude: 147.3272 },
    };

    const locationKey = locationString.toLowerCase();
    for (const [key, coords] of Object.entries(mockCoordinates)) {
        if (locationKey.includes(key)) {
            return coords;
        }
    }

    return null;
};

// Update user location in database (optional)
export const updateUserLocationInDatabase = async (
    userId: string,
    location: Location.LocationObject,
    updateUserLocation: (userId: string, data: any) => Promise<void>
) => {
    try {
        await updateUserLocation(userId, {
            lastLocationLat: location.coords.latitude,
            lastLocationLng: location.coords.longitude,
            lastLocationUpdate: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error updating user location in database:', error);
    }
};

export default {
    calculateDistance,
    getCurrentUserLocation,
    geocodeLocation,
    filterEventsByLocation,
    filterEventsByDate,
    filterEventsByLocationAndDate,
    getMockCoordinatesForLocation,
    updateUserLocationInDatabase,
};
