import { databases } from '@/lib/appwrite/appwrite';
import { Event } from '@/lib/types/Events';
import { TravelAnnouncement } from '@/lib/types/Travel';
import { calculateDistance, geocodeLocation, getCurrentUserLocation } from '@/lib/utils/locationUtils';
import { Query } from 'react-native-appwrite';

interface LocationQueryOptions {
    latitude: number;
    longitude: number;
    radiusKm?: number;
    startDate?: string;
    endDate?: string;
    tags?: string[];
    limit?: number;
}

interface TravelDestinationQuery {
    destination: string;
    startDate: string;
    endDate: string;
    radiusKm?: number;
    userId: string;
}

export class LocationEventService {
    private static readonly DEFAULT_RADIUS_KM = 25;
    private static readonly MAX_TRAVEL_RADIUS_KM = 50;
    private static readonly EVENTS_COLLECTION_ID = 'events'; // Replace with actual collection ID

    /**
     * Get events near a specific location with optional date filtering
     */
    static async getEventsNearLocation(options: LocationQueryOptions): Promise<Event[]> {
        const { latitude, longitude, radiusKm = this.DEFAULT_RADIUS_KM, startDate, endDate, tags, limit = 50 } = options;

        try {
            // Check if database is properly configured
            if (!process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID) {
                console.warn('Database ID not configured, returning empty results');
                return [];
            }

            // Build Appwrite query filters
            const queries: string[] = [
                Query.limit(limit),
                Query.orderDesc('popularityScore'),
                // Add geospatial query when database indexes are ready
                // Query.greaterThan('locationLat', latitude - radiusKm/111), // Rough lat degree conversion
                // Query.lessThan('locationLat', latitude + radiusKm/111),
                // Query.greaterThan('locationLng', longitude - radiusKm/111),
                // Query.lessThan('locationLng', longitude + radiusKm/111),
            ];

            // Add date filters if provided
            if (startDate) {
                queries.push(Query.greaterThanEqual('startTime', startDate));
            }
            if (endDate) {
                queries.push(Query.lessThanEqual('endTime', endDate));
            }

            // Add tag filters if provided
            if (tags && tags.length > 0) {
                queries.push(Query.equal('tags', tags));
            }

            // Query events from database
            const response = await databases.listDocuments(
                process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!,
                this.EVENTS_COLLECTION_ID,
                queries
            );

            const events = response.documents as unknown as Event[];

            // Filter by distance and add distance calculation
            const eventsWithDistance = await Promise.all(
                events.map(async (event): Promise<Event | null> => {
                    let eventLat: number, eventLng: number;

                    // Use explicit coordinates if available
                    if (event.locationLat && event.locationLng) {
                        eventLat = event.locationLat;
                        eventLng = event.locationLng;
                    } else {
                        // Fallback to geocoding the location string
                        try {
                            const coords = await geocodeLocation(event.location);
                            if (coords) {
                                eventLat = coords.latitude;
                                eventLng = coords.longitude;
                            } else {
                                return null; // Skip events without valid coordinates
                            }
                        } catch (error) {
                            console.warn(`Failed to geocode location "${event.location}":`, error);
                            return null;
                        }
                    }

                    // Calculate distance
                    const distance = calculateDistance(latitude, longitude, eventLat, eventLng);

                    // Filter by radius
                    if (distance > radiusKm) {
                        return null;
                    }

                    return {
                        ...event,
                        distanceFromUser: distance,
                        locationLat: eventLat,
                        locationLng: eventLng,
                    };
                })
            );

            // Remove null entries and sort by distance
            const validEvents = eventsWithDistance.filter((event): event is Event => event !== null);
            return validEvents.sort((a, b) => (a.distanceFromUser || 0) - (b.distanceFromUser || 0));

        } catch (error) {
            // Handle specific collection not found error
            if (error instanceof Error && error.message.includes('Collection with the requested ID could not be found')) {
                console.warn('Events collection not found in database - location services not yet configured');
                return [];
            }

            console.error('Error fetching events near location:', error);
            return []; // Return empty array instead of throwing
        }
    }

    /**
     * Get events for a travel destination during travel dates
     */
    static async getEventsForTravelDestination(query: TravelDestinationQuery): Promise<Event[]> {
        const { destination, startDate, endDate, radiusKm = this.MAX_TRAVEL_RADIUS_KM, userId } = query;

        try {
            // Geocode the travel destination
            const destinationCoords = await geocodeLocation(destination);
            if (!destinationCoords) {
                throw new Error(`Unable to find coordinates for destination: ${destination}`);
            }

            // Get events near the destination during travel dates
            const events = await this.getEventsNearLocation({
                latitude: destinationCoords.latitude,
                longitude: destinationCoords.longitude,
                radiusKm,
                startDate,
                endDate,
                limit: 100, // More results for travel recommendations
            });

            // Log travel-specific analytics
            console.log(`Found ${events.length} events for travel to ${destination} (${startDate} to ${endDate})`);

            return events;

        } catch (error) {
            console.error('Error fetching events for travel destination:', error);
            throw new Error('Failed to fetch travel destination events');
        }
    }

