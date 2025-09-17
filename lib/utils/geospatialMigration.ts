/**
 * Database Migration Script for Location-Based Event Recommendations
 * 
 * This script adds geospatial coordinates to existing events and sets up
 * the necessary database indexes for proximity-based queries.
 */

import { databases } from '@/lib/appwrite/appwrite';
import { Event } from '@/lib/types/Events';
import { geocodeLocation } from '@/lib/utils/locationUtils';
import { Query } from 'react-native-appwrite';

const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!;
const EVENTS_COLLECTION_ID = 'events'; // Replace with your actual collection ID

interface MigrationStats {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
}

/**
 * Migrate all events to include geospatial coordinates
 */
export async function migrateEventsToGeospatial(): Promise<MigrationStats> {
    const stats: MigrationStats = {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0
    };

    console.log('🚀 Starting geospatial migration for events...');

    try {
        // Get total count first
        const countResponse = await databases.listDocuments(
            DATABASE_ID,
            EVENTS_COLLECTION_ID,
            [Query.limit(1)]
        );

        // For accurate count, we'd need to query all and count
        // This is a simplified approach
        let offset = 0;
        const batchSize = 25;
        let hasMore = true;

        while (hasMore) {
            console.log(`📦 Processing batch starting at offset ${offset}...`);

            // Get batch of events
            const response = await databases.listDocuments(
                DATABASE_ID,
                EVENTS_COLLECTION_ID,
                [
                    Query.limit(batchSize),
                    Query.offset(offset)
                ]
            );

            const events = response.documents as unknown as Event[];

            if (events.length === 0) {
                hasMore = false;
                break;
            }

            stats.total += events.length;

            // Process each event in the batch
            for (const event of events) {
                stats.processed++;

                try {
                    // Skip if already has coordinates
                    if (event.locationLat && event.locationLng) {
                        console.log(`⏭️  Event ${event.$id} already has coordinates, skipping`);
                        stats.skipped++;
                        continue;
                    }

                    // Skip if no location string
                    if (!event.location || event.location.trim() === '') {
                        console.log(`⚠️  Event ${event.$id} has no location string, skipping`);
                        stats.skipped++;
                        continue;
                    }

                    // Geocode the location
                    const coordinates = await geocodeLocation(event.location);

                    if (!coordinates) {
                        console.log(`❌ Could not geocode location "${event.location}" for event ${event.$id}`);
                        stats.failed++;
                        continue;
                    }

                    // Update the event with coordinates
                    await databases.updateDocument(
                        DATABASE_ID,
                        EVENTS_COLLECTION_ID,
                        event.$id,
                        {
                            locationLat: coordinates.latitude,
                            locationLng: coordinates.longitude,
                        }
                    );

                    console.log(`✅ Updated event ${event.$id}: ${coordinates.latitude}, ${coordinates.longitude}`);
                    stats.successful++;

                    // Rate limiting to avoid overwhelming the geocoding service
                    await new Promise(resolve => setTimeout(resolve, 200));

                } catch (error) {
                    console.error(`❌ Failed to process event ${event.$id}:`, error);
                    stats.failed++;
                }
            }

            offset += batchSize;

            // Optional: Add a longer pause between batches
            if (hasMore) {
                console.log(`⏳ Pausing before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log('🎉 Geospatial migration completed!');
        console.log('📊 Migration Statistics:', {
            total: stats.total,
            processed: stats.processed,
            successful: stats.successful,
            failed: stats.failed,
            skipped: stats.skipped,
            successRate: `${((stats.successful / stats.processed) * 100).toFixed(1)}%`
        });

        return stats;

    } catch (error) {
        console.error('💥 Migration failed:', error);
        throw error;
    }
}

/**
 * Migrate a single event's coordinates (for testing or individual updates)
 */
export async function migrateEventCoordinates(eventId: string): Promise<boolean> {
    try {
        // Get the event
        const event = await databases.getDocument(
            DATABASE_ID,
            EVENTS_COLLECTION_ID,
            eventId
        ) as unknown as Event;

        // Skip if already has coordinates
        if (event.locationLat && event.locationLng) {
            console.log(`Event ${eventId} already has coordinates`);
            return true;
        }

        // Skip if no location string
        if (!event.location || event.location.trim() === '') {
            console.log(`Event ${eventId} has no location string`);
            return false;
        }

        // Geocode the location
        const coordinates = await geocodeLocation(event.location);

        if (!coordinates) {
            console.log(`Could not geocode location "${event.location}" for event ${eventId}`);
            return false;
        }

        // Update the event with coordinates
        await databases.updateDocument(
            DATABASE_ID,
            EVENTS_COLLECTION_ID,
            eventId,
            {
                locationLat: coordinates.latitude,
                locationLng: coordinates.longitude,
            }
        );

        console.log(`Updated event ${eventId}: ${coordinates.latitude}, ${coordinates.longitude}`);
        return true;

    } catch (error) {
        console.error(`Failed to migrate coordinates for event ${eventId}:`, error);
        return false;
    }
}

/**
 * Validate migration results
 */
export async function validateGeospatialMigration(): Promise<{
    totalEvents: number;
    eventsWithCoordinates: number;
    eventsWithoutCoordinates: number;
    migrationCompleteness: number;
}> {
    try {
        console.log('🔍 Validating geospatial migration...');

        let totalEvents = 0;
        let eventsWithCoordinates = 0;
        let offset = 0;
        const batchSize = 100;
        let hasMore = true;

        while (hasMore) {
            const response = await databases.listDocuments(
                DATABASE_ID,
                EVENTS_COLLECTION_ID,
                [
                    Query.limit(batchSize),
                    Query.offset(offset)
                ]
            );

            const events = response.documents as unknown as Event[];

            if (events.length === 0) {
                hasMore = false;
                break;
            }

            totalEvents += events.length;

            for (const event of events) {
                if (event.locationLat && event.locationLng) {
                    eventsWithCoordinates++;
                }
            }

            offset += batchSize;
        }

        const eventsWithoutCoordinates = totalEvents - eventsWithCoordinates;
        const migrationCompleteness = totalEvents > 0 ? (eventsWithCoordinates / totalEvents) * 100 : 0;

        const results = {
            totalEvents,
            eventsWithCoordinates,
            eventsWithoutCoordinates,
            migrationCompleteness
        };

        console.log('📈 Migration Validation Results:', {
            ...results,
            completenessPercentage: `${migrationCompleteness.toFixed(1)}%`
        });

        return results;

    } catch (error) {
        console.error('Failed to validate migration:', error);
        throw error;
    }
}

/**
 * CLI-style migration runner
 */
export async function runGeospatialMigration(): Promise<void> {
    try {
        console.log('🎯 Location-Based Event Recommendations Migration');
        console.log('================================================');

        // Step 1: Validate current state
        console.log('\n📊 Step 1: Checking current migration state...');
        const preValidation = await validateGeospatialMigration();

        if (preValidation.migrationCompleteness >= 95) {
            console.log('✅ Migration appears to be already complete!');
            return;
        }

        // Step 2: Run migration
        console.log('\n🚀 Step 2: Running geospatial migration...');
        const migrationStats = await migrateEventsToGeospatial();

        // Step 3: Post-migration validation
        console.log('\n✅ Step 3: Validating migration results...');
        const postValidation = await validateGeospatialMigration();

        // Step 4: Summary
        console.log('\n🎉 Migration Summary');
        console.log('===================');
        console.log(`Events processed: ${migrationStats.processed}`);
        console.log(`Events updated: ${migrationStats.successful}`);
        console.log(`Events failed: ${migrationStats.failed}`);
        console.log(`Events skipped: ${migrationStats.skipped}`);
        console.log(`Final completeness: ${postValidation.migrationCompleteness.toFixed(1)}%`);

        if (postValidation.migrationCompleteness >= 95) {
            console.log('🎊 Migration completed successfully!');
        } else {
            console.log('⚠️  Migration completed with some issues. Consider re-running for failed events.');
        }

    } catch (error) {
        console.error('💥 Migration failed:', error);
        throw error;
    }
}

export default {
    migrateEventsToGeospatial,
    migrateEventCoordinates,
    validateGeospatialMigration,
    runGeospatialMigration
};
