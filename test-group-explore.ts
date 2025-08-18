/**
 * Group Explore Diagnostic Tool
 * Tests the group explore functionality to identify issues
 */

import { getPublicGroups, searchPublicGroups } from './lib/api/group';
import { getGroupMembers } from './lib/api/groupMembership';
import { config } from './lib/appwrite/appwrite';

async function testGroupExploreSystem() {
    console.log('🔍 TESTING GROUP EXPLORE SYSTEM');
    console.log('================================');

    // Test configuration
    console.log('\n📋 Configuration Check:');
    console.log(`Groups Collection ID: ${config.groupsCollectionID}`);
    console.log(`GroupMemberships Collection ID: ${config.groupMembershipsCollectionID}`);

    try {
        console.log('\n📝 Step 1: Test getPublicGroups()');
        const publicGroups = await getPublicGroups();
        console.log(`✅ Found ${publicGroups.length} public groups`);

        if (publicGroups.length > 0) {
            const firstGroup = publicGroups[0];
            console.log(`📊 First group: "${firstGroup.title}"`);
            console.log(`   - ID: ${firstGroup.$id}`);
            console.log(`   - Member count: ${firstGroup.memberCount}`);
            console.log(`   - Users array length: ${firstGroup.users?.length || 0}`);
            console.log(`   - Is Private: ${firstGroup.isPrivate}`);

            // Test junction table for first group
            console.log('\n📝 Step 2: Test junction table members for first group');
            try {
                const members = await getGroupMembers(firstGroup.$id, 20);
                console.log(`✅ Junction table members: ${members.length}`);
                members.forEach((member, index) => {
                    console.log(`   ${index + 1}. ${member.firstName} ${member.lastName} (${member.role})`);
                });
            } catch (error) {
                console.log(`❌ Junction table error: ${error}`);
            }
        }

        console.log('\n📝 Step 3: Test searchPublicGroups()');
        if (publicGroups.length > 0) {
            const searchTerm = publicGroups[0].title.substring(0, 3); // Use first 3 chars of first group
            const searchResults = await searchPublicGroups(searchTerm);
            console.log(`✅ Search for "${searchTerm}": ${searchResults.length} results`);

            searchResults.forEach((group, index) => {
                console.log(`   ${index + 1}. "${group.title}" (${group.memberCount} members)`);
            });
        } else {
            console.log('⚠️  No groups to test search with');
        }

        console.log('\n🎉 Group explore test completed!');

    } catch (error) {
        console.error('❌ Group explore test failed:', error);
    }
}

/**
 * Test group creation to ensure we have test data
 */
async function testCreateTestGroup() {
    console.log('\n🔧 CREATING TEST GROUP FOR DEBUGGING');

    try {
        const { createGroup } = await import('./lib/api/group');

        const testGroup = await createGroup(
            'Test Public Group',
            'test_user_id_replace_with_real', // Replace with actual user ID
            [],
            false, // Public group
            'A test group for debugging the explore functionality'
        );

        if (testGroup) {
            console.log('✅ Test group created:', testGroup.title);
            console.log('   ID:', testGroup.$id);
        }

    } catch (error) {
        console.error('❌ Test group creation failed:', error);
        console.error('⚠️  Make sure to replace test_user_id_replace_with_real with actual user ID');
    }
}

// Export functions for manual testing
export {
    testCreateTestGroup, testGroupExploreSystem
};

console.log('📋 Group Explore Test Script Ready');
console.log('📌 To run tests:');
console.log('   1. Import and call testGroupExploreSystem()');
console.log('   2. Check console for detailed results');
console.log('   3. If no groups found, call testCreateTestGroup() first');
