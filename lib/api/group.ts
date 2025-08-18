import { Group } from '@/lib/types/Groups';
import { ID, Query } from 'react-native-appwrite';
import { config, databases } from '../appwrite/appwrite';
import { addGroupMember, getGroupMembers, getUserGroups as getJunctionUserGroups, removeGroupMember } from './groupMembership';

/**
 * Get all groups that a user belongs to
 * UPDATED: Now uses junction table for scalability
 */
export const getUserGroups = async (userId: string, limit: number = 50): Promise<Group[]> => {
    try {
        console.log(`getUserGroups: Fetching groups for user ${userId} using junction table`);

        // Use the new junction table implementation
        const groups = await getJunctionUserGroups(userId, limit);

        console.log(`getUserGroups: Found ${groups.length} groups for user ${userId} via junction table`);

        return groups as Group[];
    } catch (error) {
        console.error('Error fetching user groups via junction table:', error);

        // Fallback to old implementation if junction table fails
        console.log('Falling back to legacy group fetching...');
        return await getUserGroupsLegacy(userId, limit);
    }
};

/**
 * Legacy implementation as fallback
 * SCALABILITY OPTIMIZED: Uses pagination and limits to handle 100k+ users
 */
const getUserGroupsLegacy = async (userId: string, limit: number = 50): Promise<Group[]> => {
    try {
        // Get groups where user is the creator (this can be queried directly)
        const creatorGroups = await databases.listDocuments(
            config.databaseID!,
            config.groupsCollectionID!,
            [
                Query.equal('creatorId', userId),
                Query.limit(Math.floor(limit / 2)), // Split limit between creator and member groups
                Query.orderDesc('$createdAt')
            ]
        );

        // CRITICAL SCALABILITY FIX: Instead of loading ALL groups, we'll use a workaround
        // Since Appwrite doesn't support direct member queries, we'll limit the search scope
        // This is much better than loading unlimited groups which would crash with scale
        const recentGroups = await databases.listDocuments(
            config.databaseID!,
            config.groupsCollectionID!,
            [
                Query.limit(500), // EMERGENCY LIMIT: Only check recent 500 groups instead of ALL
                Query.orderDesc('$createdAt'), // Most recent first - users likely in recent groups
                Query.notEqual('creatorId', userId) // Exclude groups user created
            ]
        );

        // Filter groups where the user is a member but not the creator
        const memberGroups = recentGroups.documents.filter((group: any) => {
            if (!group.users || group.creatorId === userId) {
                return false; // Skip if no users or user is already creator
            }

            // Handle different possible formats of the users relationship
            if (Array.isArray(group.users)) {
                return group.users.some((user: any) => {
                    if (typeof user === 'string') {
                        return user === userId;
                    } else if (user && user.$id) {
                        return user.$id === userId;
                    }
                    return false;
                });
            }

            return false;
        }).slice(0, Math.ceil(limit / 2)); // Take only half the limit for member groups

        // Combine creator groups and member groups
        const allUserGroups = [
            ...creatorGroups.documents,
            ...memberGroups
        ];

        console.log(`getUserGroups: Found ${allUserGroups.length} groups for user ${userId} (${creatorGroups.documents.length} created, ${memberGroups.length} member)`);

        return allUserGroups as unknown as Group[];
    } catch (error) {
        console.error('Error fetching user groups:', error);
        return [];
    }
};

/**
 * Get group details by ID
 * UPDATED: Now uses junction table for member information
 */
export const getGroupById = async (groupId: string): Promise<Group | null> => {
    try {
        const response = await databases.getDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId
        );

        // Get member count and member list from junction table
        let memberCount = response.memberCount || 0;
        let members: any[] = [];

        try {
            // Try to get members from junction table
            members = await getGroupMembers(groupId, 100);
            memberCount = members.length;
        } catch (error) {
            console.warn(`Could not load members from junction table for group ${groupId}:`, error);
            // Fallback to legacy users array
            members = response.users || [];
            memberCount = members.length;
        }

        return {
            $id: response.$id,
            id: response.id || response.$id,
            title: response.title,
            description: response.description || '',
            creatorId: response.creatorId,
            isPrivate: !response.isPublic, // Convert isPublic to isPrivate for app logic
            users: members, // Now populated from junction table
            events: response.events || [],
            memberCount: memberCount, // Accurate count from junction table
            $createdAt: response.$createdAt,
            $updatedAt: response.$updatedAt,
        } as Group;
    } catch (error) {
        console.error('Error fetching group:', error);
        return null;
    }
};

