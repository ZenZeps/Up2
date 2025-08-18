/**
 * GROUP ROLE SYSTEM TEST SCRIPT
 * 
 * This script tests the comprehensive group role-based permission system
 * Run with: npx ts-node test-group-roles.ts
 */

import {
    approveJoinRequest,
    checkGroupPermission,
    createGroup,
    deleteGroup,
    getDiscoverableGroups,
    getGroupJoinRequests,
    joinGroup,
    requestToJoinGroup
} from './lib/api/group';

import {
    addGroupMember,
    banGroupMember,
    getGroupMemberRole,
    getGroupMembers,
    updateGroupMemberRole
} from './lib/api/groupMembership';

async function testGroupRoleSystem() {
    console.log('🧪 Testing Group Role-Based Permission System');
    console.log('='.repeat(50));

    // Test user IDs (replace with real IDs from your database)
    const OWNER_ID = 'test_owner_id';
    const ADMIN_ID = 'test_admin_id';
    const MEMBER_ID = 'test_member_id';
    const NON_MEMBER_ID = 'test_non_member_id';

    try {
        // 1. Test Group Creation
        console.log('\n1. 📝 Testing Group Creation (Owner Role)');
        const publicGroup = await createGroup(
            'Test Public Group',
            OWNER_ID,
            [],
            false, // public
            'A test public group'
        );

        const privateGroup = await createGroup(
            'Test Private Group',
            OWNER_ID,
            [MEMBER_ID],
            true, // private
            'A test private group'
        );

        if (publicGroup && privateGroup) {
            console.log('✅ Groups created successfully');
            console.log(`   Public Group ID: ${publicGroup.$id}`);
            console.log(`   Private Group ID: ${privateGroup.$id}`);
        }

        // 2. Test Role Assignments
        console.log('\n2. 👑 Testing Role Assignments');

        // Add admin to public group
        const adminAdded = await addGroupMember(publicGroup!.$id, ADMIN_ID, 'admin', OWNER_ID);
        if (adminAdded) {
            console.log('✅ Admin added to public group');
        }

        // Check roles
        const ownerRole = await getGroupMemberRole(publicGroup!.$id, OWNER_ID);
        const adminRole = await getGroupMemberRole(publicGroup!.$id, ADMIN_ID);
        console.log(`   Owner role: ${ownerRole}`);
        console.log(`   Admin role: ${adminRole}`);

        // 3. Test Permission Checks
        console.log('\n3. 🔒 Testing Permission Checks');

        const permissions = [
            'view', 'post_events', 'invite_users', 'manage_members', 'manage_group', 'delete_group'
        ];

        for (const permission of permissions) {
            const ownerCan = await checkGroupPermission(publicGroup!.$id, OWNER_ID, permission as any);
            const adminCan = await checkGroupPermission(publicGroup!.$id, ADMIN_ID, permission as any);
            const memberCan = await checkGroupPermission(publicGroup!.$id, MEMBER_ID, permission as any);

            console.log(`   ${permission}: Owner=${ownerCan}, Admin=${adminCan}, Member=${memberCan}`);
        }

        // 4. Test Public Group Joining
        console.log('\n4. 🌐 Testing Public Group Joining');
        const joinResult = await joinGroup(publicGroup!.$id, NON_MEMBER_ID);
        console.log(`   Join result: ${joinResult.success ? 'Success' : 'Failed'} - ${joinResult.message}`);

        // 5. Test Private Group Join Request
        console.log('\n5. 🔐 Testing Private Group Join Requests');
        const requestResult = await requestToJoinGroup(privateGroup!.$id, NON_MEMBER_ID);
        if (requestResult) {
            console.log('✅ Join request sent for private group');

            // Get pending requests
            const pendingRequests = await getGroupJoinRequests(privateGroup!.$id, OWNER_ID);
            console.log(`   Pending requests: ${pendingRequests.length}`);

            if (pendingRequests.length > 0) {
                // Test approval
                const approved = await approveJoinRequest(pendingRequests[0].$id, OWNER_ID);
                console.log(`   Request approval: ${approved ? 'Success' : 'Failed'}`);
            }
        }

        // 6. Test Role Management
        console.log('\n6. ⚡ Testing Role Management');

        // Try to promote member to admin (only owner can do this)
        const promoted = await updateGroupMemberRole(publicGroup!.$id, MEMBER_ID, 'admin', OWNER_ID);
        console.log(`   Member promotion to admin: ${promoted ? 'Success' : 'Failed'}`);

        // Try to demote admin (only owner can do this)
        const demoted = await updateGroupMemberRole(publicGroup!.$id, ADMIN_ID, 'member', OWNER_ID);
        console.log(`   Admin demotion to member: ${demoted ? 'Success' : 'Failed'}`);

        // 7. Test Member Management
        console.log('\n7. 👥 Testing Member Management');

        const members = await getGroupMembers(publicGroup!.$id);
        console.log(`   Public group members: ${members.length}`);
        members.forEach(member => {
            console.log(`   - ${member.firstName} ${member.lastName} (${member.role})`);
        });

        // 8. Test Ban Functionality
        console.log('\n8. 🚫 Testing Ban Functionality');
        const banned = await banGroupMember(publicGroup!.$id, MEMBER_ID, OWNER_ID);
        console.log(`   Member ban: ${banned ? 'Success' : 'Failed'}`);

        // 9. Test Group Discovery
        console.log('\n9. 🔍 Testing Group Discovery');
        const discoverableGroups = await getDiscoverableGroups();
        console.log(`   Discoverable groups: ${discoverableGroups.length}`);
        discoverableGroups.forEach(group => {
            console.log(`   - ${group.title} (${group.isPrivate ? 'Private' : 'Public'}, ${group.memberCount} members)`);
        });

        // 10. Test Group Deletion (Owner Only)
        console.log('\n10. 🗑️ Testing Group Deletion');
        const publicDeleted = await deleteGroup(publicGroup!.$id, OWNER_ID);
        const privateDeleted = await deleteGroup(privateGroup!.$id, OWNER_ID);
        console.log(`   Public group deletion: ${publicDeleted ? 'Success' : 'Failed'}`);
        console.log(`   Private group deletion: ${privateDeleted ? 'Success' : 'Failed'}`);

        console.log('\n✅ GROUP ROLE SYSTEM TEST COMPLETED');
        console.log('='.repeat(50));

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Comprehensive Role Summary
console.log(`
📋 GROUP ROLE SYSTEM SUMMARY
=============================================================================

🔑 ROLES:
- Owner: Group creator, can do everything, cannot be demoted or banned
- Admin: Can manage members, post events, ban users, change description  
- Member: Can view group, attend events, invite other users

🔒 PERMISSIONS:
┌─────────────────┬───────┬───────┬────────┐
│ ACTION          │ OWNER │ ADMIN │ MEMBER │
├─────────────────┼───────┼───────┼────────┤
│ View Group      │   ✅   │   ✅   │   ✅    │
│ Post Events     │   ✅   │   ✅   │   ❌    │
│ Invite Users    │   ✅   │   ✅   │   ✅    │
│ Manage Members  │   ✅   │   ✅   │   ❌    │
│ Manage Group    │   ✅   │   ✅   │   ❌    │
│ Delete Group    │   ✅   │   ❌   │   ❌    │
│ Promote/Demote  │   ✅   │   ❌   │   ❌    │
│ Ban Members     │   ✅   │   ✅   │   ❌    │
└─────────────────┴───────┴───────┴────────┘

🌐 GROUP TYPES:
- Public: Anyone can discover and join directly
- Private: Discoverable but requires join request approval

🔧 KEY FEATURES:
- Junction table architecture for scalability
- Role-based permission system
- Private group join request workflow  
- Comprehensive admin panel with tabs
- Real-time membership checking
- Owner protection (cannot be banned/demoted)

=============================================================================
`);

// Run the test
testGroupRoleSystem().catch(console.error);
