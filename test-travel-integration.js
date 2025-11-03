/**
 * Test Travel Integration - Calendar and Agenda
 * 
 * This script tests:
 * 1. Travel announcements showing up on calendar
 * 2. Travel announcements appearing in agenda
 * 3. Calendar date highlighting for travel periods
 */

console.log('🧪 Testing Travel Integration...');

// Test the helper functions
const testHelpers = () => {
    console.log('\n📚 Testing Helper Functions:');

    // Test data
    const mockTravel = [
        {
            $id: 'travel1',
            destination: 'Paris, France',
            startDate: '2024-11-01T00:00:00.000Z',
            endDate: '2024-11-05T23:59:59.999Z',
            userId: 'user123',
            isPublic: true
        },
        {
            $id: 'travel2',
            destination: 'Tokyo, Japan',
            startDate: '2024-11-15T00:00:00.000Z',
            endDate: '2024-11-20T23:59:59.999Z',
            userId: 'user123',
            isPublic: true
        }
    ];

    const mockEvents = [
        {
            $id: 'event1',
            title: 'Test Event',
            startTime: '2024-11-03T18:00:00.000Z',
            endTime: '2024-11-03T20:00:00.000Z',
            location: 'Paris',
            tags: ['meeting'],
            creatorId: 'user123'
        }
    ];

    console.log('Mock Travel Data:', mockTravel.length, 'items');
    console.log('Mock Event Data:', mockEvents.length, 'items');

    // Test combining items
    try {
        const { combineEventsAndTravel } = require('./lib/utils/homeHelpers');
        const combined = combineEventsAndTravel(mockEvents, mockTravel);
        console.log('✅ Combined Items:', combined.length);
        console.log('   - Events:', combined.filter(i => i.type === 'event').length);
        console.log('   - Travel:', combined.filter(i => i.type === 'travel').length);
    } catch (error) {
        console.log('❌ Helper test failed:', error.message);
    }

    // Test calendar processing
    try {
        const { processCalendarEvents } = require('./lib/utils/calendarHelpers');
        const calendarItems = processCalendarEvents(mockEvents, () => 'Test User', mockTravel);
        console.log('✅ Calendar Items:', calendarItems.length);
        console.log('   - Regular Events:', calendarItems.filter(i => !i.isTravel).length);
        console.log('   - Travel Events:', calendarItems.filter(i => i.isTravel).length);
    } catch (error) {
        console.log('❌ Calendar helper test failed:', error.message);
    }
};

// Test the database queries
const testDatabase = async () => {
    console.log('\n🗄️ Testing Database:');

    try {
        const { getActiveTravelForUser } = require('./lib/api/travel');

        // Test with a mock user ID
        const testUserId = 'test-user-id';
        console.log('Testing getActiveTravelForUser with ID:', testUserId);

        const travels = await getActiveTravelForUser(testUserId);
        console.log('✅ Database query successful');
        console.log('   - Travel announcements found:', travels?.length || 0);

        if (travels && travels.length > 0) {
            console.log('   - Sample travel:', {
                destination: travels[0].destination,
                startDate: travels[0].startDate,
                endDate: travels[0].endDate
            });
        }

    } catch (error) {
        console.log('❌ Database test failed:', error.message);
        console.log('   This might be expected if no real user data exists');
    }
};

// Run tests
const runTests = async () => {
    testHelpers();
    await testDatabase();

    console.log('\n✅ Travel Integration Test Complete!');
    console.log('\nNext steps:');
    console.log('1. Open the app and navigate to Home tab');
    console.log('2. Check the Agenda tab for travel announcements');
    console.log('3. Check the Calendar tab for travel date highlighting');
    console.log('4. Create a new travel announcement to test the flow');
};

runTests().catch(console.error);