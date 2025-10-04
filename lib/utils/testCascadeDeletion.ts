/**
 * 🧪 Simple Cascade Deletion Test for Your App
 * 
 * Add this to a test screen in your app or run in console to verify cascade deletion works.
 * This uses your existing authenticated session.
 */

import { config, databases } from '@/lib/appwrite/appwrite';
import { ID } from 'react-native-appwrite';

export const testCascadeDeletion = async (currentUserId: string) => {
    console.log('🧪 Testing Cascade Deletion...');
    console.log('===============================');

    let testEventId: string | null = null;
    let testAttendanceId: string | null = null;

    try {
        // Step 1: Create a test event
        console.log('📅 Creating test event...');
        const testEvent = await databases.createDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            ID.unique(),
            {
                title: 'Cascade Test Event',
                description: 'Testing cascade deletion',
                startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
                location: 'Test Location',
                isPrivate: false,
                // Relationship field (NEW)
                creator: currentUserId,
                // String field (OLD - for compatibility)
                creatorId: currentUserId,
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

        // Step 2: Create an attendance for this event
        console.log('👥 Creating test attendance...');
        const testAttendance = await databases.createDocument(
            config.databaseID!,
            config.eventAttendancesCollectionID!,
            ID.unique(),
            {
                // Relationship fields (NEW)
                event: testEventId,
                user: currentUserId,
                // String fields (OLD - for compatibility)
                eventId: testEventId,
                userId: currentUserId,
                status: 'attending'
            }
        );
        testAttendanceId = testAttendance.$id;
        console.log('✅ Created test attendance:', testAttendanceId);

        // Step 3: Verify attendance exists
        const attendancesBefore = await databases.listDocuments(
            config.databaseID!,
            config.eventAttendancesCollectionID!,
            []
        );
        const myAttendancesBefore = attendancesBefore.documents.filter(a =>
            (a.eventId === testEventId || a.event === testEventId) &&
            (a.userId === currentUserId || a.user === currentUserId)
        );
        console.log(`📊 My attendances before deletion: ${myAttendancesBefore.length}`);

        // Step 4: Delete the event (this should cascade delete the attendance)
        console.log('🗑️ Deleting test event...');
        await databases.deleteDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            testEventId
        );
        console.log('✅ Event deleted successfully');

        // Step 5: Wait a moment for cascade
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 6: Check if attendance was cascade deleted
        console.log('🔍 Checking if attendance was cascade deleted...');
        const attendancesAfter = await databases.listDocuments(
            config.databaseID!,
            config.eventAttendancesCollectionID!,
            []
        );
        const myAttendancesAfter = attendancesAfter.documents.filter(a =>
            (a.eventId === testEventId || a.event === testEventId) &&
            (a.userId === currentUserId || a.user === currentUserId)
        );
        console.log(`📊 My attendances after deletion: ${myAttendancesAfter.length}`);

        // Step 7: Test result
        if (myAttendancesAfter.length === 0) {
            console.log('🎉 SUCCESS: Cascade deletion is working!');
            console.log('✅ The attendance was automatically deleted when the event was deleted.');
            return {
                success: true,
                message: 'Cascade deletion is working correctly!'
            };
        } else {
            console.log('❌ FAILED: Attendance still exists after event deletion');
            console.log('💡 This means the relationship cascade is not configured properly.');
            return {
                success: false,
                message: 'Cascade deletion is NOT working. Check relationship setup.'
            };
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return {
            success: false,
            message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
};

// Usage example for React Native screen:
/*
import { testCascadeDeletion } from './path/to/this/file';
import { useGlobalContext } from '@/lib/global-provider';

const TestScreen = () => {
    const { user } = useGlobalContext();
    
    const runTest = async () => {
        if (!user) {
            Alert.alert('Error', 'Please log in first');
            return;
        }
        
        const result = await testCascadeDeletion(user.$id);
        Alert.alert(
            result.success ? 'Test Passed! 🎉' : 'Test Failed ❌',
            result.message
        );
    };

    return (
        <TouchableOpacity onPress={runTest}>
            <Text>Test Cascade Deletion</Text>
        </TouchableOpacity>
    );
};
*/