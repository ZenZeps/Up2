/**
 * Enterprise Database Optimization Test Suite
 * 
 * This script tests the new junction table architecture and performance counters
 * to ensure the database is optimized for enterprise-scale scalability.
 */

import { addEventAttendee, addEventInvitation, createEvent, fetchEventById, getEventAttendees, getEventInvitees, removeEventAttendee, updateEvent } from './lib/api/event';
import { Event } from './lib/types/Events';

interface TestResult {
    test: string;
    success: boolean;
    error?: string;
    duration: number;
}

const results: TestResult[] = [];

function logTest(test: string, success: boolean, duration: number, error?: string) {
    results.push({ test, success, duration, error });
    const status = success ? '✅' : '❌';
    console.log(`${status} ${test} (${duration}ms)`);
    if (error) console.log(`   Error: ${error}`);
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const start = Date.now();
    try {
        await testFn();
        logTest(name, true, Date.now() - start);
    } catch (error) {
        logTest(name, false, Date.now() - start, error instanceof Error ? error.message : String(error));
    }
}

async function testDatabaseOptimization() {
    console.log('🚀 Starting Enterprise Database Optimization Test Suite\n');

    let testEventId = '';
    const testUserId1 = 'test-user-1';
    const testUserId2 = 'test-user-2';
    const testUserId3 = 'test-user-3';

    // Test 1: Create event with optimized schema
    await runTest('Create Event with Optimized Schema', async () => {
        const eventData: Event = {
            $id: 'temp-id', // Will be replaced by createEvent
            title: 'Database Test Event',
            location: 'Test Location',
            startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
            creatorId: testUserId1,
            inviteeIds: [], // Required by Event interface
            attendees: [], // Required by Event interface
            description: 'Testing enterprise database optimization',
            tags: ['test', 'enterprise'],
        };

        const event = await createEvent(eventData);
        testEventId = event.$id;

        // Verify optimized fields are present
        if (typeof event.attendeeCount !== 'number') throw new Error('attendeeCount not properly initialized');
        if (typeof event.inviteCount !== 'number') throw new Error('inviteCount not properly initialized');
        if (typeof event.viewCount !== 'number') throw new Error('viewCount not properly initialized');
        if (typeof event.popularityScore !== 'number') throw new Error('popularityScore not properly initialized');
    });    // Test 2: Add attendees using junction table
    await runTest('Add Attendees via Junction Tables', async () => {
        await addEventAttendee(testEventId, testUserId1);
        await addEventAttendee(testEventId, testUserId2);

        // Verify attendees are in junction table
        const attendees = await getEventAttendees(testEventId);
        if (!attendees.includes(testUserId1)) throw new Error('User 1 not found in attendees');
        if (!attendees.includes(testUserId2)) throw new Error('User 2 not found in attendees');
    });

    // Test 3: Add invitations using junction table
    await runTest('Add Invitations via Junction Tables', async () => {
        await addEventInvitation(testEventId, testUserId2, testUserId1); // User 1 invites User 2
        await addEventInvitation(testEventId, testUserId3, testUserId1); // User 1 invites User 3

        // Verify invitations are in junction table
        const invitees = await getEventInvitees(testEventId);
        if (!invitees.includes(testUserId2)) throw new Error('User 2 not found in invitees');
        if (!invitees.includes(testUserId3)) throw new Error('User 3 not found in invitees');
    });

    // Test 4: Verify performance counters are updated
    await runTest('Verify Performance Counters', async () => {
        const event = await fetchEventById(testEventId);
        if (!event) throw new Error('Event not found');

        if (event.attendeeCount !== 2) throw new Error(`Expected attendeeCount=2, got ${event.attendeeCount}`);
        if (event.inviteCount !== 2) throw new Error(`Expected inviteCount=2, got ${event.inviteCount}`);
    });

    // Test 5: Remove attendee and verify counter update
    await runTest('Remove Attendee and Verify Counter', async () => {
        await removeEventAttendee(testEventId, testUserId1);

        const event = await fetchEventById(testEventId);
        if (!event) throw new Error('Event not found');

        if (event.attendeeCount !== 1) throw new Error(`Expected attendeeCount=1, got ${event.attendeeCount}`);

        // Verify user is removed from junction table
        const attendees = await getEventAttendees(testEventId);
        if (attendees.includes(testUserId1)) throw new Error('User 1 should have been removed from attendees');
    });

    // Test 6: Fetch event with junction table arrays populated
    await runTest('Fetch Event with Junction Table Arrays', async () => {
        const event = await fetchEventById(testEventId);
        if (!event) throw new Error('Event not found');

        // Verify arrays are properly populated from junction tables
        if (!Array.isArray(event.attendees)) throw new Error('attendees should be an array');
        if (!Array.isArray(event.inviteeIds)) throw new Error('inviteeIds should be an array');

        if (event.attendees.length !== 1) throw new Error(`Expected 1 attendee, got ${event.attendees.length}`);
        if (event.inviteeIds.length !== 2) throw new Error(`Expected 2 invitees, got ${event.inviteeIds.length}`);
    });

    // Test 7: Update event using new API (should handle array updates via junction tables)
    await runTest('Update Event via Optimized API', async () => {
        const newTitle = 'Updated Test Event';
        await updateEvent(testEventId, { title: newTitle });

        const event = await fetchEventById(testEventId);
        if (!event) throw new Error('Event not found');
        if (event.title !== newTitle) throw new Error('Event title not updated');
    });

    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);
    console.log(`Average Duration: ${Math.round(results.reduce((acc, r) => acc + r.duration, 0) / results.length)}ms`);

    if (results.every(r => r.success)) {
        console.log('\n🎉 All tests passed! Database optimization is working correctly.');
        console.log('✅ Junction tables are properly managing relationships');
        console.log('✅ Performance counters are automatically maintained');
        console.log('✅ App compatibility is preserved with array reconstruction');
        console.log('✅ Enterprise scalability patterns are implemented');
    } else {
        console.log('\n❌ Some tests failed. Please review the errors above.');
        results.filter(r => !r.success).forEach(r => {
            console.log(`   - ${r.test}: ${r.error}`);
        });
    }
}

// Export for use in other files
export { testDatabaseOptimization };

// Run if this file is executed directly
if (require.main === module) {
    testDatabaseOptimization().catch(console.error);
}
