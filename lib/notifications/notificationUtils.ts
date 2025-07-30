import { getUsersByIds } from '../api/user';
import notificationService from './notificationService';

/**
 * Send notification when a user receives an event invite
 */
export async function sendEventInviteNotification(
    invitedUserIds: string[],
    eventTitle: string,
    inviterName: string,
    eventId: string
): Promise<void> {
    try {
        // Get user profiles to get notification tokens
        const users = await getUsersByIds(invitedUserIds);

        const userTokens = users
            .filter(user => user.notificationsEnabled && user.notificationToken)
            .map(user => user.notificationToken!);

        if (userTokens.length === 0) {
            console.log('No users with notifications enabled for event invite');
            return;
        }

        await notificationService.sendPushNotification(
            userTokens,
            '🎉 Event Invitation',
            `${inviterName} invited you to "${eventTitle}"`,
            {
                type: 'event_invite',
                eventId,
                inviterName,
                eventTitle,
            }
        );

        console.log(`Event invite notification sent to ${userTokens.length} users`);
    } catch (error) {
        console.error('Error sending event invite notification:', error);
    }
}

/**
 * Send notification when a new message is sent to a chat
 */
export async function sendChatMessageNotification(
    chatParticipantIds: string[],
    senderName: string,
    messageText: string,
    chatId: string,
    senderId: string
): Promise<void> {
    try {
        // Filter out the sender from notification recipients
        const recipientIds = chatParticipantIds.filter(id => id !== senderId);

        if (recipientIds.length === 0) {
            return;
        }

        // Get user profiles to get notification tokens
        const users = await getUsersByIds(recipientIds);

        const userTokens = users
            .filter(user => user.notificationsEnabled && user.notificationToken)
            .map(user => user.notificationToken!);

        if (userTokens.length === 0) {
            console.log('No users with notifications enabled for chat message');
            return;
        }

        // Truncate message if too long
        const truncatedMessage = messageText.length > 50
            ? `${messageText.substring(0, 47)}...`
            : messageText;

        await notificationService.sendPushNotification(
            userTokens,
            `💬 ${senderName}`,
            truncatedMessage,
            {
                type: 'chat_message',
                chatId,
                senderId,
                senderName,
            }
        );

        console.log(`Chat message notification sent to ${userTokens.length} users`);
    } catch (error) {
        console.error('Error sending chat message notification:', error);
    }
}

/**
 * Send notification when a user receives a friend request
 */
export async function sendFriendRequestNotification(
    recipientUserId: string,
    senderName: string,
    senderId: string
): Promise<void> {
    try {
        // Get recipient's profile to get notification token
        const users = await getUsersByIds([recipientUserId]);

        if (users.length === 0 || !users[0].notificationsEnabled || !users[0].notificationToken) {
            console.log('Recipient does not have notifications enabled');
            return;
        }

        await notificationService.sendPushNotification(
            [users[0].notificationToken!],
            '👥 Friend Request',
            `${senderName} sent you a friend request`,
            {
                type: 'friend_request',
                senderId,
                senderName,
            }
        );

        console.log('Friend request notification sent');
    } catch (error) {
        console.error('Error sending friend request notification:', error);
    }
}

/**
 * Send notification when a friend request is accepted
 */
export async function sendFriendRequestAcceptedNotification(
    recipientUserId: string,
    accepterName: string,
    accepterId: string
): Promise<void> {
    try {
        // Get recipient's profile to get notification token
        const users = await getUsersByIds([recipientUserId]);

        if (users.length === 0 || !users[0].notificationsEnabled || !users[0].notificationToken) {
            console.log('Recipient does not have notifications enabled');
            return;
        }

        await notificationService.sendPushNotification(
            [users[0].notificationToken!],
            '✅ Friend Request Accepted',
            `${accepterName} accepted your friend request`,
            {
                type: 'friend_request_accepted',
                accepterId,
                accepterName,
            }
        );

        console.log('Friend request accepted notification sent');
    } catch (error) {
        console.error('Error sending friend request accepted notification:', error);
    }
}
