/**
 * Hybrid location service combining free OSM with selective Google Places usage
 */

import { getUserLocation } from '@/lib/utils/distanceUtils';

interface LocationSuggestion {
    id: string;
    name: string;
    address: string;
    coordinates?: { lat: number; lng: number };
    source: 'osm' | 'google' | 'cache';
    distance?: number;
    type: string;
}

class HybridLocationService {
    private userLocation: { lat: number; lng: number } | null = null;

    // Popular locations cache (free, no API calls)
    private popularLocations = [
        // Major cities
        { name: "Sydney CBD", address: "Sydney NSW, Australia", lat: -33.8688, lng: 151.2093, type: "locality" },
        { name: "Melbourne CBD", address: "Melbourne VIC, Australia", lat: -37.8136, lng: 144.9631, type: "locality" },
        { name: "Brisbane City", address: "Brisbane QLD, Australia", lat: -27.4698, lng: 153.0251, type: "locality" },

        // Popular venues (crowd-sourced database - free)
        { name: "Sydney Opera House", address: "Bennelong Point, Sydney NSW", lat: -33.8568, lng: 151.2153, type: "establishment" },
        { name: "Federation Square", address: "Flinders St, Melbourne VIC", lat: -37.8179, lng: 144.9690, type: "establishment" },
        { name: "South Bank Parklands", address: "South Brisbane QLD", lat: -27.4745, lng: 153.0187, type: "establishment" },

        // Common venue types
        { name: "Local Restaurant", address: "Search restaurants near you", lat: 0, lng: 0, type: "restaurant" },
        { name: "Coffee Shop", address: "Find nearby cafes", lat: 0, lng: 0, type: "cafe" },
        { name: "Park", address: "Local parks and recreation", lat: 0, lng: 0, type: "park" },
        { name: "Shopping Center", address: "Nearby shopping centers", lat: 0, lng: 0, type: "shopping" }
    ];

    async getLocationSuggestions(
        query: string,
        useGoogleFallback: boolean = true
    ): Promise<LocationSuggestion[]> {
        const suggestions: LocationSuggestion[] = [];

        // 1. Search local cache first (FREE)
        const localResults = this.searchLocalCache(query);
        suggestions.push(...localResults);

        // 2. Try OpenStreetMap Nominatim (FREE)
        try {
            const osmResults = await this.searchOpenStreetMap(query);
            suggestions.push(...osmResults);
        } catch (error) {
            console.warn('OSM search failed:', error);
        }

        // 3. Use Google Places only as fallback (PAID)
        if (suggestions.length < 3 && useGoogleFallback) {
            try {
                const googleResults = await this.searchGooglePlaces(query);
                suggestions.push(...googleResults);
            } catch (error) {
                console.warn('Google Places fallback failed:', error);
            }
        }

        // 4. Sort by relevance and distance
        return this.rankResults(suggestions, query);
    }

    private searchLocalCache(query: string): LocationSuggestion[] {
        const queryLower = query.toLowerCase();

        return this.popularLocations
            .filter(location =>
                location.name.toLowerCase().includes(queryLower) ||
                location.address.toLowerCase().includes(queryLower) ||
                location.type.includes(queryLower)
            )
            .map((location, index) => ({
                id: `cache-${index}`,
                name: location.name,
                address: location.address,
                coordinates: { lat: location.lat, lng: location.lng },
                source: 'cache' as const,
                distance: this.calculateDistance(location.lat, location.lng),
                type: location.type
            }))
            .slice(0, 3);
    }