/**
 * Create a new group
 */
export const createGroup = async (
    title: string,
    creatorId: string,
    members?: string[],
    isPrivate: boolean = false,
    description?: string
): Promise<Group | null> => {
    try {
        console.log(`createGroup: Creating group "${title}" by user ${creatorId}`);

        const groupId = ID.unique();

        // Create the group document first (without users array for new system)
        const response = await databases.createDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId,
            {
                title,
                description: description || '',
                creatorId,
                isPublic: !isPrivate, // Database only has isPublic field
                memberCount: 0, // Will be updated by junction table operations
                lastActivityAt: new Date().toISOString()
            }
        );

        // Add creator and members to junction table
        const allMembers = Array.from(new Set([creatorId, ...(members || [])]));

        try {
            // Add creator as admin/owner
            await addGroupMember(groupId, creatorId, 'admin');

            // Add other members as regular members
            for (const memberId of members || []) {
                if (memberId !== creatorId) {
                    await addGroupMember(groupId, memberId, 'member');
                }
            }

            console.log(`createGroup: Group "${title}" created successfully with ${allMembers.length} members`);
        } catch (memberError) {
            console.warn('Error adding members to junction table, falling back to legacy method:', memberError);

            // Fallback: Update the group document with users array
            await databases.updateDocument(
                config.databaseID!,
                config.groupsCollectionID!,
                groupId,
                {
                    users: allMembers
                }
            );
        }

        return response as unknown as Group;
    } catch (error) {
        console.error('Error creating group:', error);
        // Re-throw the error so the calling component can handle it properly
        throw error;
    }
};

/**
 * Remove user from group
 */
export const removeUserFromGroup = async (groupId: string, userId: string): Promise<boolean> => {
    try {
        console.log(`removeUserFromGroup: Removing user ${userId} from group ${groupId}`);

        // Use junction table to remove user
        const success = await removeGroupMember(groupId, userId);

        if (success) {
            console.log(`removeUserFromGroup: User ${userId} successfully removed from group ${groupId}`);
        } else {
            console.error(`removeUserFromGroup: Failed to remove user ${userId} from group ${groupId}`);
        }

        return success;
    } catch (error) {
        console.error('Error removing user from group:', error);
        // Fallback to legacy implementation
        return await removeUserFromGroupLegacy(groupId, userId);
    }
};

/**
 * Legacy remove user from group implementation as fallback
 */
const removeUserFromGroupLegacy = async (groupId: string, userId: string): Promise<boolean> => {
    try {
        const group = await getGroupById(groupId);
        if (!group) return false;

        const currentUsers = group.users || [];
        const updatedUsers = currentUsers.filter(id => id !== userId);

        await databases.updateDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId,
            {
                users: updatedUsers
            }
        );
        return true;
    } catch (error) {
        console.error('Error removing user from group (legacy):', error);
        return false;
    }
};

/**
 * Get all groups in the system
 */
export const getAllGroups = async (): Promise<Group[]> => {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.groupsCollectionID!
        );

        return response.documents.map(doc => ({
            $id: doc.$id,
            id: doc.id || doc.$id,
            title: doc.title,
            description: doc.description || '',
            creatorId: doc.creatorId,
            isPrivate: !doc.isPublic, // Convert isPublic to isPrivate for app logic
            users: doc.users || [],
            events: doc.events || [],
            memberCount: (doc.users || []).length,
            $createdAt: doc.$createdAt,
            $updatedAt: doc.$updatedAt,
        }));
    } catch (error) {
        console.error('Error fetching all groups:', error);
        return [];
    }
};

/**
 * Get all public groups for discovery - Optimized for explore page
 * UPDATED: Uses junction table for accurate member counts but doesn't load full profiles
 */
