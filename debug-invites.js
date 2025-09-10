const { Client, Databases, Query } = require('react-native-appwrite');

const config = {
    endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
    projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
    databaseID: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
    eventAttendancesCollectionID: process.env.EXPO_PUBLIC_APPWRITE_EVENT_ATTENDANCES_COLLECTION_ID
};

const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId);

const databases = new Databases(client);

async function debugInvites() {
    try {
        console.log('Checking configuration...');
        console.log('Database ID:', config.databaseID);
        console.log('Event Attendances Collection:', config.eventAttendancesCollectionID);

        if (!config.eventAttendancesCollectionID) {
            console.log('Event Attendances Collection ID is not configured');
            return;
        }

        console.log('\nChecking for invited users...');
        const invites = await databases.listDocuments(
            config.databaseID,
            config.eventAttendancesCollectionID,
            [Query.equal('status', 'invited'), Query.limit(5)]
        );

        console.log(`Found ${invites.documents.length} invitations:`);
        invites.documents.forEach((invite, index) => {
            console.log(`${index + 1}. Event: ${invite.eventId}, User: ${invite.userId}, Status: ${invite.status}`);
        });

    } catch (error) {
        console.error('Error checking invites:', error);
    }
}

debugInvites();
