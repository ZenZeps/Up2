/**
 * 100% FREE Location Service - No API costs, no Google dependency
 * Uses OpenStreetMap Nominatim + Local Cache + Crowd-sourced data
 */

import { getUserLocation } from '@/lib/utils/distanceUtils';

interface LocationSuggestion {
    id: string;
    name: string;
    address: string;
    coordinates?: { lat: number; lng: number };
    source: 'cache' | 'osm' | 'local';
    distance?: number;
    type: string;
    popularity?: number;
}

class FreeLocationService {
    private userLocation: { lat: number; lng: number } | null = null;

    // Comprehensive FREE location database
    private freeLocationDatabase = [
        // Major Australian Cities (FREE)
        { name: "Sydney CBD", address: "Sydney, New South Wales, Australia", lat: -33.8688, lng: 151.2093, type: "locality", popularity: 100 },
        { name: "Melbourne CBD", address: "Melbourne, Victoria, Australia", lat: -37.8136, lng: 144.9631, type: "locality", popularity: 95 },
        { name: "Brisbane City", address: "Brisbane, Queensland, Australia", lat: -27.4698, lng: 153.0251, type: "locality", popularity: 90 },
        { name: "Perth CBD", address: "Perth, Western Australia, Australia", lat: -31.9505, lng: 115.8605, type: "locality", popularity: 85 },
        { name: "Adelaide CBD", address: "Adelaide, South Australia, Australia", lat: -34.9285, lng: 138.6007, type: "locality", popularity: 80 },
        { name: "Canberra City", address: "Canberra, Australian Capital Territory, Australia", lat: -35.2809, lng: 149.1300, type: "locality", popularity: 75 },
        { name: "Darwin City", address: "Darwin, Northern Territory, Australia", lat: -12.4634, lng: 130.8456, type: "locality", popularity: 70 },
        { name: "Hobart CBD", address: "Hobart, Tasmania, Australia", lat: -42.8821, lng: 147.3272, type: "locality", popularity: 65 },

        // Popular Australian Venues (Crowd-sourced data - FREE)
        { name: "Sydney Opera House", address: "Bennelong Point, Sydney NSW 2000, Australia", lat: -33.8568, lng: 151.2153, type: "establishment", popularity: 100 },
        { name: "Sydney Harbour Bridge", address: "Sydney Harbour Bridge, Sydney NSW, Australia", lat: -33.8523, lng: 151.2108, type: "establishment", popularity: 95 },
        { name: "Federation Square", address: "Flinders St, Melbourne VIC 3000, Australia", lat: -37.8179, lng: 144.9690, type: "establishment", popularity: 90 },
        { name: "Royal Botanic Gardens Sydney", address: "Mrs Macquaries Rd, Sydney NSW 2000, Australia", lat: -33.8641, lng: 151.2166, type: "park", popularity: 85 },
        { name: "Queen Victoria Market", address: "Queen St, Melbourne VIC 3000, Australia", lat: -37.8076, lng: 144.9568, type: "establishment", popularity: 80 },
        { name: "South Bank Parklands", address: "South Brisbane QLD 4101, Australia", lat: -27.4745, lng: 153.0187, type: "park", popularity: 75 },
        { name: "Bondi Beach", address: "Bondi Beach NSW 2026, Australia", lat: -33.8915, lng: 151.2767, type: "establishment", popularity: 95 },
        { name: "Uluru", address: "Uluru NT 0872, Australia", lat: -25.3444, lng: 131.0369, type: "establishment", popularity: 90 },
        { name: "Great Ocean Road", address: "Great Ocean Road, Victoria, Australia", lat: -38.6857, lng: 143.1189, type: "establishment", popularity: 85 },
        { name: "Blue Mountains", address: "Blue Mountains NSW, Australia", lat: -33.7969, lng: 150.3059, type: "establishment", popularity: 80 },

        // Common venue types (Template suggestions - FREE)
        { name: "Local Restaurant", address: "Find restaurants in your area", lat: 0, lng: 0, type: "restaurant", popularity: 60 },
        { name: "Coffee Shop", address: "Discover nearby cafes", lat: 0, lng: 0, type: "cafe", popularity: 65 },
        { name: "Bar & Lounge", address: "Popular bars and lounges", lat: 0, lng: 0, type: "bar", popularity: 55 },
        { name: "Shopping Center", address: "Local shopping destinations", lat: 0, lng: 0, type: "shopping", popularity: 70 },
        { name: "Public Park", address: "Parks and outdoor spaces", lat: 0, lng: 0, type: "park", popularity: 50 },
        { name: "Community Center", address: "Local community venues", lat: 0, lng: 0, type: "establishment", popularity: 45 },
        { name: "Sports Club", address: "Sports and recreation venues", lat: 0, lng: 0, type: "establishment", popularity: 55 },
        { name: "Beach", address: "Coastal locations and beaches", lat: 0, lng: 0, type: "establishment", popularity: 75 },
        { name: "Library", address: "Public libraries", lat: 0, lng: 0, type: "establishment", popularity: 40 },
        { name: "Museum", address: "Museums and galleries", lat: 0, lng: 0, type: "establishment", popularity: 50 },

        // International Popular Cities (FREE)
        { name: "New York City", address: "New York, NY, USA", lat: 40.7128, lng: -74.0060, type: "locality", popularity: 100 },
        { name: "Los Angeles", address: "Los Angeles, CA, USA", lat: 34.0522, lng: -118.2437, type: "locality", popularity: 95 },
        { name: "London", address: "London, United Kingdom", lat: 51.5074, lng: -0.1278, type: "locality", popularity: 100 },
        { name: "Paris", address: "Paris, France", lat: 48.8566, lng: 2.3522, type: "locality", popularity: 95 },
        { name: "Tokyo", address: "Tokyo, Japan", lat: 35.6762, lng: 139.6503, type: "locality", popularity: 90 },
        { name: "Dubai", address: "Dubai, United Arab Emirates", lat: 25.2048, lng: 55.2708, type: "locality", popularity: 85 },
        { name: "Singapore", address: "Singapore", lat: 1.3521, lng: 103.8198, type: "locality", popularity: 80 },
        { name: "Hong Kong", address: "Hong Kong", lat: 22.3193, lng: 114.1694, type: "locality", popularity: 85 },
    ];

