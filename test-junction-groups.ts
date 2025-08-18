import { createGroup, getGroupById, getUserGroups } from './lib/api/group';
import { getGroupMembers } from './lib/api/groupMembership';

/**
 * Test script to verify junction table functionality
 */
async function testJunctionTableGroups() {
    console.log('🔥 Testing Junction Table Group Operations');

    // Test user IDs (replace with actual test user IDs from your database)
    const testUserId1 = 'user1_test_id';
    const testUserId2 = 'user2_test_id';

    try {
        console.log('\n📝 Step 1: Create a test group');
        const testGroup = await createGroup(
            'Test Junction Group',
            testUserId1,
            [testUserId2],
            false,
            'Testing junction table functionality'
        );

        if (testGroup) {
            console.log('✅ Group created successfully:', testGroup.title);
            console.log('👥 Initial member count:', testGroup.memberCount);

            console.log('\n📝 Step 2: Get group members from junction table');
            const members = await getGroupMembers(testGroup.$id, 50);
            console.log('✅ Junction table members:', members.length);
            members.forEach(member => {
                console.log(`   - ${member.firstName} ${member.lastName} (${member.role})`);
            });

            console.log('\n📝 Step 3: Get user groups using junction table');
            const userGroups = await getUserGroups(testUserId1, 20);
            console.log('✅ User groups via junction table:', userGroups.length);

            console.log('\n📝 Step 4: Test group details with junction table');
            const groupDetails = await getGroupById(testGroup.$id);
            if (groupDetails) {
                console.log('✅ Group details loaded');
                console.log('👥 Member count from details:', groupDetails.memberCount);
                console.log('📊 Users array length:', groupDetails.users?.length || 0);
                console.log('🔍 First user type:', typeof groupDetails.users?.[0]);
            }

            console.log('\n🎉 Junction table test completed successfully!');
            console.log('\n⚠️  Remember to clean up the test group from your database');

        } else {
            console.log('❌ Failed to create test group');
        }

    } catch (error) {
        console.error('❌ Junction table test failed:', error);
    }
}

/**
 * Test junction table fallback system
 */
async function testFallbackSystem() {
    console.log('\n🔄 Testing Fallback System');

    try {
        // This will test the fallback when junction table fails
        console.log('Testing graceful degradation to legacy system...');
        // Add your fallback tests here

    } catch (error) {
        console.error('❌ Fallback test failed:', error);
    }
}

// Export functions for manual testing
export {
    testFallbackSystem, testJunctionTableGroups
};

console.log('📋 Junction Table Test Script Ready');
console.log('📌 To run tests:');
console.log('   1. Update test user IDs in the script');
console.log('   2. Import and call testJunctionTableGroups()');
console.log('   3. Check console for results');
