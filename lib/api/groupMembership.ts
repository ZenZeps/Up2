/**
 * UPDATED GROUP MEMBERSHIP API - Junction Table Implementation
 * 
 * This file implements enterprise-scale group functionality using the
 * groupMemberships junction table instead of array-based relationships.
 */

import { config, databases } from "@/lib/appwrite/appwrite";
import { ID, Query } from "react-native-appwrite";
import { authDebug } from "../debug/authDebug";
import { cacheManager } from "../debug/cacheManager";

// Cache constants
const GROUP_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const GROUP_MEMBERSHIP_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Add user to group (junction table approach)
 */
export async function addGroupMember(
    groupId: string,
    userId: string,
    role: string = 'member',
    invitedBy?: string
): Promise<boolean> {
    try {
        // Check if membership already exists
        const existingMembership = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!, // Add this to your config
            [
                Query.equal('groupId', groupId),
                Query.equal('userId', userId),
                Query.limit(1)
            ]
        );

        if (existingMembership.documents.length > 0) {
            const membership = existingMembership.documents[0];
            if (membership.status === 'active') {
                authDebug.info(`User ${userId} already member of group ${groupId}`);
                return true;
            } else if (membership.status === 'left' || membership.status === 'invited') {
                // Reactivate membership
                await databases.updateDocument(
                    config.databaseID!,
                    config.groupMembershipsCollectionID!,
                    membership.$id,
                    {
                        status: 'active',
                        role: role,
                        joinedAt: new Date().toISOString(),
                        acceptedAt: new Date().toISOString()
                    }
                );
                authDebug.info(`Reactivated membership for user ${userId} in group ${groupId}`);

                // Update group member count
                await updateGroupMemberCount(groupId);
                return true;
            }
        }

        // Create new membership
        await databases.createDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            ID.unique(),
            {
                groupId,
                userId,
                role,
                status: 'active',
                joinedAt: new Date().toISOString(),
                acceptedAt: new Date().toISOString(),
                invitedBy: invitedBy || null
            }
        );

        // Update group member count and last activity
        await updateGroupMemberCount(groupId);
        await updateGroupActivity(groupId);

        authDebug.info(`User ${userId} added to group ${groupId} as ${role}`);

        // Clear relevant caches
        cacheManager.remove(`user-groups-${userId}`);
        cacheManager.remove(`group-members-${groupId}`);

        return true;
    } catch (error) {
        authDebug.error(`Failed to add member to group: ${groupId}`, error);
        return false;
    }
}

/**
 * Remove user from group (junction table approach)
 */
export async function removeGroupMember(groupId: string, userId: string): Promise<boolean> {
    try {
        // Find membership record
        const membershipRecords = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            [
                Query.equal('groupId', groupId),
                Query.equal('userId', userId),
                Query.equal('status', 'active')
            ]
        );

        if (membershipRecords.documents.length === 0) {
            authDebug.info(`User ${userId} not member of group ${groupId}`);
            return true;
        }

        // Update membership status to 'left'
        for (const record of membershipRecords.documents) {
            await databases.updateDocument(
                config.databaseID!,
                config.groupMembershipsCollectionID!,
                record.$id,
                {
                    status: 'left',
                    leftAt: new Date().toISOString()
                }
            );
        }

        // Update group member count
        await updateGroupMemberCount(groupId);

        authDebug.info(`User ${userId} removed from group ${groupId}`);

        // Clear relevant caches
        cacheManager.remove(`user-groups-${userId}`);
        cacheManager.remove(`group-members-${groupId}`);

        return true;
    } catch (error) {
        authDebug.error(`Failed to remove member from group: ${groupId}`, error);
        return false;
    }
}

/**
 * Get all groups a user belongs to (junction table approach)
 */
