import { config, databases, getCurrentUser, Query } from './lib/appwrite/appwrite';

async function debugInvites() {
    try {
        console.log('🔍 Debugging event invites...');

        // Get current user
        const user = await getCurrentUser();
        if (!user) {
            console.log('❌ No current user found');
            return;
        }

        console.log(`✅ Current user: ${user.$id}`);

        // Check attendances collection configuration
        console.log('📋 Configuration:');
        console.log(`Database ID: ${config.databaseID}`);
        console.log(`Event Attendances Collection: ${config.eventAttendancesCollectionID}`);

        // Check if junction table exists and has data
        try {
            const allAttendances = await databases.listDocuments(
                config.databaseID!,
                config.eventAttendancesCollectionID!,
                [Query.limit(5)]
            );
            console.log(`📊 Total attendance records: ${allAttendances.total}`);

            if (allAttendances.documents.length > 0) {
                console.log('Sample records:');
                allAttendances.documents.forEach((doc: any, index: number) => {
                    console.log(`  ${index + 1}. Event: ${doc.eventId}, User: ${doc.userId}, Status: ${doc.status}`);
                });
            }
        } catch (collectionError) {
            console.log('❌ Error accessing attendances collection:', collectionError);
            console.log('This might indicate the junction table is not set up correctly');
        }

        // Check for invites for current user
        try {
            const userInvites = await databases.listDocuments(
                config.databaseID!,
                config.eventAttendancesCollectionID!,
                [
                    Query.equal('userId', user.$id),
                    Query.equal('status', 'invited'),
                    Query.limit(10)
                ]
            );

            console.log(`🎉 User invites found: ${userInvites.documents.length}`);
            userInvites.documents.forEach((invite: any, index: number) => {
                console.log(`  ${index + 1}. Invited to event: ${invite.eventId}`);
            });

        } catch (inviteError) {
            console.log('❌ Error checking user invites:', inviteError);
        }

        // Check events to see legacy inviteeIds structure
        try {
            const events = await databases.listDocuments(
                config.databaseID!,
                config.eventsCollectionID!,
                [Query.limit(3)]
            );

            console.log(`📅 Sample events (${events.documents.length}):`);
            events.documents.forEach((event: any, index: number) => {
                const hasLegacyInvites = Array.isArray(event.inviteeIds) && event.inviteeIds.length > 0;
                console.log(`  ${index + 1}. ${event.title} - Legacy invites: ${hasLegacyInvites ? event.inviteeIds.length : 0}`);
                if (hasLegacyInvites && event.inviteeIds.includes(user.$id)) {
                    console.log(`    👋 Current user is invited via legacy system!`);
                }
            });

        } catch (eventError) {
            console.log('❌ Error checking events:', eventError);
        }

    } catch (error) {
        console.error('💥 Debug script error:', error);
    }
}

// Export so it can be imported and run
export default debugInvites;
