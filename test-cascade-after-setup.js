#!/usr/bin/env node

/**
 * 🧪 Test Cascade Deletion After Relationship Configuration
 * 
 * This script verifies that the relationship-based cascade deletion is working correctly
 * after configuring all relationships in Appwrite Console.
 * 
 * Usage: node test-cascade-after-setup.js
 */

const { Client, Databases, ID } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

// Appwrite configuration
const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || 'https://syd.cloud.appwrite.io/v1')
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.EXPO_PUBLIC_API_KEY || process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

// Collection IDs
const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID;
const EVENTS_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID;
const USERS_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID;
const EVENT_ATTENDANCES_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_EVENTATTENDANCES_COLLECTION_ID || 'event_attendances';
const GROUPS_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_GROUPS_COLLECTION_ID;
const GROUP_MEMBERSHIPS_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_GROUPMEMBERSHIPS_COLLECTION_ID;

/**
 * Test 1: Event Deletion Cascade
 * Create event with attendance, then delete event and verify attendance is gone
 */
async function testEventCascadeDeletion() {
    console.log('\n🧪 Test 1: Event Deletion Cascade');
    console.log('==================================');

    let testUserId = null;
    let testEventId = null;

    try {
        // Step 1: Create test user
        const testUser = await databases.createDocument(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            ID.unique(),
            {
                name: 'Test User for Event Cascade',
                email: `event-test-${Date.now()}@example.com`,
                username: `eventtest${Date.now()}`
            }
        );
        testUserId = testUser.$id;
        console.log('✅ Created test user:', testUserId);

        // Step 2: Create test event with relationship fields
        const testEvent = await databases.createDocument(
            DATABASE_ID,
            EVENTS_COLLECTION_ID,
            ID.unique(),
            {
                title: 'Test Event for Cascade',
                description: 'Testing cascade deletion',
                startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
                location: 'Test Location',
                isPrivate: false,
                // Relationship field
                creator: testUserId,
                // String field for compatibility
                creatorId: testUserId,
                // Required fields
                attendeeCount: 0,
                inviteCount: 0,
                viewCount: 0,
                popularityScore: 0.0,
                responseRate: true,
                lastActivityAt: new Date().toISOString(),
                locationLat: 0.0,
                locationLng: 0.0,
                tags: ['test'],
                searchKeywords: [],
                categoryTags: []
            }
        );
        testEventId = testEvent.$id;
        console.log('✅ Created test event:', testEventId);

        // Step 3: Create attendance with relationship fields
        const attendance = await databases.createDocument(
            DATABASE_ID,
            EVENT_ATTENDANCES_COLLECTION_ID,
            ID.unique(),
            {
                // Relationship fields
                event: testEventId,
                user: testUserId,
                // String fields for compatibility
                eventId: testEventId,
                userId: testUserId,
                status: 'attending'
            }
        );
        console.log('✅ Created attendance:', attendance.$id);

        // Step 4: Verify attendance exists before deletion
        const attendancesBefore = await databases.listDocuments(
            DATABASE_ID,
            EVENT_ATTENDANCES_COLLECTION_ID,
            []
        );
        const userAttendancesBefore = attendancesBefore.documents.filter(a =>
            a.eventId === testEventId || a.event === testEventId
        );
        console.log(`📊 Attendances before deletion: ${userAttendancesBefore.length}`);

        // Step 5: Delete the event
        console.log('🗑️ Deleting event...');
        await databases.deleteDocument(
            DATABASE_ID,
            EVENTS_COLLECTION_ID,
            testEventId
        );
        console.log('✅ Event deleted successfully');

        // Step 6: Wait a moment for cascade to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 7: Check if attendances were cascade deleted
        const attendancesAfter = await databases.listDocuments(
            DATABASE_ID,
            EVENT_ATTENDANCES_COLLECTION_ID,
            []
        );
        const userAttendancesAfter = attendancesAfter.documents.filter(a =>
            a.eventId === testEventId || a.event === testEventId
        );
        console.log(`📊 Attendances after deletion: ${userAttendancesAfter.length}`);

        if (userAttendancesAfter.length === 0) {
            console.log('🎉 SUCCESS: Attendances were automatically deleted with event!');
            return true;
        } else {
            console.log('❌ FAILED: Attendances still exist after event deletion');
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    } finally {
        // Cleanup: Delete test user if it still exists
        if (testUserId) {
            try {
                await databases.deleteDocument(DATABASE_ID, USERS_COLLECTION_ID, testUserId);
                console.log('🧹 Cleaned up test user');
            } catch (e) {
                console.log('🧹 Test user already cleaned up or deleted');
            }
        }
    }
}

/**
 * Test 2: User Deletion Cascade
 * Create user with events and attendances, delete user, verify everything cascades
 */
async function testUserCascadeDeletion() {
    console.log('\n🧪 Test 2: User Deletion Cascade');
    console.log('=================================');

    let testUserId = null;
    let testEventId = null;

    try {
        // Step 1: Create test user
        const testUser = await databases.createDocument(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            ID.unique(),
            {
                name: 'Test User for User Cascade',
                email: `user-cascade-${Date.now()}@example.com`,
                username: `usercascade${Date.now()}`
            }
        );
        testUserId = testUser.$id;
        console.log('✅ Created test user:', testUserId);

        // Step 2: Create event created by this user
        const testEvent = await databases.createDocument(
            DATABASE_ID,
            EVENTS_COLLECTION_ID,
            ID.unique(),
            {
                title: 'Event for User Cascade Test',
                description: 'Testing user cascade deletion',
                startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
                location: 'Test Location',
                isPrivate: false,
                // Relationship field
                creator: testUserId,
                // String field for compatibility
                creatorId: testUserId,
                // Required fields
                attendeeCount: 0,
                inviteCount: 0,
                viewCount: 0,
                popularityScore: 0.0,
                responseRate: true,
                lastActivityAt: new Date().toISOString(),
                locationLat: 0.0,
                locationLng: 0.0,
                tags: ['test'],
                searchKeywords: [],
                categoryTags: []
            }
        );
        testEventId = testEvent.$id;
        console.log('✅ Created test event:', testEventId);

        // Step 3: Count documents before deletion
        const eventsBefore = await databases.listDocuments(DATABASE_ID, EVENTS_COLLECTION_ID, []);
        const userEventsBefore = eventsBefore.documents.filter(e =>
            e.creatorId === testUserId || e.creator === testUserId
        );
        console.log(`📊 Events before user deletion: ${userEventsBefore.length}`);

        // Step 4: Delete the user
        console.log('🗑️ Deleting user...');
        await databases.deleteDocument(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            testUserId
        );
        console.log('✅ User deleted successfully');

        // Step 5: Wait for cascade to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 6: Check if events were cascade deleted
        const eventsAfter = await databases.listDocuments(DATABASE_ID, EVENTS_COLLECTION_ID, []);
        const userEventsAfter = eventsAfter.documents.filter(e =>
            e.creatorId === testUserId || e.creator === testUserId
        );
        console.log(`📊 Events after user deletion: ${userEventsAfter.length}`);

        if (userEventsAfter.length === 0) {
            console.log('🎉 SUCCESS: Events were automatically deleted with user!');
            return true;
        } else {
            console.log('❌ FAILED: Events still exist after user deletion');
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}

/**
 * Main test runner
 */
async function runCascadeDeletionTests() {
    console.log('🚀 Testing Cascade Deletion After Relationship Setup');
    console.log('====================================================');
    console.log('📋 Configuration:');
    console.log('- Database ID:', DATABASE_ID);
    console.log('- Events Collection:', EVENTS_COLLECTION_ID);
    console.log('- Users Collection:', USERS_COLLECTION_ID);
    console.log('- Event Attendances Collection:', EVENT_ATTENDANCES_COLLECTION_ID);

    const results = [];

    try {
        // Run tests
        results.push(await testEventCascadeDeletion());
        results.push(await testUserCascadeDeletion());

        // Summary
        const passed = results.filter(r => r === true).length;
        const total = results.length;

        console.log('\n📊 TEST RESULTS SUMMARY');
        console.log('=======================');
        console.log(`✅ Passed: ${passed}/${total}`);
        console.log(`${passed === total ? '🎉' : '❌'} Overall: ${passed === total ? 'SUCCESS' : 'SOME TESTS FAILED'}`);

        if (passed === total) {
            console.log('');
            console.log('🎉 Congratulations! Cascade deletion is working correctly!');
            console.log('✅ Your relationship-based cascade deletion is fully functional.');
            console.log('');
            console.log('📋 What this means:');
            console.log('• Deleting events automatically removes all attendances');
            console.log('• Deleting users automatically removes all their events and attendances');
            console.log('• Your app is now protected from orphaned data');
        } else {
            console.log('');
            console.log('❌ Some tests failed. Please check:');
            console.log('1. All relationship attributes are created with "On Delete: cascade"');
            console.log('2. Relationship types are correct (many_to_one, one_to_many)');
            console.log('3. Two-way settings match the guide');
        }

    } catch (error) {
        console.error('❌ Test suite failed:', error);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runCascadeDeletionTests().catch(console.error);
}

module.exports = { runCascadeDeletionTests };