export async function getUserGroups(userId: string, limit: number = 50): Promise<any[]> {
    try {
        const cacheKey = `user-groups-${userId}`;
        const cached = cacheManager.get<any[]>(cacheKey);
        if (cached) {
            authDebug.debug(`Returning cached user groups for: ${userId}`);
            return cached;
        }

        // Get active memberships for user
        const membershipRecords = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            [
                Query.equal('userId', userId),
                Query.equal('status', 'active'),
                Query.limit(limit),
                Query.orderDesc('joinedAt')
            ]
        );

        if (membershipRecords.documents.length === 0) {
            return [];
        }

        // Get group details for each membership
        const groupIds = membershipRecords.documents.map((membership: any) => membership.groupId);
        const groupPromises = groupIds.map(async (groupId: string) => {
            try {
                return await databases.getDocument(
                    config.databaseID!,
                    config.groupsCollectionID!,
                    groupId
                );
            } catch (error) {
                authDebug.warn(`Failed to fetch group ${groupId}:`, error);
                return null;
            }
        });

        const groupResults = await Promise.all(groupPromises);
        const groups = groupResults.filter(group => group !== null);

        // Add membership details to each group
        const enrichedGroups = groups.map(group => {
            const membership = membershipRecords.documents.find(
                (m: any) => m.groupId === group.$id
            );
            return {
                ...group,
                memberRole: membership?.role || 'member',
                joinedAt: membership?.joinedAt,
                memberCount: group.memberCount || 0
            };
        });

        // Cache the results
        cacheManager.set(cacheKey, enrichedGroups, GROUP_MEMBERSHIP_CACHE_TTL);

        return enrichedGroups;
    } catch (error) {
        authDebug.error(`Failed to get user groups for: ${userId}`, error);
        return [];
    }
}

/**
 * Get all members of a group (junction table approach)
 */
export async function getGroupMembers(groupId: string, limit: number = 100): Promise<any[]> {
    try {
        const cacheKey = `group-members-${groupId}`;
        const cached = cacheManager.get<any[]>(cacheKey);
        if (cached) {
            authDebug.debug(`Returning cached group members for: ${groupId}`);
            return cached;
        }

        // Get active memberships for group
        const membershipRecords = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            [
                Query.equal('groupId', groupId),
                Query.equal('status', 'active'),
                Query.limit(limit),
                Query.orderDesc('joinedAt')
            ]
        );

        const memberIds = membershipRecords.documents.map((membership: any) => membership.userId);

        if (memberIds.length === 0) {
            return [];
        }

        // Get user profiles for each member
        const { getUsersByIds } = await import('./user');
        const userProfiles = await getUsersByIds(memberIds);

        // Combine user profiles with membership details
        const membersWithRoles = userProfiles.map(user => {
            const membership = membershipRecords.documents.find(
                (m: any) => m.userId === user.$id
            );
            return {
                ...user,
                role: membership?.role || 'member',
                joinedAt: membership?.joinedAt,
                invitedBy: membership?.invitedBy
            };
        });

        // Cache the results
        cacheManager.set(cacheKey, membersWithRoles, GROUP_MEMBERSHIP_CACHE_TTL);

        return membersWithRoles;
    } catch (error) {
        authDebug.error(`Failed to get group members for: ${groupId}`, error);
        return [];
    }
}

/**
 * Update group member count (denormalized counter)
 */
async function updateGroupMemberCount(groupId: string): Promise<void> {
    try {
        // Count active members
        const membershipCount = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            [
                Query.equal('groupId', groupId),
                Query.equal('status', 'active'),
                Query.limit(1000) // Reasonable limit for counting
            ]
        );

        // Update group with current member count
        await databases.updateDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId,
            {
                memberCount: membershipCount.documents.length,
                lastActivityAt: new Date().toISOString()
            }
        );

        authDebug.debug(`Updated member count for group ${groupId}: ${membershipCount.documents.length}`);
    } catch (error) {
        authDebug.error(`Failed to update member count for group: ${groupId}`, error);
    }
}

/**
 * Update group last activity timestamp
 */
async function updateGroupActivity(groupId: string): Promise<void> {
    try {
        await databases.updateDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId,
            {
                lastActivityAt: new Date().toISOString()
            }
        );
    } catch (error) {
        authDebug.error(`Failed to update group activity: ${groupId}`, error);
    }
}

