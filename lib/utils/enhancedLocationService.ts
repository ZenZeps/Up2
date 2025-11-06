/**
 * Enhanced location service with improved ranking and cost optimization
 */

import { getCurrentUserLocation } from './locationUtils';

interface LocationBias {
    lat: number;
    lng: number;
    radius: number; // in meters
}

interface EnhancedPlacesConfig {
    autocomplete: {
        types: string;
        components?: string;
        language: string;
        sessiontoken: string | null;
        locationbias?: string; // For proximity-based ranking
        strictbounds?: boolean; // Restrict to bias area
    };
    details: {
        fields: string;
    };
}

class EnhancedLocationService {
    private userLocation: { lat: number; lng: number } | null = null;
    private locationCacheTimeout = 5 * 60 * 1000; // 5 minutes
    private lastLocationFetch = 0;

    async initializeUserLocation(): Promise<void> {
        const now = Date.now();
        if (now - this.lastLocationFetch < this.locationCacheTimeout && this.userLocation) {
            return; // Use cached location
        }

        try {
            const location = await getCurrentUserLocation('settings');
            if (location) {
                this.userLocation = {
                    lat: location.latitude,
                    lng: location.longitude
                };
                this.lastLocationFetch = now;
                console.log('✅ User location updated for enhanced search:', this.userLocation);
            }
        } catch (error) {
            console.warn('⚠️ Could not get user location for enhanced search:', error);
        }
    }

    generateLocationBias(radiusKm: number = 50): string | undefined {
        if (!this.userLocation) return undefined;

        const radiusMeters = radiusKm * 1000;
        return `circle:${radiusMeters}@${this.userLocation.lat},${this.userLocation.lng}`;
    }

    generateEnhancedPlacesConfig(sessionToken: string, searchQuery: string): EnhancedPlacesConfig {
        // Dynamic type selection based on query
        let types = 'establishment';
        const query = searchQuery.toLowerCase();

        if (query.includes('restaurant') || query.includes('cafe') || query.includes('bar')) {
            types = 'food';
        } else if (query.includes('hotel') || query.includes('accommodation')) {
            types = 'lodging';
        } else if (query.includes('park') || query.includes('beach')) {
            types = 'tourist_attraction';
        }

        const config: EnhancedPlacesConfig = {
            autocomplete: {
                types,
                language: 'en',
                sessiontoken: sessionToken,
                strictbounds: false // Allow results outside bias but rank them lower
            },
            details: {
                fields: 'place_id,formatted_address,name,geometry,types,business_status,rating,user_ratings_total,price_level,opening_hours,vicinity'
            }
        };

        // Add location bias for better ranking
        const locationBias = this.generateLocationBias(50); // 50km radius
        if (locationBias) {
            config.autocomplete.locationbias = locationBias;
        } else {
            // Fallback to country filtering if no user location
            config.autocomplete.components = 'country:us|country:ca|country:gb|country:au|country:nz';
        }

        return config;
    }

    // Cost optimization: Cache frequent searches
    private searchCache = new Map<string, { results: any[], timestamp: number }>();
    private CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

    getCachedResults(query: string): any[] | null {
        const cached = this.searchCache.get(query.toLowerCase());
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            console.log('📦 Using cached results for:', query);
            return cached.results;
        }
        return null;
    }

    setCachedResults(query: string, results: any[]): void {
        this.searchCache.set(query.toLowerCase(), {
            results,
            timestamp: Date.now()
        });

        // Cleanup old cache entries
        if (this.searchCache.size > 100) {
            const oldestKey = Array.from(this.searchCache.keys())[0];
            this.searchCache.delete(oldestKey);
        }
    }
}

export const enhancedLocationService = new EnhancedLocationService();

// Usage in PlaceAutocomplete component:
export const getEnhancedPlacesUrl = async (
    query: string,
    sessionToken: string,
    apiKey: string
): Promise<string> => {
    await enhancedLocationService.initializeUserLocation();
    const config = enhancedLocationService.generateEnhancedPlacesConfig(sessionToken, query);

    let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
        `input=${encodeURIComponent(query.trim())}` +
        `&types=${config.autocomplete.types}` +
        `&language=${config.autocomplete.language}` +
        `&sessiontoken=${sessionToken}` +
        `&key=${apiKey}`;

    if (config.autocomplete.locationbias) {
        url += `&locationbias=${encodeURIComponent(config.autocomplete.locationbias)}`;
    } else if (config.autocomplete.components) {
        url += `&components=${config.autocomplete.components}`;
    }

    if (config.autocomplete.strictbounds) {
        url += `&strictbounds=true`;
    }

    return url;
};