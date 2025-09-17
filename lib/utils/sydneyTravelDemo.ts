/**
 * Sydney Travel Demo Script
 * 
 * Demonstrates the location-based recommendation system with the user's example:
 * "If the user decides that they are travelling to Sydney from the 24th to 30th 
 * of November, they should be able to find events that are close to that location 
 * occurring on those dates."
 */

import { generateEnhancedTopPicks, getTravelRecommendations } from '@/lib/services/enhancedTopPicks';
import LocationEventService from '@/lib/services/locationEventService';
import { validateGeospatialMigration } from '@/lib/utils/geospatialMigration';

export interface SydneyTravelDemo {
    destination: string;
    startDate: string;
    endDate: string;
    userId: string;
}

/**
 * Demo the Sydney travel scenario
 */
export async function runSydneyTravelDemo(userId: string): Promise<void> {
    console.log('🏙️  Sydney Travel Demo');
    console.log('======================');
    console.log('Scenario: User traveling to Sydney from November 24-30, 2024');
    console.log(`User ID: ${userId}\n`);

    const travelData: SydneyTravelDemo = {
        destination: 'Sydney, NSW, Australia',
        startDate: '2024-11-24T00:00:00Z',
        endDate: '2024-11-30T23:59:59Z',
        userId
    };

    try {
        // Step 1: Get travel-specific recommendations
        console.log('🎯 Step 1: Getting travel-specific recommendations...');
        const travelEvents = await getTravelRecommendations(
            travelData.destination,
            travelData.startDate,
            travelData.endDate,
            travelData.userId,
            15 // Limit to top 15 events
        );

        console.log(`✅ Found ${travelEvents.length} events in Sydney for Nov 24-30:`);
        travelEvents.forEach((event, index) => {
            console.log(`   ${index + 1}. ${event.title}`);
            console.log(`      📍 ${event.location}`);
            console.log(`      📅 ${new Date(event.startTime).toLocaleDateString()}`);
            console.log(`      ⭐ Score: ${event.totalScore.toFixed(2)}`);
            if (event.distanceFromUser) {
                console.log(`      📏 Distance: ${event.distanceFromUser.toFixed(1)}km from Sydney center`);
            }
            console.log('');
        });

        // Step 2: Get general location-based recommendations (would include travel events)
        console.log('🎯 Step 2: Getting comprehensive location-based recommendations...');
        const comprehensiveRecommendations = await generateEnhancedTopPicks({
            userId,
            maxDistance: 50, // Larger radius for travel
            includeTravelEvents: true,
            friendsWeight: 0.2,
            locationWeight: 0.5, // Higher weight for location when traveling
            popularityWeight: 0.3,
            limit: 20
        });

        console.log(`✅ Found ${comprehensiveRecommendations.length} total recommendations:`);

        // Separate by recommendation type
        const locationEvents = comprehensiveRecommendations.filter(e => e.recommendationReason === 'location');
        const travelEventsInList = comprehensiveRecommendations.filter(e => e.recommendationReason === 'travel');
        const mixedEvents = comprehensiveRecommendations.filter(e => e.recommendationReason === 'mixed');

        console.log(`   📍 Location-based: ${locationEvents.length}`);
        console.log(`   ✈️  Travel-based: ${travelEventsInList.length}`);
        console.log(`   🎯 Mixed recommendations: ${mixedEvents.length}`);

        // Step 3: Demonstrate proximity-based queries
        console.log('\n🎯 Step 3: Demonstrating proximity-based queries...');

        // Query events within 25km of Sydney Opera House
        const sydneyOperaHouse = { latitude: -33.8568, longitude: 151.2153 };
        const nearbyEvents = await LocationEventService.getEventsNearLocation({
            latitude: sydneyOperaHouse.latitude,
            longitude: sydneyOperaHouse.longitude,
            radiusKm: 25,
            startDate: travelData.startDate,
            endDate: travelData.endDate,
            limit: 10
        });

        console.log(`✅ Found ${nearbyEvents.length} events within 25km of Sydney Opera House:`);
        nearbyEvents.forEach((event, index) => {
            console.log(`   ${index + 1}. ${event.title}`);
            console.log(`      📏 ${event.distanceFromUser?.toFixed(1)}km away`);
            console.log(`      📅 ${new Date(event.startTime).toLocaleDateString()}`);
        });

        // Step 4: Performance and analytics summary
        console.log('\n📊 Step 4: Performance Summary');
        console.log('===============================');

        const validation = await validateGeospatialMigration();
        console.log(`Database completeness: ${validation.migrationCompleteness.toFixed(1)}%`);
        console.log(`Events with coordinates: ${validation.eventsWithCoordinates}/${validation.totalEvents}`);

        if (validation.migrationCompleteness < 90) {
            console.log('⚠️  Consider running the geospatial migration for better results');
        }

        // Step 5: User journey simulation
        console.log('\n🎭 Step 5: User Journey Simulation');
        console.log('===================================');
        console.log('Simulating how this would appear in the app:');
        console.log('');

        console.log('📱 Home Feed - Top Picks Section:');
        console.log('   "Top Picks - 📍 Based on your location & travel plans"');

        const topPicksForDisplay = comprehensiveRecommendations.slice(0, 6);
        topPicksForDisplay.forEach((event, index) => {
            const reasonIcon = getReasonIcon(event.recommendationReason);
            console.log(`   ${reasonIcon} ${event.title} - ${new Date(event.startTime).toLocaleDateString()}`);
        });

        console.log('');
        console.log('📱 Explore Page - Location Filter:');
        console.log('   "Events in Sydney, NSW" (Nov 24-30, 2024)');
        console.log(`   Showing ${travelEvents.length} events sorted by proximity and popularity`);

        console.log('');
        console.log('✨ Demo completed successfully!');
        console.log('   The user can now discover events in Sydney during their travel dates,');
        console.log('   with recommendations prioritized by location proximity and relevance.');

    } catch (error) {
        console.error('❌ Demo failed:', error);
        console.log('\n🔧 Troubleshooting tips:');
        console.log('   1. Ensure the geospatial migration has been run');
        console.log('   2. Check that events exist in the database');
        console.log('   3. Verify location permissions are granted');
        console.log('   4. Confirm Appwrite database configuration');
    }
}

