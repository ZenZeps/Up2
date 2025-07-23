import { config, databases } from '@/lib/appwrite/appwrite';
import { Group } from '@/lib/types/Groups';
import { ID, Query } from 'react-native-appwrite';

/**
 * Get all groups that a user belongs to
 */
export const getUserGroups = async (userId: string): Promise<Group[]> => {
    try {
        // For virtual relationship attributes, we can't query them directly
        // Instead, get all groups and filter client-side
        const response = await databases.listDocuments(
            config.databaseID!,
            config.groupsCollectionID!
        );

        console.log('All groups fetched:', response.documents.length);
        console.log('Looking for user:', userId);

        // Debug: Log the structure of groups
        response.documents.forEach((group: any, index) => {
            console.log(`Group ${index}:`, {
                id: group.$id,
                title: group.title,
                creatorId: group.creatorId,
                users: group.users,
                usersType: typeof group.users,
                usersIsArray: Array.isArray(group.users)
            });
        });

        // Filter groups where the user is a member
        const userGroups = response.documents.filter((group: any) => {
            if (!group.users) {
                console.log(`Group ${group.title} has no users`);
                return false;
            }

            // Check if user is the creator
            if (group.creatorId === userId) {
                console.log(`User is creator of group ${group.title}`);
                return true;
            }

            // Handle different possible formats of the users relationship
            if (Array.isArray(group.users)) {
                // If users is an array of IDs or objects
                const isIncluded = group.users.some((user: any) => {
                    if (typeof user === 'string') {
                        return user === userId;
                    } else if (user && user.$id) {
                        return user.$id === userId;
                    }
                    return false;
                });
                console.log(`Group ${group.title} - user included:`, isIncluded);
                return isIncluded;
            }

            console.log(`Group ${group.title} - users not an array`);
            return false;
        });

        console.log('Filtered user groups:', userGroups.length);
        return userGroups as unknown as Group[];
    } catch (error) {
        console.error('Error fetching user groups:', error);
        return [];
    }
};

/**
 * Get group details by ID
 */
export const getGroupById = async (groupId: string): Promise<Group | null> => {
    try {
        const response = await databases.getDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId
        );
        return response as unknown as Group;
    } catch (error) {
        console.error('Error fetching group:', error);
        return null;
    }
};

/**
 * Create a new group
 */
export const createGroup = async (title: string, creatorId: string, members?: string[]): Promise<Group | null> => {
    try {
        const groupId = ID.unique();
        // Include creator and any additional members, remove duplicates
        const allMembers = Array.from(new Set([creatorId, ...(members || [])]));

        const response = await databases.createDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId,
            {
                title,
                creatorId,
                // For relationship attributes, pass array of user IDs
                users: allMembers,
            }
        );
        return response as unknown as Group;
    } catch (error) {
        console.error('Error creating group:', error);
        // Re-throw the error so the calling component can handle it properly
        throw error;
    }
};

/**
 * Add user to group
 */
export const addUserToGroup = async (groupId: string, userId: string): Promise<boolean> => {
    try {
        // First get the current group to access existing users
        const group = await getGroupById(groupId);
        if (!group) return false;

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
        console.error('Error adding user to group:', error);
        return false;
    }
};

/**
 * Remove user from group
 */
export const removeUserFromGroup = async (groupId: string, userId: string): Promise<boolean> => {
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
        console.error('Error removing user from group:', error);
        return false;
    }
};

/**
 * Get all events for a specific group
 */
export const getGroupEvents = async (groupId: string) => {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.eventsCollectionID!,
            [
                // Use the correct attribute name - might be 'group' instead of 'groupId'
                Query.equal('group', groupId),
            ]
        );
        return response.documents;
    } catch (error) {
        console.error('Error fetching group events:', error);
        // Fallback: if group relationship doesn't work, try without filter for now
        try {
            const allEvents = await databases.listDocuments(
                config.databaseID!,
                config.eventsCollectionID!
            );
            // Filter client-side if needed
            return allEvents.documents.filter((event: any) =>
                event.group === groupId || event.groupId === groupId
            );
        } catch (fallbackError) {
            console.error('Fallback events query failed:', fallbackError);
            return [];
        }
    }
};