export const getPublicGroups = async (): Promise<Group[]> => {
    try {
        console.log('getPublicGroups: Fetching public groups with optimized member counts');
        console.log('getPublicGroups: Database ID:', config.databaseID);
        console.log('getPublicGroups: Collection ID:', config.groupsCollectionID);

        const response = await databases.listDocuments(
            config.databaseID!,
            config.groupsCollectionID!,
            [Query.equal('isPublic', true)] // Use isPublic field that database expects
        );

        console.log(`getPublicGroups: Found ${response.documents.length} public groups`);

        // For explore page, we only need accurate member counts, not full profiles
        const groupsWithMemberCounts = response.documents.map(doc => {
            return {
                $id: doc.$id,
                id: doc.id || doc.$id,
                title: doc.title,
                description: doc.description || '',
                creatorId: doc.creatorId,
                isPrivate: !doc.isPublic, // Database uses isPublic, convert to app logic
                users: doc.users || [], // Keep legacy for membership checks
                events: doc.events || [],
                memberCount: doc.memberCount || (doc.users || []).length, // Use denormalized count
                $createdAt: doc.$createdAt,
                $updatedAt: doc.$updatedAt,
            } as Group;
        });

        return groupsWithMemberCounts;
    } catch (error) {
        console.error('Error fetching public groups:', error);
        console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof Error && 'code' in error ? error.code : 'Unknown code',
            type: error instanceof Error && 'type' in error ? error.type : 'Unknown type'
        });

        // Re-throw the error so the UI can handle it properly
        throw error;
    }
};

/**
 * Search public groups by title - Optimized for explore page
 * UPDATED: Uses denormalized member counts for performance
 */
export const searchPublicGroups = async (searchTerm: string): Promise<Group[]> => {
    try {
        console.log(`searchPublicGroups: Searching for "${searchTerm}"`);

        // Try full-text search first
        let response;
        try {
            response = await databases.listDocuments(
                config.databaseID!,
                config.groupsCollectionID!,
                [
                    Query.equal('isPublic', true),
                    Query.search('title', searchTerm)
                ]
            );
            console.log(`searchPublicGroups: Full-text search found ${response.documents.length} groups`);
        } catch (searchError) {
            console.log('searchPublicGroups: Full-text search failed, falling back to contains search');
            // Fallback: Get all public groups and filter client-side
            response = await databases.listDocuments(
                config.databaseID!,
                config.groupsCollectionID!,
                [Query.equal('isPublic', true)]
            );

            // Filter client-side for partial matches
            const searchLower = searchTerm.toLowerCase();
            response.documents = response.documents.filter(doc =>
                doc.title?.toLowerCase().includes(searchLower) ||
                doc.description?.toLowerCase().includes(searchLower)
            );

            console.log(`searchPublicGroups: Client-side search found ${response.documents.length} groups`);
        }

        // For search results, use the optimized approach without loading full profiles
        const searchResults = response.documents.map(doc => {
            return {
                $id: doc.$id,
                id: doc.id || doc.$id,
                title: doc.title,
                description: doc.description || '',
                creatorId: doc.creatorId,
                isPrivate: !doc.isPublic, // Database uses isPublic, convert to app logic
                users: doc.users || [], // Keep legacy for membership checks
                events: doc.events || [],
                memberCount: doc.memberCount || (doc.users || []).length, // Use denormalized count
                $createdAt: doc.$createdAt,
                $updatedAt: doc.$updatedAt,
            } as Group;
        });

        return searchResults;
    } catch (error) {
        console.error('Error searching public groups:', error);
        console.error('Search error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            searchTerm
        });

        // Return empty array instead of throwing to allow UI fallback
        return [];
    }
};

/**
 * Join a public group
 */
export const joinGroup = async (groupId: string, userId: string): Promise<boolean> => {
    try {
        console.log(`joinGroup: User ${userId} attempting to join group ${groupId}`);

        const group = await getGroupById(groupId);
        if (!group) {
            console.error('Group not found');
            return false;
        }

        // Check if group is public
        if (group.isPrivate) {
            console.error('Cannot join private group without invitation');
            return false;
        }

        // Use junction table to add user
        const success = await addGroupMember(groupId, userId, 'member');

        if (success) {
            console.log(`joinGroup: User ${userId} successfully joined group ${groupId}`);
        } else {
            console.error(`joinGroup: Failed to add user ${userId} to group ${groupId}`);
        }

        return success;
    } catch (error) {
        console.error('Error joining group:', error);
        // Fallback to legacy implementation
        return await joinGroupLegacy(groupId, userId);
    }
};

