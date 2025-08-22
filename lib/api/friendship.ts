/**
 * Friendship Management API
 * 
 * Handles UserFriendship database operations with proper uniqueness constraints
 * and database synchronization for enterprise-scale friend system.
 */

import { config, databases } from "@/lib/appwrite/appwrite";
import { ID, Query } from "react-native-appwrite";
import { authDebug } from "../debug/authDebug";
import { UserFriendship } from "../types/Database";
import { getUserProfile, updateUserProfile } from "./user";

/**
 * Update the friend count for a user by counting their actual friendships
 */
async function updateUserFriendCount(userId: string): Promise<void> {
    try {
        const friendIds = await getUserFriends(userId);
        const userProfile = await getUserProfile(userId);

        if (userProfile && userProfile.friendCount !== friendIds.length) {
            await updateUserProfile({
                ...userProfile,
                friendCount: friendIds.length
            });
            authDebug.info(`Updated friend count for user ${userId}: ${friendIds.length}`);
        }
    } catch (error) {
        authDebug.error(`Error updating friend count for user ${userId}:`, error);
    }
}

/**
 * Check if a friendship already exists between two users
 */
async function getFriendship(userId1: string, userId2: string): Promise<UserFriendship | null> {
    try {
        // Always order IDs consistently
        const orderedId1 = userId1 < userId2 ? userId1 : userId2;
        const orderedId2 = userId1 < userId2 ? userId2 : userId1;

        const response = await databases.listDocuments(
            config.databaseID!,
            config.userFriendshipsCollectionID!,
            [
                Query.equal('userId1', orderedId1),
                Query.equal('userId2', orderedId2),
                Query.limit(1)
            ]
        );

        return response.documents.length > 0 ? response.documents[0] as unknown as UserFriendship : null;
    } catch (error) {
        authDebug.error('Error checking existing friendship:', error);
        return null;
    }
}

/**
 * Send a friend request with uniqueness check
 */
