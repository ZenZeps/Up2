import { config, databases } from '@/lib/appwrite/appwrite';
import { syncEventAttendeeCounts, validateEventAttendeeCount } from '@/lib/utils/attendeeCountManager';

/**
 * Script to fix attendee count issues for existing events
 */

async function fixAttendeeCountIssues() {
    console.log('🔧 Starting attendee count fix process...');

    try {
        // First, let's check a few recent events to see the issue
        const recentEvents = await databases.listDocuments(
            config.databaseID!,
            config.eventsCollectionID!,
            [
                // Get the most recent 10 events
            ]
        );

        console.log(`📊 Found ${recentEvents.documents.length} events to check`);

        // Validate a few events first
        for (let i = 0; i < Math.min(5, recentEvents.documents.length); i++) {
            const event = recentEvents.documents[i];
            const validation = await validateEventAttendeeCount(event.$id);

            console.log(`📝 Event "${event.title}" (${event.$id}):`);
            console.log(`   Stored count: ${validation.storedCount}`);
            console.log(`   Actual count: ${validation.actualCount}`);
            console.log(`   Valid: ${validation.isValid ? '✅' : '❌'}`);

            if (!validation.isValid) {
                console.log(`   🔨 Needs fixing!`);
            }
        }

        // Now run the full sync
        console.log('\n🔄 Running full attendee count synchronization...');
        const result = await syncEventAttendeeCounts();

        console.log(`\n✅ Sync complete!`);
        console.log(`   Fixed: ${result.fixed} events`);
        console.log(`   Errors: ${result.errors} events`);

        if (result.fixed > 0) {
            console.log(`\n🎉 Successfully fixed ${result.fixed} events with incorrect attendee counts!`);
        } else {
            console.log(`\n✨ All events already have correct attendee counts!`);
        }

    } catch (error) {
        console.error('❌ Failed to fix attendee count issues:', error);
    }
}

// Export for use in debugging
export { fixAttendeeCountIssues };

// Auto-run if this file is executed directly
if (require.main === module) {
    fixAttendeeCountIssues();
}
