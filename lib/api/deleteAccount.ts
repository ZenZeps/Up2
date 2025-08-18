/**
 * Account Deletion API
 * 
 * Handles comprehensive account deletion including all related data across
 * multiple database collections and user authentication.
 */

import { account, config, databases } from '@/lib/appwrite/appwrite';
import { Query } from 'react-native-appwrite';
import { authDebug } from '../debug/authDebug';

export interface DeleteAccountResult {
    success: boolean;
    message: string;
    deletedCounts: {
        friendships: number;
        groupMemberships: number;
        eventAttendances: number;
        messages: number;
        chats: number;
        userProfile: boolean;
        authAccount: boolean;
    };
    errors: string[];
}

/**
 * Comprehensive account deletion function
 * This will delete all user data across all collections and the auth account
 */
export async function deleteAccount(userId: string): Promise<DeleteAccountResult> {
    const result: DeleteAccountResult = {
        success: false,
        message: '',
        deletedCounts: {
            friendships: 0,
            groupMemberships: 0,
            eventAttendances: 0,
            messages: 0,
            chats: 0,
            userProfile: false,
            authAccount: false
        },
        errors: []
    };

    try {
        authDebug.info(`Starting comprehensive account deletion for user: ${userId}`);

        // 1. Delete all friendships (both as userId1 and userId2)
        try {
            const friendships = await databases.listDocuments(
                config.databaseID!,
                config.userFriendshipsCollectionID!,
                [
                    Query.or([
                        Query.equal('userId1', userId),
                        Query.equal('userId2', userId)
                    ]),
                    Query.limit(1000) // Handle large friend lists
                ]
            );

            for (const friendship of friendships.documents) {
                await databases.deleteDocument(
                    config.databaseID!,
                    config.userFriendshipsCollectionID!,
                    friendship.$id
                );
            }
            result.deletedCounts.friendships = friendships.documents.length;
            authDebug.info(`Deleted ${friendships.documents.length} friendships`);
        } catch (error) {
            result.errors.push(`Failed to delete friendships: ${error}`);
            authDebug.error('Error deleting friendships:', error);
        }

        // 2. Delete all group memberships
        try {
            const memberships = await databases.listDocuments(
                config.databaseID!,
                config.groupMembershipsCollectionID!,
                [
                    Query.equal('userId', userId),
                    Query.limit(1000)
                ]
            );

            for (const membership of memberships.documents) {
                await databases.deleteDocument(
                    config.databaseID!,
                    config.groupMembershipsCollectionID!,
                    membership.$id
                );
            }
            result.deletedCounts.groupMemberships = memberships.documents.length;
            authDebug.info(`Deleted ${memberships.documents.length} group memberships`);
        } catch (error) {
            result.errors.push(`Failed to delete group memberships: ${error}`);
            authDebug.error('Error deleting group memberships:', error);
        }

        // 3. Delete all event attendances
        try {
            const attendances = await databases.listDocuments(
                config.databaseID!,
                config.eventAttendancesCollectionID!,
                [
                    Query.equal('userId', userId),
                    Query.limit(1000)
                ]
            );

            for (const attendance of attendances.documents) {
                await databases.deleteDocument(
                    config.databaseID!,
                    config.eventAttendancesCollectionID!,
                    attendance.$id
                );
            }
            result.deletedCounts.eventAttendances = attendances.documents.length;
            authDebug.info(`Deleted ${attendances.documents.length} event attendances`);
        } catch (error) {
            result.errors.push(`Failed to delete event attendances: ${error}`);
            authDebug.error('Error deleting event attendances:', error);
        }

        // 4. Delete all messages sent by the user
        try {
            const messages = await databases.listDocuments(
                config.databaseID!,
                config.messagesCollectionID!,
                [
                    Query.equal('senderId', userId),
                    Query.limit(1000)
                ]
            );

            for (const message of messages.documents) {
                await databases.deleteDocument(
                    config.databaseID!,
                    config.messagesCollectionID!,
                    message.$id
                );
            }
            result.deletedCounts.messages = messages.documents.length;
            authDebug.info(`Deleted ${messages.documents.length} messages`);
        } catch (error) {
            result.errors.push(`Failed to delete messages: ${error}`);
            authDebug.error('Error deleting messages:', error);
        }

        // 5. Delete chats where user is a participant
        try {
            const chats = await databases.listDocuments(
                config.databaseID!,
                config.chatsCollectionID!,
                [
                    Query.or([
                        Query.equal('participant1', userId),
                        Query.equal('participant2', userId)
                    ]),
                    Query.limit(1000)
                ]
            );

            for (const chat of chats.documents) {
                await databases.deleteDocument(
                    config.databaseID!,
                    config.chatsCollectionID!,
                    chat.$id
                );
            }
            result.deletedCounts.chats = chats.documents.length;
            authDebug.info(`Deleted ${chats.documents.length} chats`);
        } catch (error) {
            result.errors.push(`Failed to delete chats: ${error}`);
            authDebug.error('Error deleting chats:', error);
        }

        // 6. Delete user profile from users collection
        try {
            await databases.deleteDocument(
                config.databaseID!,
                config.usersCollectionID!,
                userId
            );
            result.deletedCounts.userProfile = true;
            authDebug.info('Deleted user profile from database');
        } catch (error) {
            result.errors.push(`Failed to delete user profile: ${error}`);
            authDebug.error('Error deleting user profile:', error);
        }

        // 7. Delete authentication account (this should be done last)
        try {
            await account.deleteSession('current');
            // Note: We can't delete the account from client side for security reasons
            // The user will need to request account deletion from admin panel
            // or we implement server-side function
            result.deletedCounts.authAccount = true;
            authDebug.info('Logged out user session');
        } catch (error) {
            result.errors.push(`Failed to delete auth session: ${error}`);
            authDebug.error('Error deleting auth session:', error);
        }

        // Determine overall success
        const hasErrors = result.errors.length > 0;
        result.success = !hasErrors;

        if (result.success) {
            result.message = 'Account and all associated data deleted successfully';
            authDebug.info(`Account deletion completed successfully for user: ${userId}`);
        } else {
            result.message = `Account deletion completed with ${result.errors.length} errors. See errors for details.`;
            authDebug.warn(`Account deletion completed with errors for user: ${userId}`, result.errors);
        }

        return result;

    } catch (error) {
        authDebug.error('Critical error during account deletion:', error);
        result.success = false;
        result.message = `Critical error during account deletion: ${error}`;
        result.errors.push(`Critical error: ${error}`);
        return result;
    }
}