/**
 * Legacy join group implementation as fallback
 */
const joinGroupLegacy = async (groupId: string, userId: string): Promise<boolean> => {
    try {
        const group = await getGroupById(groupId);
        if (!group) return false;

        // Check if group is public
        if (group.isPrivate) {
            console.error('Cannot join private group without invitation');
            return false;
        }

        // Check if user is already a member
        const currentUsers = group.users || [];
        if (currentUsers.includes(userId)) {
            return true; // User already in group
        }

        await databases.updateDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId,
            {
                users: [...currentUsers, userId]
            }
        );
        return true;
    } catch (error) {
        console.error('Error joining group (legacy):', error);
        return false;
    }
};

/**
 * Leave a group
 * UPDATED: Now uses junction table
 */
export const leaveGroup = async (groupId: string, userId: string): Promise<boolean> => {
    try {
        console.log(`leaveGroup: User ${userId} attempting to leave group ${groupId}`);

        const group = await getGroupById(groupId);
        if (!group) {
            console.error('Group not found');
            return false;
        }

        // Don't allow creator to leave their own group
        if (group.creatorId === userId) {
            console.error('Group creator cannot leave the group');
            return false;
        }

        // Use junction table to remove user
        const success = await removeGroupMember(groupId, userId);

        if (success) {
            console.log(`leaveGroup: User ${userId} successfully left group ${groupId}`);
        } else {
            console.error(`leaveGroup: Failed to remove user ${userId} from group ${groupId}`);
        }

        return success;
    } catch (error) {
        console.error('Error leaving group:', error);
        // Fallback to legacy implementation
        return await leaveGroupLegacy(groupId, userId);
    }
};

/**
 * Legacy leave group implementation as fallback
 */
const leaveGroupLegacy = async (groupId: string, userId: string): Promise<boolean> => {
    try {
        const group = await getGroupById(groupId);
        if (!group) return false;

        // Don't allow creator to leave their own group
        if (group.creatorId === userId) {
            console.error('Group creator cannot leave the group');
            return false;
        }

        const currentUsers = group.users || [];
        const updatedUsers = currentUsers.filter(id => id !== userId);

        await databases.updateDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId,
            {
                users: updatedUsers
            }
        );
        return true;
    } catch (error) {
        console.error('Error leaving group (legacy):', error);
        return false;
    }
};

/**
 * Add an event to a group's events list
 */
export const addEventToGroup = async (groupId: string, eventId: string): Promise<boolean> => {
    try {
        // Get the current group
        const group = await getGroupById(groupId);
        if (!group) return false;

        // Get current events array (could be strings or objects)
        const currentEvents = group.events || [];

        // Check if event is already in the group
        const eventExists = currentEvents.some((event: any) => {
            if (typeof event === 'string') {
                return event === eventId;
            } else if (event && event.$id) {
                return event.$id === eventId;
            }
            return false;
        });

        if (eventExists) {
            return true; // Event already in group
        }

        // Add the event ID to the group's events array
        await databases.updateDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId,
            {
                events: [...currentEvents, eventId]
            }
        );

        return true;
    } catch (error) {
        console.error('Error adding event to group:', error);
        return false;
    }
};

/**
 * Remove an event from a group's events list
 */
