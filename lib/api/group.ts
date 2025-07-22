import { config, databases } from '@/lib/appwrite/appwrite';
import { Group } from '@/lib/types/Groups';
import { ID, Query } from 'react-native-appwrite';

/**
 * Get all groups that a user belongs to
 */
export const getUserGroups = async (userId: string): Promise<Group[]> => {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.groupsCollectionID!,
            [
                Query.search('users', userId), // Search for user in the users relationship
            ]
        );
        return response.documents as unknown as Group[];
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
export const createGroup = async (title: string, creatorId: string): Promise<Group | null> => {
    try {
        const groupId = ID.unique();
        const response = await databases.createDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId,
            {
                id: groupId,
                title,
                creatorId,
                users: [creatorId], // Creator is automatically a member
            }
        );
        return response as unknown as Group;
    } catch (error) {
        console.error('Error creating group:', error);
        return null;
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
                Query.equal('groupId', groupId), // Assuming you have a groupId field in events
            ]
        );
        return response.documents;
    } catch (error) {
        console.error('Error fetching group events:', error);
        return [];
    }
};