/**
 * Check if user is member of group
 */
export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
    try {
        const membershipRecords = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            [
                Query.equal('groupId', groupId),
                Query.equal('userId', userId),
                Query.equal('status', 'active'),
                Query.limit(1)
            ]
        );

        return membershipRecords.documents.length > 0;
    } catch (error) {
        authDebug.error(`Failed to check group membership: ${groupId}/${userId}`, error);
        return false;
    }
}

/**
 * Get user's role in group
 */
export async function getGroupMemberRole(groupId: string, userId: string): Promise<string | null> {
    try {
        const membershipRecords = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            [
                Query.equal('groupId', groupId),
                Query.equal('userId', userId),
                Query.equal('status', 'active'),
                Query.limit(1)
            ]
        );

        if (membershipRecords.documents.length === 0) {
            return null;
        }

        return membershipRecords.documents[0].role || 'member';
    } catch (error) {
        authDebug.error(`Failed to get member role: ${groupId}/${userId}`, error);
        return null;
    }
}

/**
 * Update user's role in group (Admin/Owner only)
 */
export async function updateGroupMemberRole(
    groupId: string,
    userId: string,
    newRole: 'member' | 'admin',
    updatedBy: string
): Promise<boolean> {
    try {
        // Check if the person updating has permission (must be owner or admin)
        const updaterRole = await getGroupMemberRole(groupId, updatedBy);
        if (!updaterRole || !['owner', 'admin'].includes(updaterRole)) {
            authDebug.warn(`User ${updatedBy} attempted to update role without permission`);
            return false;
        }

        // Get group to check owner
        const group = await databases.getDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId
        );

        // Only owner can demote admins or change owner role
        if (updaterRole === 'admin' && group.creatorId !== updatedBy) {
            const targetRole = await getGroupMemberRole(groupId, userId);
            if (targetRole === 'admin' || userId === group.creatorId) {
                authDebug.warn(`Admin ${updatedBy} attempted to modify admin/owner role`);
                return false;
            }
        }

        // Find membership record
        const membershipRecords = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            [
                Query.equal('groupId', groupId),
                Query.equal('userId', userId),
                Query.equal('status', 'active'),
                Query.limit(1)
            ]
        );

        if (membershipRecords.documents.length === 0) {
            authDebug.warn(`User ${userId} not found in group ${groupId}`);
            return false;
        }

        // Update the role
        await databases.updateDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            membershipRecords.documents[0].$id,
            {
                role: newRole,
                updatedAt: new Date().toISOString()
            }
        );

        // Clear caches
        cacheManager.remove(`group-members-${groupId}`);
        cacheManager.remove(`user-groups-${userId}`);

        authDebug.info(`User ${userId} role updated to ${newRole} in group ${groupId} by ${updatedBy}`);
        return true;
    } catch (error) {
        authDebug.error(`Failed to update member role: ${groupId}/${userId}`, error);
        return false;
    }
}

/**
 * Ban user from group (Admin/Owner only)
 */
