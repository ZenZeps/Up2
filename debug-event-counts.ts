/**
 * Debug script to identify and fix events with incorrect attendee counts
 * Run this to sync database counters with junction table data
 */

import { authDebug } from '@/lib/debug/authDebug';
import { findEventsWithIncorrectCounts, syncMultipleEventCounts } from '@/lib/utils/eventCountSync';

export async function debugEventCounts() {
    console.log('🔍 Checking for events with incorrect attendee counts...');

    try {
        // Find events with count mismatches
        const problematicEvents = await findEventsWithIncorrectCounts(50);

        if (problematicEvents.length === 0) {
            console.log('✅ All event counts appear to be correct!');
            return;
        }

        console.log(`❌ Found ${problematicEvents.length} events with incorrect counts:`, problematicEvents);

        // Ask user if they want to fix them
        console.log('🔧 Attempting to fix incorrect counts...');

        // Fix the counts
        const results = await syncMultipleEventCounts(problematicEvents);

        const updated = results.filter(r => r.updated);
        console.log(`✅ Fixed ${updated.length} events:`);

        updated.forEach(result => {
            console.log(`  - Event ${result.eventId}: attendees ${result.oldAttendeeCount}→${result.newAttendeeCount}, invites ${result.oldInviteCount}→${result.newInviteCount}`);
        });

    } catch (error) {
        console.error('❌ Error during count debugging:', error);
        authDebug.error('Debug event counts failed:', error);
    }
}

// Helper function to debug a specific event
export async function debugSingleEvent(eventId: string) {
    const { syncEventCounts } = await import('@/lib/utils/eventCountSync');

    try {
        console.log(`🔍 Checking event ${eventId}...`);
        const result = await syncEventCounts(eventId);

        if (result.updated) {
            console.log(`✅ Fixed event ${eventId}: attendees ${result.oldAttendeeCount}→${result.newAttendeeCount}, invites ${result.oldInviteCount}→${result.newInviteCount}`);
        } else {
            console.log(`✅ Event ${eventId} counts were already correct: ${result.newAttendeeCount} attendees, ${result.newInviteCount} invites`);
        }

        return result;
    } catch (error) {
        console.error(`❌ Error checking event ${eventId}:`, error);
        throw error;
    }
}