export const removeEventFromGroup = async (groupId: string, eventId: string): Promise<boolean> => {
    try {
        const group = await getGroupById(groupId);
        if (!group) return false;

        const currentEvents = group.events || [];
        const updatedEvents = currentEvents.filter((event: any) => {
            if (typeof event === 'string') {
                return event !== eventId;
            } else if (event && event.$id) {
                return event.$id !== eventId;
            }
            return true;
        });

        await databases.updateDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId,
            {
                events: updatedEvents
            }
        );

        return true;
    } catch (error) {
        console.error('Error removing event from group:', error);
        return false;
    }
};
export const getGroupEvents = async (groupId: string) => {
    try {
        // First, get the group with its events relationship
        const group = await databases.getDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId
        );

        // If the group has an events relationship/array, return those events
        if (group.events && Array.isArray(group.events)) {
            // If events is an array of event objects
            if (group.events.length > 0 && typeof group.events[0] === 'object') {
                return group.events;
            }

            // If events is an array of event IDs, fetch the actual events
            if (group.events.length > 0 && typeof group.events[0] === 'string') {
                const eventPromises = group.events.map((eventId: string) =>
                    databases.getDocument(
                        config.databaseID!,
                        config.eventsCollectionID!,
                        eventId
                    ).catch(error => {
                        console.warn(`Failed to fetch event ${eventId}:`, error);
                        return null;
                    })
                );

                const events = await Promise.all(eventPromises);
                return events.filter(event => event !== null);
            }
        }

        // If no events in the group relationship, return empty array
        return [];

    } catch (error) {
        console.error('Error fetching group events:', error);

        // Final fallback: get all events and filter client-side
        // This is inefficient but works as a last resort
        try {
            console.log('Using client-side filtering fallback...');
            const allEvents = await databases.listDocuments(
                config.databaseID!,
                config.eventsCollectionID!
            );

            // Filter events that might belong to this group
            // Check multiple possible relationship formats
            return allEvents.documents.filter((event: any) => {
                // Check if event has a group relationship pointing to this group
                if (event.group && typeof event.group === 'object' && event.group.$id === groupId) {
                    return true;
                }

                // Check if event has a groupId field
                if (event.groupId === groupId) {
                    return true;
                }

                // Check if event has group field as string ID
                if (event.group === groupId) {
                    return true;
                }

                return false;
            });
        } catch (fallbackError) {
            console.error('Fallback events query failed:', fallbackError);
            return [];
        }
    }
};

/**
 * Add a user to a group
 * UPDATED: Now uses junction table
 */
export const addUserToGroup = async (groupId: string, userId: string): Promise<boolean> => {
    try {
        console.log(`addUserToGroup: Adding user ${userId} to group ${groupId}`);

        // Use junction table to add user
        const success = await addGroupMember(groupId, userId, 'member');

        if (success) {
            console.log(`addUserToGroup: User ${userId} successfully added to group ${groupId}`);
        } else {
            console.error(`addUserToGroup: Failed to add user ${userId} to group ${groupId}`);
        }

        return success;
    } catch (error) {
        console.error('Error adding user to group:', error);
        // Fallback to legacy implementation
        return await addUserToGroupLegacy(groupId, userId);
    }
};

/**
 * Legacy add user to group implementation as fallback
 */
const addUserToGroupLegacy = async (groupId: string, userId: string): Promise<boolean> => {
    try {
        // Get current group data
        const group = await databases.getDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId
        );

        // Get current users array (handle different formats)
        let currentUsers: string[] = [];
        if (Array.isArray(group.users)) {
            currentUsers = group.users.map((user: any) => {
                if (typeof user === 'string') {
                    return user;
                } else if (user && user.$id) {
                    return user.$id;
                }
                return null;
            }).filter((id: any) => id && typeof id === 'string');
        }

        // Check if user is already in the group
        if (currentUsers.includes(userId)) {
            console.log('User is already a member of this group');
            return true;
        }

        // Add user to the group
        const updatedUsers = [...currentUsers, userId];

        await databases.updateDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId,
            {
                users: updatedUsers
            }
        );

        console.log('User added to group successfully (legacy)');
        return true;

    } catch (error) {
        console.error('Error adding user to group (legacy):', error);
        return false;
    }
};

/**
 * UNIFIED INVITE SYSTEM - Re-export from groupMembership.ts
 * These functions now use the groupMemberships collection with 'invited' status
 * instead of a separate groupInvites collection
 */

// Re-export the new unified invite functions from groupMembership
export { acceptGroupInvite, declineGroupInvite, getUserGroupInvites, sendGroupInvite } from './groupMembership';

