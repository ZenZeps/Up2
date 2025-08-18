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