export async function banGroupMember(
    groupId: string,
    userId: string,
    bannedBy: string
): Promise<boolean> {
    try {
        // Check permissions
        const bannerRole = await getGroupMemberRole(groupId, bannedBy);
        if (!bannerRole || !['owner', 'admin'].includes(bannerRole)) {
            authDebug.warn(`User ${bannedBy} attempted to ban without permission`);
            return false;
        }

        // Get group to check owner
        const group = await databases.getDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId
        );

        // Cannot ban the owner
        if (userId === group.creatorId) {
            authDebug.warn(`Attempted to ban group owner ${userId}`);
            return false;
        }

        // Admins cannot ban other admins (only owner can)
        if (bannerRole === 'admin' && group.creatorId !== bannedBy) {
            const targetRole = await getGroupMemberRole(groupId, userId);
            if (targetRole === 'admin') {
                authDebug.warn(`Admin ${bannedBy} attempted to ban another admin`);
                return false;
            }
        }

        // Find membership record
        const membershipRecords = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            [
                Query.equal('groupId', groupId),
                Query.equal('userId', userId),
                Query.equal('status', 'active'),
                Query.limit(1)
            ]
        );

        if (membershipRecords.documents.length === 0) {
            authDebug.warn(`User ${userId} not found in group ${groupId}`);
            return false;
        }

        // Update status to banned
        await databases.updateDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            membershipRecords.documents[0].$id,
            {
                status: 'banned',
                bannedBy: bannedBy,
                bannedAt: new Date().toISOString()
            }
        );

        // Update group member count
        await updateGroupMemberCount(groupId);

        // Clear caches
        cacheManager.remove(`group-members-${groupId}`);
        cacheManager.remove(`user-groups-${userId}`);

        authDebug.info(`User ${userId} banned from group ${groupId} by ${bannedBy}`);
        return true;
    } catch (error) {
        authDebug.error(`Failed to ban member: ${groupId}/${userId}`, error);
        return false;
    }
}

/**
 * Check if user has permission to perform action in group
 */
export async function checkGroupPermission(
    groupId: string,
    userId: string,
    action: 'view' | 'post_events' | 'invite_users' | 'manage_members' | 'manage_group' | 'delete_group'
): Promise<boolean> {
    try {
        // Get group details
        const group = await databases.getDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId
        );

        // Get user's role in group
        const userRole = await getGroupMemberRole(groupId, userId);
        const isOwner = group.creatorId === userId;
        const isAdmin = userRole === 'admin' || isOwner;
        const isMember = userRole === 'member' || isAdmin;

        switch (action) {
            case 'view':
                // Public groups: anyone can view
                // Private groups: only members can view
                return !group.isPrivate || isMember;

            case 'post_events':
                // Only admins and owners can post events
                return isAdmin;

            case 'invite_users':
                // All members can invite users
                return isMember;

            case 'manage_members':
                // Only admins and owners can manage members (approve requests, ban users)
                return isAdmin;

            case 'manage_group':
                // Only admins and owners can change group description, settings
                return isAdmin;

            case 'delete_group':
                // Only owner can delete group
                return isOwner;

            default:
                return false;
        }
    } catch (error) {
        authDebug.error(`Failed to check permission: ${groupId}/${userId}/${action}`, error);
        return false;
    }
}

/**
 * Request to join private group
 */
export async function requestToJoinGroup(
    groupId: string,
    userId: string
): Promise<boolean> {
    try {
        // Check if group is private
        const group = await databases.getDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId
        );

        if (!group.isPrivate) {
            authDebug.warn(`Attempted to request join for public group ${groupId}`);
            return false;
        }

        // Check if user already has a membership record
        const existingMembership = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            [
                Query.equal('groupId', groupId),
                Query.equal('userId', userId),
                Query.limit(1)
            ]
        );

        if (existingMembership.documents.length > 0) {
            const membership = existingMembership.documents[0];
            if (membership.status === 'active') {
                authDebug.info(`User ${userId} already member of group ${groupId}`);
                return false;
            } else if (membership.status === 'requested' || membership.status === 'invited') {
                authDebug.info(`User ${userId} already has pending request/invite for group ${groupId}`);
                return false;
            } else if (membership.status === 'banned') {
                authDebug.warn(`Banned user ${userId} attempted to request join group ${groupId}`);
                return false;
            }
        }

        // Create join request as an 'invited' membership record so it uses
        // the unified groupMemberships collection semantics. We set invitedBy
        // to the requester so owners/admins can see who requested to join.
        const membershipId = ID.unique();
        await databases.createDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            membershipId,
            {
                groupId,
                userId,
                role: 'member',
                status: 'invited',
                invitedBy: userId,
                invitedAt: new Date().toISOString(),
                requestedAt: new Date().toISOString()
            }
        );

        authDebug.info(`User ${userId} requested to join private group ${groupId} (created invited membership ${membershipId})`);

        // Notify the group owner that someone requested to join
        try {
            const { sendGroupJoinRequestNotification } = await import('@/lib/notifications/notificationUtils');
            // Get requester profile for friendly name
            const { getUserProfile } = await import('./user');
            const requesterProfile = await getUserProfile(userId);
            const requesterName = requesterProfile ? `${requesterProfile.firstName || ''} ${requesterProfile.lastName || ''}`.trim() : 'Someone';

            // Get group to obtain creatorId and title
            const group = await databases.getDocument(config.databaseID!, config.groupsCollectionID!, groupId);
            const ownerId = group.creatorId;
            const groupTitle = group.title || 'your group';

            // Send join request notification to owner
            await sendGroupJoinRequestNotification(ownerId, requesterName || 'Someone', userId, groupTitle, groupId);
        } catch (notifyErr) {
            authDebug.warn('Failed to send join request notification', notifyErr);
        }

        return true;
    } catch (error) {
        authDebug.error(`Failed to request join: ${groupId}/${userId}`, error);
        return false;
    }
}