    private async searchOpenStreetMap(query: string): Promise<LocationSuggestion[]> {
        // Add location bias for better results
        let url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;

        if (this.userLocation) {
            url += `&lat=${this.userLocation.lat}&lon=${this.userLocation.lng}&bounded=1&viewbox=${this.generateViewBox()}`;
        } else {
            // Default to Australia if no user location
            url += `&countrycodes=au`;
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Up2YouApp/1.0 (contact@up2you.app)' // Required by OSM
            }
        });

        if (!response.ok) {
            throw new Error(`OSM API error: ${response.status}`);
        }

        const results = await response.json();

        return results.slice(0, 3).map((result: any, index: number) => ({
            id: `osm-${result.osm_id || index}`,
            name: result.display_name.split(',')[0], // First part is usually the venue name
            address: result.display_name,
            coordinates: {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon)
            },
            source: 'osm' as const,
            distance: this.calculateDistance(parseFloat(result.lat), parseFloat(result.lon)),
            type: this.mapOSMType(result.type || result.class || 'establishment')
        }));
    }

    private async searchGooglePlaces(query: string): Promise<LocationSuggestion[]> {
        // Only use Google Places for high-value searches
        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
        if (!apiKey) return [];

        const sessionToken = this.generateSessionToken();

        let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
            `input=${encodeURIComponent(query)}` +
            `&types=establishment` +
            `&language=en` +
            `&sessiontoken=${sessionToken}` +
            `&key=${apiKey}`;

        // Add location bias if available
        if (this.userLocation) {
            const bias = `circle:50000@${this.userLocation.lat},${this.userLocation.lng}`;
            url += `&locationbias=${encodeURIComponent(bias)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK') {
            throw new Error(`Google Places error: ${data.status}`);
        }

        return data.predictions.slice(0, 2).map((prediction: any, index: number) => ({
            id: `google-${prediction.place_id}`,
            name: prediction.structured_formatting?.main_text || prediction.description,
            address: prediction.description,
            source: 'google' as const,
            type: this.mapGoogleType(prediction.types?.[0] || 'establishment')
        }));
    }

    private rankResults(suggestions: LocationSuggestion[], query: string): LocationSuggestion[] {
        const queryLower = query.toLowerCase();

        return suggestions
            .map(suggestion => ({
                ...suggestion,
                relevanceScore: this.calculateRelevanceScore(suggestion, queryLower)
            }))
            .sort((a, b) => {
                // Prioritize: cache > distance > google > osm
                if (a.source === 'cache' && b.source !== 'cache') return -1;
                if (b.source === 'cache' && a.source !== 'cache') return 1;

                // Then by distance if available
                if (a.distance && b.distance) {
                    return a.distance - b.distance;
                }

                // Then by relevance score
                return (b as any).relevanceScore - (a as any).relevanceScore;
            })
            .slice(0, 5);
    }

    private calculateRelevanceScore(suggestion: LocationSuggestion, query: string): number {
        let score = 0;
        const name = suggestion.name.toLowerCase();
        const address = suggestion.address.toLowerCase();

        // Exact name match
        if (name === query) score += 100;
        else if (name.includes(query)) score += 50;

        // Address match
        if (address.includes(query)) score += 20;

        // Type relevance
        if (suggestion.type === query) score += 30;

        // Distance bonus (closer is better)
        if (suggestion.distance) {
            score += Math.max(0, 20 - suggestion.distance);
        }

        return score;
    }

    private calculateDistance(lat: number, lng: number): number | undefined {
        if (!this.userLocation) return undefined;

        const R = 6371; // Earth's radius in km
        const dLat = (lat - this.userLocation.lat) * Math.PI / 180;
        const dLng = (lng - this.userLocation.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.userLocation.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private generateViewBox(): string {
        if (!this.userLocation) return '';
        const buffer = 0.1; // ~11km radius
        return `${this.userLocation.lng - buffer},${this.userLocation.lat + buffer},${this.userLocation.lng + buffer},${this.userLocation.lat - buffer}`;
    }

    private generateSessionToken(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    private mapOSMType(osmType: string): string {
        const typeMap: { [key: string]: string } = {
            'amenity': 'establishment',
            'restaurant': 'restaurant',
            'cafe': 'cafe',
            'pub': 'bar',
            'shop': 'store',
            'tourism': 'tourist_attraction',
            'leisure': 'park'
        };
        return typeMap[osmType] || 'establishment';
    }

    private mapGoogleType(googleType: string): string {
        return googleType || 'establishment';
    }

    async initializeUserLocation(): Promise<void> {
        try {
            const location = await getUserLocation();
            if (location) {
                this.userLocation = {
                    lat: location.latitude,
                    lng: location.longitude
                };
            }
        } catch (error) {
            console.warn('Could not initialize user location:', error);
        }
    }
}

export const hybridLocationService = new HybridLocationService();