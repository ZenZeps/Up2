const { Client, Databases } = require('appwrite');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.EXPO_PUBLIC_API_KEY);

const databases = new Databases(client);

async function testEventPhotoField() {
    try {
        console.log('Testing event photo field retrieval...');

        // Get a sample event from the database
        const events = await databases.listDocuments(
            process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
            process.env.EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID,
            []
        );

        if (events.documents.length === 0) {
            console.log('No events found in database');
            return;
        }

        console.log('Sample event fields:', Object.keys(events.documents[0] || {}));

        // Check if any events have photoId
        const eventsWithPhotos = events.documents.filter(e => e.photoId);
        console.log('Events with photoId:', eventsWithPhotos.length);
        console.log('Total events:', events.documents.length);

        if (eventsWithPhotos.length > 0) {
            console.log('Sample event with photo:', {
                id: eventsWithPhotos[0].$id,
                title: eventsWithPhotos[0].title,
                photoId: eventsWithPhotos[0].photoId
            });
        } else {
            console.log('No events with photoId found');
            // Show a sample event structure
            console.log('Sample event structure:', {
                id: events.documents[0].$id,
                title: events.documents[0].title,
                hasPhotoId: 'photoId' in events.documents[0],
                photoIdValue: events.documents[0].photoId
            });
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testEventPhotoField();