    /**
     * Get personalized location-based recommendations considering current location and travel plans
     */
    static async getLocationBasedRecommendations(userId: string, limit: number = 20): Promise<Event[]> {
        try {
            // Get user's current location
            const currentLocation = await getCurrentUserLocation();
            let currentLocationEvents: Event[] = [];

            if (currentLocation) {
                currentLocationEvents = await this.getEventsNearLocation({
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    radiusKm: this.DEFAULT_RADIUS_KM,
                    limit: Math.ceil(limit * 0.7), // 70% from current location
                });
            }

            // Get user's travel announcements
            let travelEvents: Event[] = [];
            try {
                if (process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID) {
                    const travelResponse = await databases.listDocuments(
                        process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!,
                        'travel_announcements', // Replace with actual collection ID
                        [
                            Query.equal('userId', userId),
                            Query.greaterThanEqual('endDate', new Date().toISOString()),
                            Query.limit(5)
                        ]
                    );

                    const activeTravel = travelResponse.documents as unknown as TravelAnnouncement[];

                    // Get events for each travel destination
                    for (const travel of activeTravel) {
                        const destinationEvents = await this.getEventsForTravelDestination({
                            destination: travel.destination,
                            startDate: travel.startDate,
                            endDate: travel.endDate,
                            userId,
                        });

                        travelEvents.push(...destinationEvents.slice(0, 5)); // Limit per destination
                    }
                }
            } catch (error) {
                console.warn('Could not fetch travel announcements (collection may not exist):', error);
            }

            // Combine and deduplicate events
            const allEvents = [...currentLocationEvents, ...travelEvents];
            const uniqueEvents = allEvents.filter((event, index, arr) =>
                arr.findIndex(e => e.$id === event.$id) === index
            );

            // Sort by relevance (distance, popularity, date)
            const sortedEvents = uniqueEvents.sort((a, b) => {
                // Prioritize travel events (they have no distanceFromUser or it's for destination)
                const aTravelEvent = !a.distanceFromUser || a.distanceFromUser > this.DEFAULT_RADIUS_KM;
                const bTravelEvent = !b.distanceFromUser || b.distanceFromUser > this.DEFAULT_RADIUS_KM;

                if (aTravelEvent && !bTravelEvent) return -1;
                if (!aTravelEvent && bTravelEvent) return 1;

                // Within same category, sort by popularity and distance
                const aScore = (a.popularityScore || 0) - (a.distanceFromUser || 0) * 0.01;
                const bScore = (b.popularityScore || 0) - (b.distanceFromUser || 0) * 0.01;

                return bScore - aScore;
            });

            return sortedEvents.slice(0, limit);

        } catch (error) {
            console.warn('Location-based recommendations failed, returning empty array:', error);
            return []; // Return empty array instead of throwing
        }
    }

    /**
     * Update event coordinates in database (migration utility)
     */
    static async updateEventCoordinates(eventId: string, location: string): Promise<void> {
        try {
            const coords = await geocodeLocation(location);
            if (!coords) {
                console.warn(`Could not geocode location "${location}" for event ${eventId}`);
                return;
            }

            await databases.updateDocument(
                process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!,
                this.EVENTS_COLLECTION_ID,
                eventId,
                {
                    locationLat: coords.latitude,
                    locationLng: coords.longitude,
                }
            );

            console.log(`Updated coordinates for event ${eventId}: ${coords.latitude}, ${coords.longitude}`);
        } catch (error) {
            console.error(`Failed to update coordinates for event ${eventId}:`, error);
        }
    }

    /**
     * Batch update coordinates for all events (database migration)
     */
    static async migrateAllEventCoordinates(): Promise<void> {
        try {
            console.log('Starting event coordinates migration...');

            let offset = 0;
            const batchSize = 25;
            let hasMore = true;

            while (hasMore) {
                const response = await databases.listDocuments(
                    process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!,
                    this.EVENTS_COLLECTION_ID,
                    [
                        Query.limit(batchSize),
                        Query.offset(offset),
                        Query.isNull('locationLat'), // Only update events without coordinates
                    ]
                );

                const events = response.documents as unknown as Event[];

                if (events.length === 0) {
                    hasMore = false;
                    break;
                }

                // Process batch
                await Promise.all(
                    events.map(event =>
                        this.updateEventCoordinates(event.$id, event.location)
                    )
                );

                console.log(`Processed ${offset + events.length} events...`);
                offset += batchSize;

                // Rate limiting to avoid overwhelming the geocoding service
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log('Event coordinates migration completed!');
        } catch (error) {
            console.error('Migration failed:', error);
            throw error;
        }
    }
}

export default LocationEventService;
