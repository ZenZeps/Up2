// Simple test to check if collections are accessible
import { config, databases, Query } from './lib/appwrite/appwrite';

export async function testCollections() {
  console.log('🔍 Testing collection accessibility...');
  
  const collections = {
    events: config.eventsCollectionID,
    travel: config.travelCollectionID,
    users: config.usersCollectionID,
    eventAttendances: config.eventAttendancesCollectionID,
  };

  for (const [name, collectionId] of Object.entries(collections)) {
    try {
      console.log(`\n📋 Testing ${name}: ${collectionId}`);
      
      if (!collectionId || collectionId === 'event_attendances' || collectionId.includes('temp_')) {
        console.log(`❌ ${name}: Invalid/placeholder collection ID`);
        continue;
      }

      const result = await databases.listDocuments(
        config.databaseID!,
        collectionId,
        [Query.limit(1)]
      );
      
      console.log(`✅ ${name}: Found ${result.total} documents`);
    } catch (error: any) {
      console.log(`❌ ${name}: Error - ${error.message || error}`);
    }
  }
}

// Log configuration for debugging
console.log('📝 Current Configuration:');
console.log('Database ID:', config.databaseID);
console.log('Events Collection:', config.eventsCollectionID);
console.log('Travel Collection:', config.travelCollectionID);
console.log('Event Attendances:', config.eventAttendancesCollectionID);