    async getLocationSuggestions(query: string): Promise<LocationSuggestion[]> {
        const suggestions: LocationSuggestion[] = [];

        console.log(`🆓 FREE Search for: "${query}"`);

        // 1. Search local database first (INSTANT + FREE)
        const localResults = this.searchLocalDatabase(query);
        suggestions.push(...localResults);

        // 2. Search OpenStreetMap Nominatim (FREE API)
        try {
            const osmResults = await this.searchOpenStreetMap(query);
            // Merge and deduplicate with local results
            const uniqueOSMResults = osmResults.filter(osm =>
                !suggestions.some(local =>
                    this.calculateSimilarity(osm.name.toLowerCase(), local.name.toLowerCase()) > 0.8
                )
            );
            suggestions.push(...uniqueOSMResults.slice(0, 3)); // Limit OSM to 3 results
        } catch (error) {
            console.warn('OSM search failed, using local results only:', error);
        }

        // 3. Sort by relevance, popularity, and distance
        return this.rankResults(suggestions, query);
    }

    private searchLocalDatabase(query: string): LocationSuggestion[] {
        const queryLower = query.toLowerCase().trim();

        return this.freeLocationDatabase
            .filter(location => {
                // Multi-field fuzzy matching
                const nameMatch = location.name.toLowerCase().includes(queryLower);
                const addressMatch = location.address.toLowerCase().includes(queryLower);
                const typeMatch = location.type.toLowerCase().includes(queryLower);

                // Fuzzy matching for typos
                const nameSimilarity = this.calculateSimilarity(queryLower, location.name.toLowerCase());
                const addressSimilarity = this.calculateSimilarity(queryLower, location.address.toLowerCase());

                return nameMatch || addressMatch || typeMatch || nameSimilarity > 0.6 || addressSimilarity > 0.5;
            })
            .map((location, index) => ({
                id: `local-${index}`,
                name: location.name,
                address: location.address,
                coordinates: location.lat !== 0 && location.lng !== 0 ? { lat: location.lat, lng: location.lng } : undefined,
                source: 'cache' as const,
                distance: this.calculateDistance(location.lat, location.lng),
                type: location.type,
                popularity: location.popularity || 50
            }))
            .slice(0, 5); // Limit local results
    }

