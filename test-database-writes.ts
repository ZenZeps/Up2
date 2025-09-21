// Simple test to verify database writes are working
import { config, databases, ID } from './lib/appwrite/appwrite';

async function testDatabaseWrites() {
  console.log('🧪 Testing database write operations...');
  
  try {
    // Test 1: Try to create a simple event
    console.log('\n📝 Test 1: Creating test event...');
    const testEventId = ID.unique();
    const testEvent = {
      title: 'Test Event',
      location: 'Test Location',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
      creatorId: 'test-user-id',
      description: 'Test event description',
      isPrivate: false,
      tags: ['test'],
      id: testEventId,
      attendeeCount: 0,
      inviteCount: 0,
      viewCount: 0,
      popularityScore: 0.0,
      responseRate: true,
      locationLat: 0.0,
      locationLng: 0.0,
      searchKeywords: [],
      categoryTags: [],
    };

    const eventResponse = await databases.createDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      testEventId,
      testEvent
    );
    
    console.log('✅ Event created successfully:', eventResponse.$id);
    
    // Clean up
    await databases.deleteDocument(
      config.databaseID!,
      config.eventsCollectionID!,
      testEventId
    );
    console.log('🧹 Test event cleaned up');

  } catch (eventError: any) {
    console.error('❌ Event creation failed:', eventError);
    console.error('Error details:', {
      message: eventError?.message || 'Unknown error',
      type: eventError?.type || 'unknown',
      code: eventError?.code || 'unknown'
    });
  }

  try {
    // Test 2: Try to create a simple travel announcement
    console.log('\n✈️ Test 2: Creating test travel announcement...');
    const testTravelId = ID.unique();
    const testTravel = {
      userId: 'test-user-id',
      destination: 'Test Destination',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(), // 1 day later
      description: 'Test travel description',
      isPublic: true,
      destinationLat: -33.8688,
      destinationLng: 151.2093,
      friendsNotified: []
    };

    const travelResponse = await databases.createDocument(
      config.databaseID!,
      config.travelCollectionID!,
      testTravelId,
      testTravel
    );
    
    console.log('✅ Travel announcement created successfully:', travelResponse.$id);
    
    // Clean up
    await databases.deleteDocument(
      config.databaseID!,
      config.travelCollectionID!,
      testTravelId
    );
    console.log('🧹 Test travel announcement cleaned up');

  } catch (travelError: any) {
    console.error('❌ Travel announcement creation failed:', travelError);
    console.error('Error details:', {
      message: travelError?.message || 'Unknown error',
      type: travelError?.type || 'unknown',
      code: travelError?.code || 'unknown'
    });
  }

  console.log('\n🏁 Database write tests completed');
}

// Export for potential use
export { testDatabaseWrites };

// Log configuration
console.log('📋 Database Configuration:');
console.log('Database ID:', config.databaseID);
console.log('Events Collection:', config.eventsCollectionID);
console.log('Travel Collection:', config.travelCollectionID);