export async function sendFriendRequest(fromUserId: string, toUserId: string): Promise<{ success: boolean; message: string; friendshipId?: string }> {
    try {
        authDebug.info(`Sending friend request: ${fromUserId} → ${toUserId}`);

        // Check if friendship already exists
        const existingFriendship = await getFriendship(fromUserId, toUserId);

        if (existingFriendship) {
            if (existingFriendship.status === 'pending') {
                if (existingFriendship.requesterId === fromUserId) {
                    return { success: false, message: 'Friend request already sent' };
                } else {
                    return { success: false, message: 'You have a pending friend request from this user' };
                }
            } else if (existingFriendship.status === 'accepted') {
                return { success: false, message: 'You are already friends with this user' };
            } else if (existingFriendship.status === 'blocked') {
                return { success: false, message: 'Cannot send friend request to this user' };
            } else if (existingFriendship.status === 'declined') {
                // Allow resending after decline, but update existing record
                await databases.updateDocument(
                    config.databaseID!,
                    config.userFriendshipsCollectionID!,
                    existingFriendship.$id,
                    {
                        status: 'pending',
                        requesterId: fromUserId,
                        $updatedAt: new Date().toISOString()
                    }
                );

                authDebug.info('Updated declined friendship to pending');
                return { success: true, message: 'Friend request sent', friendshipId: existingFriendship.$id };
            }
        }

        // Create new friendship request
        const userId1 = fromUserId < toUserId ? fromUserId : toUserId;
        const userId2 = fromUserId < toUserId ? toUserId : fromUserId;

        const requestId = ID.unique();
        const friendship = await databases.createDocument(
            config.databaseID!,
            config.userFriendshipsCollectionID!,
            requestId,
            {
                userId1,
                userId2,
                requesterId: fromUserId,
                status: 'pending',
            }
        );

        authDebug.info('Friend request created successfully');
        return { success: true, message: 'Friend request sent', friendshipId: friendship.$id };

    } catch (error) {
        authDebug.error('Error sending friend request:', error);
        return { success: false, message: 'Failed to send friend request' };
    }
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(friendshipId: string): Promise<{ success: boolean; message: string }> {
    try {
        authDebug.info(`Accepting friend request: ${friendshipId}`);

        // First get the friendship document to identify both users
        const friendship = await databases.getDocument(
            config.databaseID!,
            config.userFriendshipsCollectionID!,
            friendshipId
        );

        await databases.updateDocument(
            config.databaseID!,
            config.userFriendshipsCollectionID!,
            friendshipId,
            {
                status: 'accepted',
                acceptedAt: new Date().toISOString()
            }
        );

        // Update friend counts for both users
        await Promise.all([
            updateUserFriendCount(friendship.userId1),
            updateUserFriendCount(friendship.userId2)
        ]);

        authDebug.info('Friend request accepted successfully and friend counts updated');
        return { success: true, message: 'Friend request accepted' };

    } catch (error) {
        authDebug.error('Error accepting friend request:', error);
        return { success: false, message: 'Failed to accept friend request' };
    }
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(friendshipId: string): Promise<{ success: boolean; message: string }> {
    try {
        authDebug.info(`Declining friend request: ${friendshipId}`);

        // Delete the friendship document on decline so the system relies
        // entirely on the userFriendships collection and declined requests
        // are removed per product requirements.
        await databases.deleteDocument(
            config.databaseID!,
            config.userFriendshipsCollectionID!,
            friendshipId
        );

        authDebug.info('Friend request deleted (declined) successfully');
        return { success: true, message: 'Friend request declined and removed' };

    } catch (error) {
        authDebug.error('Error declining friend request:', error);
        return { success: false, message: 'Failed to decline friend request' };
    }
}

/**
 * Unfriend a user (delete the friendship from database)
 */
export async function unfriendUser(userId: string, friendId: string): Promise<{ success: boolean; message: string }> {
    try {
        authDebug.info(`Unfriending users: ${userId} ↔ ${friendId}`);

        // Find the friendship record
        const friendship = await getFriendship(userId, friendId);

        if (!friendship) {
            return { success: false, message: 'Friendship not found' };
        }

        if (friendship.status !== 'accepted') {
            return { success: false, message: 'Users are not friends' };
        }

        // Delete the friendship record from database
        await databases.deleteDocument(
            config.databaseID!,
            config.userFriendshipsCollectionID!,
            friendship.$id
        );

        // Update friend counts for both users after unfriending
        await Promise.all([
            updateUserFriendCount(userId),
            updateUserFriendCount(friendId)
        ]);

        authDebug.info('Friendship deleted successfully from database and friend counts updated');
        return { success: true, message: 'Friendship ended' };

    } catch (error) {
        authDebug.error('Error unfriending user:', error);
        return { success: false, message: 'Failed to unfriend user' };
    }
}

/**
 * Cancel a pending friend request
 */
export async function cancelFriendRequest(fromUserId: string, toUserId: string): Promise<{ success: boolean; message: string }> {
    try {
        authDebug.info(`Canceling friend request: ${fromUserId} → ${toUserId}`);

        const friendship = await getFriendship(fromUserId, toUserId);

        if (!friendship) {
            return { success: false, message: 'Friend request not found' };
        }

        if (friendship.status !== 'pending') {
            return { success: false, message: 'No pending friend request to cancel' };
        }

        if (friendship.requesterId !== fromUserId) {
            return { success: false, message: 'You did not send this friend request' };
        }

        // Delete the pending request
        await databases.deleteDocument(
            config.databaseID!,
            config.userFriendshipsCollectionID!,
            friendship.$id
        );

        authDebug.info('Friend request canceled successfully');
        return { success: true, message: 'Friend request canceled' };

    } catch (error) {
        authDebug.error('Error canceling friend request:', error);
        return { success: false, message: 'Failed to cancel friend request' };
    }
}

/**
 * Get all friends of a user
 */
export async function getUserFriends(userId: string): Promise<string[]> {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.userFriendshipsCollectionID!,
            [
                Query.and([
                    Query.or([
                        Query.equal('userId1', userId),
                        Query.equal('userId2', userId)
                    ]),
                    Query.equal('status', 'accepted')
                ]),
                Query.limit(1000) // Reasonable limit for friends
            ]
        );

        // Extract friend IDs (the other user in each friendship)
        const friendIds = response.documents.map((friendship: any) => {
            return friendship.userId1 === userId ? friendship.userId2 : friendship.userId1;
        });

        return friendIds;
    } catch (error) {
        authDebug.error('Error getting user friends:', error);
        return [];
    }
}

/**
 * Get pending friend requests for a user (both sent and received)
 */
export async function getPendingFriendRequests(userId: string): Promise<{
    sent: UserFriendship[];
    received: UserFriendship[];
}> {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.userFriendshipsCollectionID!,
            [
                Query.and([
                    Query.or([
                        Query.equal('userId1', userId),
                        Query.equal('userId2', userId)
                    ]),
                    Query.equal('status', 'pending')
                ]),
                Query.limit(100) // Reasonable limit for pending requests
            ]
        );

        const sent: UserFriendship[] = [];
        const received: UserFriendship[] = [];

        response.documents.forEach((friendship: any) => {
            if (friendship.requesterId === userId) {
                sent.push(friendship as UserFriendship);
            } else {
                received.push(friendship as UserFriendship);
            }
        });

        return { sent, received };
    } catch (error) {
        authDebug.error('Error getting pending friend requests:', error);
        return { sent: [], received: [] };
    }
}

/**
 * Fix friend count for a user by recalculating from actual friendships
 * This can be used to repair inconsistent friend counts
 */
export async function fixUserFriendCount(userId: string): Promise<{ success: boolean; oldCount: number; newCount: number }> {
    try {
        const userProfile = await getUserProfile(userId);
        if (!userProfile) {
            return { success: false, oldCount: 0, newCount: 0 };
        }

        const friendIds = await getUserFriends(userId);
        const oldCount = userProfile.friendCount || 0;
        const newCount = friendIds.length;

        if (oldCount !== newCount) {
            await updateUserProfile({
                ...userProfile,
                friendCount: newCount
            });
            authDebug.info(`Fixed friend count for user ${userId}: ${oldCount} → ${newCount}`);
        }

        return { success: true, oldCount, newCount };
    } catch (error) {
        authDebug.error(`Error fixing friend count for user ${userId}:`, error);
        return { success: false, oldCount: 0, newCount: 0 };
    }
}