/**
 * Helper function to get emoji for recommendation reasons
 */
function getReasonIcon(reason: string): string {
    switch (reason) {
        case 'location': return '📍';
        case 'travel': return '✈️';
        case 'friends': return '👥';
        case 'popularity': return '⭐';
        case 'mixed': return '🎯';
        default: return '🎉';
    }
}

/**
 * Test the location services with mock data
 */
export async function testLocationServicesWithMockData(): Promise<void> {
    console.log('🧪 Testing Location Services with Mock Data');
    console.log('===========================================');

    try {
        // Test geocoding for Sydney
        console.log('Testing geocoding for Sydney...');
        const { geocodeLocation } = await import('@/lib/utils/locationUtils');

        const sydneyCoords = await geocodeLocation('Sydney, NSW, Australia');
        if (sydneyCoords) {
            console.log(`✅ Sydney coordinates: ${sydneyCoords.latitude}, ${sydneyCoords.longitude}`);
        } else {
            console.log('❌ Failed to geocode Sydney');
        }

        // Test distance calculation
        console.log('\nTesting distance calculations...');
        const { calculateDistance } = await import('@/lib/utils/locationUtils');

        const operaHouseCoords = { latitude: -33.8568, longitude: 151.2153 };
        const harbourBridgeCoords = { latitude: -33.8523, longitude: 151.2108 };

        const distance = calculateDistance(
            operaHouseCoords.latitude,
            operaHouseCoords.longitude,
            harbourBridgeCoords.latitude,
            harbourBridgeCoords.longitude
        );

        console.log(`✅ Distance between Opera House and Harbour Bridge: ${distance.toFixed(2)}km`);

        // Test location filtering
        console.log('\nTesting location filtering...');

        // Mock events for testing
        const mockEvents = [
            {
                $id: 'test1',
                title: 'Sydney Festival Opening',
                location: 'Sydney Opera House (-33.8568, 151.2153)',
                startTime: '2024-11-25T19:00:00Z',
                endTime: '2024-11-25T22:00:00Z',
                creatorId: 'creator1',
                tags: ['music', 'festival'],
                locationLat: -33.8568,
                locationLng: 151.2153
            },
            {
                $id: 'test2',
                title: 'Harbour Bridge Walk',
                location: 'Sydney Harbour Bridge (-33.8523, 151.2108)',
                startTime: '2024-11-26T09:00:00Z',
                endTime: '2024-11-26T11:00:00Z',
                creatorId: 'creator2',
                tags: ['outdoor', 'sightseeing'],
                locationLat: -33.8523,
                locationLng: 151.2108
            },
            {
                $id: 'test3',
                title: 'Melbourne Event',
                location: 'Melbourne, VIC (-37.8136, 144.9631)',
                startTime: '2024-11-27T15:00:00Z',
                endTime: '2024-11-27T18:00:00Z',
                creatorId: 'creator3',
                tags: ['art'],
                locationLat: -37.8136,
                locationLng: 144.9631
            }
        ];

        // Filter events within 25km of Sydney center
        const sydneyCenter = { latitude: -33.8688, longitude: 151.2093 };
        const nearbyMockEvents = mockEvents.filter(event => {
            if (!event.locationLat || !event.locationLng) return false;

            const dist = calculateDistance(
                sydneyCenter.latitude,
                sydneyCenter.longitude,
                event.locationLat,
                event.locationLng
            );

            return dist <= 25;
        });

        console.log(`✅ Found ${nearbyMockEvents.length} events within 25km of Sydney center:`);
        nearbyMockEvents.forEach(event => {
            const dist = calculateDistance(
                sydneyCenter.latitude,
                sydneyCenter.longitude,
                event.locationLat!,
                event.locationLng!
            );
            console.log(`   - ${event.title}: ${dist.toFixed(1)}km away`);
        });

        console.log('\n✨ Location services testing completed successfully!');

    } catch (error) {
        console.error('❌ Location services testing failed:', error);
    }
}

/**
 * Complete demo runner
 */
export async function runCompleteLocationDemo(userId: string = 'demo-user'): Promise<void> {
    console.log('🌟 Complete Location-Based Recommendations Demo');
    console.log('===============================================');
    console.log('This demo showcases the enhanced location services for event discovery\n');

    try {
        // Part 1: Test basic location services
        await testLocationServicesWithMockData();

        console.log('\n' + '='.repeat(60) + '\n');

        // Part 2: Run Sydney travel demo
        await runSydneyTravelDemo(userId);

        console.log('\n🎊 Complete demo finished successfully!');
        console.log('\n💡 Next steps:');
        console.log('   1. Run the geospatial migration: migrateEventsToGeospatial()');
        console.log('   2. Test with real user data and events');
        console.log('   3. Monitor performance and user engagement');
        console.log('   4. Consider adding more travel destinations');

    } catch (error) {
        console.error('❌ Complete demo failed:', error);
    }
}

export default {
    runSydneyTravelDemo,
    testLocationServicesWithMockData,
    runCompleteLocationDemo
};