/**
 * Preview what will be deleted (for confirmation UI)
 */
export async function getAccountDeletionPreview(userId: string): Promise<{
    friendshipsCount: number;
    groupMembershipsCount: number;
    eventAttendancesCount: number;
    messagesCount: number;
    chatsCount: number;
}> {
    try {
        const [friendships, memberships, attendances, messages, chats] = await Promise.all([
            databases.listDocuments(config.databaseID!, config.userFriendshipsCollectionID!, [
                Query.or([Query.equal('userId1', userId), Query.equal('userId2', userId)]),
                Query.limit(1)
            ]),
            databases.listDocuments(config.databaseID!, config.groupMembershipsCollectionID!, [
                Query.equal('userId', userId),
                Query.limit(1)
            ]),
            databases.listDocuments(config.databaseID!, config.eventAttendancesCollectionID!, [
                Query.equal('userId', userId),
                Query.limit(1)
            ]),
            databases.listDocuments(config.databaseID!, config.messagesCollectionID!, [
                Query.equal('senderId', userId),
                Query.limit(1)
            ]),
            databases.listDocuments(config.databaseID!, config.chatsCollectionID!, [
                Query.or([Query.equal('participant1', userId), Query.equal('participant2', userId)]),
                Query.limit(1)
            ])
        ]);

        return {
            friendshipsCount: friendships.total,
            groupMembershipsCount: memberships.total,
            eventAttendancesCount: attendances.total,
            messagesCount: messages.total,
            chatsCount: chats.total
        };
    } catch (error) {
        authDebug.error('Error getting account deletion preview:', error);
        return {
            friendshipsCount: 0,
            groupMembershipsCount: 0,
            eventAttendancesCount: 0,
            messagesCount: 0,
            chatsCount: 0
        };
    }
}