    private async searchOpenStreetMap(query: string): Promise<LocationSuggestion[]> {
        // Optimized OSM Nominatim API call (FREE)
        let url = `https://nominatim.openstreetmap.org/search?` +
            `format=json` +
            `&addressdetails=1` +
            `&limit=8` +
            `&dedupe=1` +
            `&q=${encodeURIComponent(query)}`;

        // Add location bias if available
        if (this.userLocation) {
            const bias = `&lat=${this.userLocation.lat}&lon=${this.userLocation.lng}&bounded=1`;
            url += bias;
            // Create viewbox for better local results (50km radius)
            const buffer = 0.45; // ~50km
            url += `&viewbox=${this.userLocation.lng - buffer},${this.userLocation.lat + buffer},${this.userLocation.lng + buffer},${this.userLocation.lat - buffer}`;
        } else {
            // Default to Australia/English-speaking countries
            url += `&countrycodes=au,us,gb,ca,nz`;
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Up2YouApp/1.0 (events@up2you.app)' // Required by OSM
            },
            timeout: 5000 // 5 second timeout
        } as any);

        if (!response.ok) {
            throw new Error(`OSM API error: ${response.status}`);
        }

        const results = await response.json();

        return results
            .filter((result: any) => {
                // Quality filtering for better results
                const hasDisplayName = result.display_name && result.display_name.length > 5;
                const hasCoordinates = result.lat && result.lon;
                const notTooGeneric = !result.display_name?.toLowerCase().includes('unnamed');

                return hasDisplayName && hasCoordinates && notTooGeneric;
            })
            .slice(0, 5)
            .map((result: any, index: number) => {
                const mainName = this.extractMainName(result.display_name);

                return {
                    id: `osm-${result.osm_id || index}`,
                    name: mainName,
                    address: result.display_name,
                    coordinates: {
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lon)
                    },
                    source: 'osm' as const,
                    distance: this.calculateDistance(parseFloat(result.lat), parseFloat(result.lon)),
                    type: this.mapOSMType(result.type || result.class || 'establishment'),
                    popularity: this.estimatePopularity(result)
                };
            });
    }

    private extractMainName(displayName: string): string {
        // Extract the most relevant part of OSM display name
        const parts = displayName.split(',');

        // If first part is a number (street address), use first two parts
        if (parts[0] && /^\d/.test(parts[0].trim())) {
            return parts.slice(0, 2).join(',').trim();
        }

        // Otherwise use the first part (venue/place name)
        return parts[0]?.trim() || displayName;
    }

    private estimatePopularity(osmResult: any): number {
        // Estimate popularity based on OSM data
        let score = 30; // Base score

        // Higher score for establishments vs addresses
        if (osmResult.class === 'amenity' || osmResult.class === 'tourism') score += 20;
        if (osmResult.class === 'place' && osmResult.type === 'city') score += 30;
        if (osmResult.class === 'place' && osmResult.type === 'town') score += 15;

        // Boost known categories
        const popularTypes = ['restaurant', 'cafe', 'pub', 'hotel', 'attraction', 'museum'];
        if (popularTypes.includes(osmResult.type)) score += 15;

        return Math.min(score, 100);
    }

    private rankResults(suggestions: LocationSuggestion[], query: string): LocationSuggestion[] {
        const queryLower = query.toLowerCase();

        return suggestions
            .map(suggestion => ({
                ...suggestion,
                relevanceScore: this.calculateRelevanceScore(suggestion, queryLower)
            }))
            .sort((a, b) => {
                // 1. Exact name matches first
                const aExact = a.name.toLowerCase() === queryLower ? 1000 : 0;
                const bExact = b.name.toLowerCase() === queryLower ? 1000 : 0;
                if (aExact !== bExact) return bExact - aExact;

                // 2. High popularity cached items
                if (a.source === 'cache' && (a.popularity || 0) > 80 && b.source !== 'cache') return -1;
                if (b.source === 'cache' && (b.popularity || 0) > 80 && a.source !== 'cache') return 1;

                // 3. Distance (closer is better)
                if (a.distance && b.distance) {
                    const distanceDiff = a.distance - b.distance;
                    if (Math.abs(distanceDiff) > 5) return distanceDiff; // 5km threshold
                }

                // 4. Combined relevance score
                return (b as any).relevanceScore - (a as any).relevanceScore;
            })
            .slice(0, 6); // Top 6 results
    }

    private calculateRelevanceScore(suggestion: LocationSuggestion, query: string): number {
        let score = 0;
        const name = suggestion.name.toLowerCase();
        const address = suggestion.address.toLowerCase();

        // Exact matches
        if (name === query) score += 100;
        else if (name.startsWith(query)) score += 80;
        else if (name.includes(query)) score += 60;

        // Address relevance
        if (address.includes(query)) score += 30;

        // Type relevance
        if (suggestion.type === query) score += 40;

        // Popularity boost
        score += (suggestion.popularity || 0) * 0.3;

        // Distance penalty (further = lower score)
        if (suggestion.distance) {
            score += Math.max(0, 50 - suggestion.distance * 2);
        }

        // Source preference (cached is reliable)
        if (suggestion.source === 'cache') score += 10;

        return score;
    }

    private calculateSimilarity(str1: string, str2: string): number {
        // Simple Levenshtein distance similarity
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 1;

        const distance = this.levenshteinDistance(str1, str2);
        return (maxLength - distance) / maxLength;
    }

    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1, // deletion
                    matrix[j - 1][i] + 1, // insertion
                    matrix[j - 1][i - 1] + substitutionCost // substitution
                );
            }
        }

        return matrix[str2.length][str1.length];
    }

    private calculateDistance(lat: number, lng: number): number | undefined {
        if (!this.userLocation || lat === 0 || lng === 0) return undefined;

        const R = 6371; // Earth's radius in km
        const dLat = (lat - this.userLocation.lat) * Math.PI / 180;
        const dLng = (lng - this.userLocation.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.userLocation.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private mapOSMType(osmType: string): string {
        const typeMap: { [key: string]: string } = {
            'amenity': 'establishment',
            'restaurant': 'restaurant',
            'fast_food': 'restaurant',
            'cafe': 'cafe',
            'pub': 'bar',
            'bar': 'bar',
            'shop': 'store',
            'tourism': 'establishment',
            'attraction': 'establishment',
            'museum': 'establishment',
            'hotel': 'establishment',
            'leisure': 'park',
            'park': 'park',
            'place': 'locality'
        };
        return typeMap[osmType] || 'establishment';
    }

    async initializeUserLocation(): Promise<void> {
        try {
            const location = await getUserLocation();
            if (location) {
                this.userLocation = {
                    lat: location.latitude,
                    lng: location.longitude
                };
                console.log(`📍 FREE service initialized with user location: ${location.latitude}, ${location.longitude}`);
            }
        } catch (error) {
            console.warn('Could not initialize user location for free service:', error);
        }
    }

    // Utility method to add custom locations to the database
    addCustomLocation(location: {
        name: string;
        address: string;
        lat: number;
        lng: number;
        type: string;
        popularity?: number;
    }): void {
        this.freeLocationDatabase.push({
            ...location,
            popularity: location.popularity || 50
        });
    }

    // Method to get location statistics
    getServiceStats(): {
        totalCachedLocations: number;
        lastOSMCall: string;
        userLocationAvailable: boolean;
        estimatedMonthlyCost: number;
    } {
        return {
            totalCachedLocations: this.freeLocationDatabase.length,
            lastOSMCall: 'OSM API calls are always free',
            userLocationAvailable: !!this.userLocation,
            estimatedMonthlyCost: 0 // Always free!
        };
    }
}

export const freeLocationService = new FreeLocationService();