/**
 * Get pending join requests for a group (Admin/Owner only)
 */
export async function getGroupJoinRequests(groupId: string, requesterId: string): Promise<any[]> {
    try {
        // Check permissions
        const hasPermission = await checkGroupPermission(groupId, requesterId, 'manage_members');
        if (!hasPermission) {
            authDebug.warn(`User ${requesterId} attempted to view join requests without permission`);
            return [];
        }

        // Get pending requests
        const requests = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            [
                Query.and([
                    Query.equal('groupId', groupId),
                    Query.or([
                        Query.equal('status', 'requested'),
                        Query.equal('status', 'invited')
                    ])
                ]),
                Query.orderDesc('requestedAt')
            ]
        );

        // Enrich with user details
        if (requests.documents.length === 0) {
            return [];
        }

        const userIds = requests.documents.map((req: any) => req.userId);
        const { getUsersByIds } = await import('./user');
        const userProfiles = await getUsersByIds(userIds);

        const enrichedRequests = requests.documents.map((request: any) => {
            const userProfile = userProfiles.find(user => user.$id === request.userId);
            return {
                ...request,
                user: userProfile
            };
        });

        return enrichedRequests;
    } catch (error) {
        authDebug.error(`Failed to get join requests: ${groupId}`, error);
        return [];
    }
}

/**
 * Approve join request for private group (Admin/Owner only)
 */
export async function approveJoinRequest(
    membershipId: string,
    approvedBy: string
): Promise<boolean> {
    try {
        // Get the membership request
        const membership = await databases.getDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            membershipId
        );

        // Check permissions
        const hasPermission = await checkGroupPermission(membership.groupId, approvedBy, 'manage_members');
        if (!hasPermission) {
            authDebug.warn(`User ${approvedBy} attempted to approve request without permission`);
            return false;
        }

        // Update status to active
        await databases.updateDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            membershipId,
            {
                status: 'active',
                joinedAt: new Date().toISOString(),
                approvedBy: approvedBy,
                approvedAt: new Date().toISOString()
            }
        );

        // Update group member count
        await updateGroupMemberCount(membership.groupId);

        // Clear caches
        cacheManager.remove(`group-members-${membership.groupId}`);
        cacheManager.remove(`user-groups-${membership.userId}`);

        authDebug.info(`Join request ${membershipId} approved by ${approvedBy}`);
        return true;
    } catch (error) {
        authDebug.error(`Failed to approve join request: ${membershipId}`, error);
        return false;
    }
}

/**
 * Reject join request for private group (Admin/Owner only)
 */
export async function rejectJoinRequest(
    membershipId: string,
    rejectedBy: string
): Promise<boolean> {
    try {
        // Get the membership request
        const membership = await databases.getDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            membershipId
        );

        // Check permissions
        const hasPermission = await checkGroupPermission(membership.groupId, rejectedBy, 'manage_members');
        if (!hasPermission) {
            authDebug.warn(`User ${rejectedBy} attempted to reject request without permission`);
            return false;
        }

        // Delete the request
        await databases.deleteDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            membershipId
        );

        authDebug.info(`Join request ${membershipId} rejected by ${rejectedBy}`);
        return true;
    } catch (error) {
        authDebug.error(`Failed to reject join request: ${membershipId}`, error);
        return false;
    }
}

