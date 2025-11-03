/**
 * Centralized location mock data for development and testing
 * Used across travel forms and autocomplete components
 */
export const LOCATION_MOCKS: Record<string, { lat: number; lng: number }> = {
    // Australia
    'sydney': { lat: -33.8688, lng: 151.2093 },
    'melbourne': { lat: -37.8136, lng: 144.9631 },
    'brisbane': { lat: -27.4698, lng: 153.0251 },
    'perth': { lat: -31.9505, lng: 115.8605 },
    'adelaide': { lat: -34.9285, lng: 138.6007 },

    // International
    'new york': { lat: 40.7128, lng: -74.0060 },
    'london': { lat: 51.5074, lng: -0.1278 },
    'tokyo': { lat: 35.6762, lng: 139.6503 },
    'paris': { lat: 48.8566, lng: 2.3522 },
    'bali': { lat: -8.3405, lng: 115.0920 },
    'bangkok': { lat: 13.7563, lng: 100.5018 },
    'singapore': { lat: 1.3521, lng: 103.8198 },
    'hong kong': { lat: 22.3193, lng: 114.1694 }
};

/**
 * Quick search cities for UI components
 */
export const QUICK_SEARCH_CITIES = ['Sydney', 'Melbourne', 'New York', 'Tokyo', 'London', 'Bali'];

/**
 * Get location coordinates for a destination
 */
export function getLocationCoordinates(destination: string): { lat: number; lng: number } | undefined {
    const normalizedDestination = destination.toLowerCase();
    return LOCATION_MOCKS[normalizedDestination];
}