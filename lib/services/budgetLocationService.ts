// Free location service using OpenStreetMap Nominatim API
// No API key required, completely free to use

export interface FreeLocationSuggestion {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    type: string;
    icon: string;
}

class BudgetLocationService {
    private cache = new Map<string, FreeLocationSuggestion[]>();
    private requestQueue = new Map<string, Promise<FreeLocationSuggestion[]>>();

    async searchLocations(query: string): Promise<FreeLocationSuggestion[]> {
        if (query.length < 2) return [];

        // Check cache first (saves API calls)
        const cacheKey = query.toLowerCase().trim();
        if (this.cache.has(cacheKey)) {
            console.log('Using cached results for:', query);
            return this.cache.get(cacheKey) || [];
        }

        // Prevent duplicate requests for same query
        if (this.requestQueue.has(cacheKey)) {
            return this.requestQueue.get(cacheKey) || [];
        }

        const searchPromise = this.performSearch(query, cacheKey);
        this.requestQueue.set(cacheKey, searchPromise);

        try {
            const results = await searchPromise;
            this.requestQueue.delete(cacheKey);
            return results;
        } catch (error) {
            this.requestQueue.delete(cacheKey);
            throw error;
        }
    }

    private async performSearch(query: string, cacheKey: string): Promise<FreeLocationSuggestion[]> {
        try {
            // Using Nominatim (OpenStreetMap) - completely FREE
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                `q=${encodeURIComponent(query)}&` +
                `format=json&` +
                `limit=5&` +
                `countrycodes=us,ca,gb,au,nz&` +
                `addressdetails=1&` +
                `extratags=1&` +
                `bounded=0&` +
                `dedupe=1`,
                {
                    headers: {
                        'User-Agent': 'Up2-App/1.0 (Event Location Search)',
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();

            const suggestions: FreeLocationSuggestion[] = data
                .filter((item: any) => item.lat && item.lon && item.display_name)
                .map((item: any) => ({
                    id: item.place_id?.toString() || item.osm_id?.toString() || Math.random().toString(),
                    name: this.extractLocationName(item),
                    address: item.display_name,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                    type: this.determineLocationType(item),
                    icon: this.getLocationIcon(item)
                }))
                .slice(0, 5);

            // Cache results for 24 hours
            this.cache.set(cacheKey, suggestions);
            setTimeout(() => this.cache.delete(cacheKey), 24 * 60 * 60 * 1000);

            console.log(`Found ${suggestions.length} free location suggestions for: ${query}`);
            return suggestions;

        } catch (error) {
            console.error('Free location search error:', error);

            // Return fallback local suggestions
            return this.getFallbackSuggestions(query);
        }
    }

    private extractLocationName(item: any): string {
        // Priority: shop/amenity name → address components → display name
        if (item.name) return item.name;
        if (item.address?.shop) return item.address.shop;
        if (item.address?.amenity) return item.address.amenity;
        if (item.address?.house_number && item.address?.road) {
            return `${item.address.house_number} ${item.address.road}`;
        }
        if (item.address?.road) return item.address.road;

        // Fallback to first part of display name
        const parts = item.display_name.split(',');
        return parts[0].trim();
    }

    private determineLocationType(item: any): string {
        const type = item.type || item.class;
        const amenity = item.address?.amenity;
        const shop = item.address?.shop;

        if (amenity) return amenity;
        if (shop) return 'shop';
        if (type === 'building') return 'building';
        if (type === 'highway') return 'address';
        return type || 'place';
    }

    private getLocationIcon(item: any): string {
        const amenity = item.address?.amenity;
        const shop = item.address?.shop;
        const type = item.type;

        // Restaurant and food
        if (['restaurant', 'fast_food', 'cafe', 'bar', 'pub'].includes(amenity)) return 'restaurant';
        if (amenity === 'cafe' || shop === 'bakery') return 'local-cafe';

        // Accommodation
        if (['hotel', 'motel', 'hostel', 'guest_house'].includes(amenity)) return 'hotel';

        // Shopping
        if (shop || amenity === 'marketplace') return 'shopping-cart';
        if (['mall', 'department_store'].includes(shop)) return 'shopping-cart';

        // Health and services
        if (['hospital', 'clinic', 'pharmacy', 'dentist'].includes(amenity)) return 'local-hospital';
        if (['school', 'university', 'college', 'library'].includes(amenity)) return 'school';
        if (['gym', 'fitness_centre'].includes(amenity)) return 'fitness-center';

        // Entertainment and culture
        if (['cinema', 'theatre', 'museum', 'arts_centre'].includes(amenity)) return 'movie';
        if (['park', 'playground', 'garden'].includes(amenity)) return 'park';

        // Transport
        if (['fuel', 'charging_station'].includes(amenity)) return 'local-gas-station';
        if (['bus_station', 'taxi'].includes(amenity)) return 'directions-bus';

        // Religious and community
        if (['place_of_worship', 'community_centre'].includes(amenity)) return 'account-balance';

        // Financial
        if (['bank', 'atm'].includes(amenity)) return 'account-balance-wallet';

        // Default icons by type
        if (type === 'building' || amenity === 'building') return 'business';
        if (type === 'highway') return 'home';

        return 'place';
    }

    private getFallbackSuggestions(query: string): FreeLocationSuggestion[] {
        // Local popular venue types as fallback
        const fallbackTypes = [
            { name: `${query} Restaurant`, type: 'restaurant', icon: 'restaurant' },
            { name: `${query} Coffee Shop`, type: 'cafe', icon: 'local-cafe' },
            { name: `${query} Park`, type: 'park', icon: 'park' },
            { name: `${query} Community Center`, type: 'community', icon: 'business' },
            { name: `${query} Library`, type: 'library', icon: 'school' }
        ];

        return fallbackTypes.map((item, index) => ({
            id: `fallback-${index}`,
            name: item.name,
            address: `${item.name} (Search nearby)`,
            lat: 0,
            lng: 0,
            type: item.type,
            icon: item.icon
        }));
    }

    // Clear cache manually if needed
    clearCache(): void {
        this.cache.clear();
        console.log('Location cache cleared');
    }

    // Get cache stats for debugging
    getCacheStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

export const budgetLocationService = new BudgetLocationService();
