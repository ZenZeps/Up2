import { config, databases } from '@/lib/appwrite/appwrite';
import { Group } from '@/lib/types/Groups';
import { ID, Query } from 'react-native-appwrite';

/**
 * Get all groups that a user belongs to
 * Optimized to reduce database calls where possible
 */
export const getUserGroups = async (userId: string): Promise<Group[]> => {
    try {
        // Get groups where user is the creator (this can be queried directly)
        const creatorGroups = await databases.listDocuments(
            config.databaseID!,
            config.groupsCollectionID!,
            [Query.equal('creatorId', userId)]
        );

        // For groups where user is a member (but not creator), we need to fetch all groups
        // This is a limitation of Appwrite's relationship queries
        const allGroups = await databases.listDocuments(
            config.databaseID!,
            config.groupsCollectionID!
        );

        // Filter groups where the user is a member but not the creator
        const memberGroups = allGroups.documents.filter((group: any) => {
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
        });

        // Combine creator groups and member groups
        const allUserGroups = [
            ...creatorGroups.documents,
            ...memberGroups
        ];

        return allUserGroups as unknown as Group[];
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

        return {
            $id: response.$id,
            id: response.id || response.$id,
            title: response.title,
            description: response.description || '',
            creatorId: response.creatorId,
            isPrivate: response.isPrivate || false,
            users: response.users || [],
            events: response.events || [],
            memberCount: (response.users || []).length,
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
        const groupId = ID.unique();
        // Include creator and any additional members, remove duplicates
        const allMembers = Array.from(new Set([creatorId, ...(members || [])]));

        const response = await databases.createDocument(
            config.databaseID!,
            config.groupsCollectionID!,
            groupId,
            {
                title,
                description: description || '',
                creatorId,
                isPrivate,
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
            isPrivate: doc.isPrivate || false,
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
 * Get all public groups for discovery
 */
export const getPublicGroups = async (): Promise<Group[]> => {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.groupsCollectionID!,
            [Query.equal('isPrivate', false)]
        );

        return response.documents.map(doc => ({
            $id: doc.$id,
            id: doc.id || doc.$id,
            title: doc.title,
            description: doc.description || '',
            creatorId: doc.creatorId,
            isPrivate: doc.isPrivate || false,
            users: doc.users || [],
            events: doc.events || [],
            memberCount: (doc.users || []).length,
            $createdAt: doc.$createdAt,
            $updatedAt: doc.$updatedAt,
        }));
    } catch (error) {
        console.error('Error fetching public groups:', error);
        return [];
    }
};

/**
 * Search public groups by title
 */
export const searchPublicGroups = async (searchTerm: string): Promise<Group[]> => {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.groupsCollectionID!,
            [
                Query.equal('isPrivate', false),
                Query.search('title', searchTerm)
            ]
        );

        return response.documents.map(doc => ({
            $id: doc.$id,
            id: doc.id || doc.$id,
            title: doc.title,
            description: doc.description || '',
            creatorId: doc.creatorId,
            isPrivate: doc.isPrivate || false,
            users: doc.users || [],
            events: doc.events || [],
            memberCount: (doc.users || []).length,
            $createdAt: doc.$createdAt,
            $updatedAt: doc.$updatedAt,
        }));
    } catch (error) {
        console.error('Error searching public groups:', error);
        return [];
    }
};

/**
 * Join a public group
 */
export const joinGroup = async (groupId: string, userId: string): Promise<boolean> => {
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
        console.error('Error joining group:', error);
        return false;
    }
};

/**
 * Leave a group
 */
export const leaveGroup = async (groupId: string, userId: string): Promise<boolean> => {
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
        console.error('Error leaving group:', error);
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
 */
export const addUserToGroup = async (groupId: string, userId: string): Promise<boolean> => {
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

        console.log('User added to group successfully');
        return true;

    } catch (error) {
        console.error('Error adding user to group:', error);
        return false;
    }
};

/**
 * Send a group invite to a user
 */
export const sendGroupInvite = async (groupId: string, fromUserId: string, toUserId: string): Promise<boolean> => {
    try {
        // Check if invite already exists
        const existingInvites = await databases.listDocuments(
            config.databaseID!,
            config.groupInvitesCollectionID!,
            [
                Query.equal('groupId', groupId),
                Query.equal('toUserId', toUserId),
                Query.equal('status', 'pending')
            ]
        );

        if (existingInvites.documents.length > 0) {
            console.log('Group invite already exists');
            return false;
        }

        // Create new group invite
        await databases.createDocument(
            config.databaseID!,
            config.groupInvitesCollectionID!,
            ID.unique(),
            {
                groupId,
                fromUserId,
                toUserId,
                status: 'pending'
            }
        );

        return true;
    } catch (error) {
        console.error('Error sending group invite:', error);
        return false;
    }
};

/**
 * Get pending group invites for a user
 */
export const getUserGroupInvites = async (userId: string) => {
    try {
        // Safety check: If collection ID is the temporary fallback, return empty array
        if (config.groupInvitesCollectionID === 'temp_group_invites_id') {
            console.warn('Group invites collection not configured. Please add EXPO_PUBLIC_APPWRITE_GROUP_INVITES_ID to your .env.local file');
            return [];
        }

        const invites = await databases.listDocuments(
            config.databaseID!,
            config.groupInvitesCollectionID!,
            [
                Query.equal('toUserId', userId),
                Query.equal('status', 'pending')
            ]
        );

        return invites.documents;
    } catch (error) {
        console.error('Error fetching group invites:', error);
        return [];
    }
};

/**
 * Accept a group invite
 */
export const acceptGroupInvite = async (inviteId: string, groupId: string, userId: string): Promise<boolean> => {
    try {
        // Update invite status
        await databases.updateDocument(
            config.databaseID!,
            config.groupInvitesCollectionID!,
            inviteId,
            { status: 'accepted' }
        );

        // Add user to group
        const success = await addUserToGroup(groupId, userId);
        return success;
    } catch (error) {
        console.error('Error accepting group invite:', error);
        return false;
    }
};

/**
 * Decline a group invite
 */
export const declineGroupInvite = async (inviteId: string): Promise<boolean> => {
    try {
        await databases.updateDocument(
            config.databaseID!,
            config.groupInvitesCollectionID!,
            inviteId,
            { status: 'declined' }
        );

        return true;
    } catch (error) {
        console.error('Error declining group invite:', error);
        return false;
    }
};
