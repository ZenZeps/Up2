// Debug script to check event attendee data
import { Client, Databases } from 'node-appwrite';

const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY || 'test-key');

const databases = new Databases(client);

async function debugEventAttendees() {
    try {
        console.log('🔍 Fetching events to check attendee data...');

        const response = await databases.listDocuments(
            process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
            process.env.EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID,
            []
        );

        console.log(`📊 Found ${response.documents.length} events`);

        response.documents.slice(0, 3).forEach((event, index) => {
            console.log(`\n🎉 Event ${index + 1}: ${event.title}`);
            console.log(`   ID: ${event.$id}`);
            console.log(`   Creator: ${event.creatorId}`);
            console.log(`   Attendees field:`, event.attendees);
            console.log(`   All fields:`, Object.keys(event));

            // Check if this event has any attendee-related fields
            const attendeeFields = Object.keys(event).filter(key =>
                key.toLowerCase().includes('attend') ||
                key.toLowerCase().includes('participant') ||
                key.toLowerCase().includes('member')
            );
            console.log(`   Attendee-related fields:`, attendeeFields);
        });

        // Also check what environment variables are set
        console.log('\n🔧 Environment check:');
        console.log('   APPWRITE_EVENTATTENDANCES_COLLECTION_ID:', process.env.EXPO_PUBLIC_APPWRITE_EVENTATTENDANCES_COLLECTION_ID);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugEventAttendees();