/**
 * UNIFIED INVITE SYSTEM - Using GroupMemberships Collection Only
 * Eliminates the need for a separate group invites collection
 */

/**
 * Send group invite by creating membership with 'invited' status
 */
export async function sendGroupInvite(
    groupId: string,
    fromUserId: string,
    toUserId: string
): Promise<boolean> {
    try {
        console.log(`sendGroupInvite: User ${fromUserId} inviting ${toUserId} to group ${groupId}`);

        // Check if invite/membership already exists
        const existingMembership = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            [
                Query.equal('groupId', groupId),
                Query.equal('userId', toUserId),
                Query.limit(1)
            ]
        );

        if (existingMembership.documents.length > 0) {
            const membership = existingMembership.documents[0];
            if (membership.status === 'active') {
                console.log('User is already a group member');
                return false;
            } else if (membership.status === 'invited') {
                console.log('User already has a pending invite');
                return false;
            }
        }

        // Create new invite (membership with 'invited' status)
        await databases.createDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            ID.unique(),
            {
                groupId,
                userId: toUserId,
                role: 'member',
                status: 'invited',
                invitedBy: fromUserId,
                invitedAt: new Date().toISOString(),
                joinedAt: null
            }
        );

        console.log('Group invite sent successfully');

        // Clear relevant caches
        cacheManager.remove(`group_members_${groupId}`);
        cacheManager.remove(`user_groups_${toUserId}`);

        return true;
    } catch (error) {
        console.error('Error sending group invite:', error);
        return false;
    }
}

/**
 * Get pending group invites for a user
 */
export async function getUserGroupInvites(userId: string) {
    try {
        const cacheKey = `user_invites_${userId}`;
        const cached = cacheManager.get(cacheKey);
        if (cached) {
            console.log(`getUserGroupInvites: Using cached invites for user ${userId}`);
            return cached;
        }

        const invites = await databases.listDocuments(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            [
                Query.equal('userId', userId),
                Query.equal('status', 'invited'),
                Query.orderDesc('$createdAt')
            ]
        );

        console.log(`getUserGroupInvites: Found ${invites.documents.length} invites for user ${userId}`);

        // Cache the results
        cacheManager.set(cacheKey, invites.documents, GROUP_MEMBERSHIP_CACHE_TTL);

        return invites.documents;
    } catch (error) {
        console.error('Error fetching group invites:', error);
        return [];
    }
}

/**
 * Accept a group invite by updating status to 'active'
 */
export async function acceptGroupInvite(membershipId: string): Promise<boolean> {
    try {
        await databases.updateDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            membershipId,
            {
                status: 'active',
                joinedAt: new Date().toISOString()
            }
        );

        // Get the membership to clear relevant caches
        const membership = await databases.getDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            membershipId
        );

        // Clear relevant caches
        cacheManager.remove(`group_members_${membership.groupId}`);
        cacheManager.remove(`user_groups_${membership.userId}`);
        cacheManager.remove(`user_invites_${membership.userId}`);

        return true;
    } catch (error) {
        console.error('Error accepting group invite:', error);
        return false;
    }
}

/**
 * Decline a group invite by deleting the membership record
 */
export async function declineGroupInvite(membershipId: string): Promise<boolean> {
    try {
        // Get the membership to clear relevant caches
        const membership = await databases.getDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            membershipId
        );

        await databases.deleteDocument(
            config.databaseID!,
            config.groupMembershipsCollectionID!,
            membershipId
        );

        // Clear relevant caches
        cacheManager.remove(`user_invites_${membership.userId}`);

        return true;
    } catch (error) {
        console.error('Error declining group invite:', error);
        return false;
    }
}
