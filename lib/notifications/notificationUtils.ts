import notificationService from './notificationService';
import { SimpleNotificationService } from './simpleNotificationService';

/**
 * Send notification when a user receives an event invite
 */
export async function sendEventInviteNotification(
    invitedUserIds: string[],
    eventTitle: string,
    inviterName: string,
    eventId: string
): Promise<void> {
    return SimpleNotificationService.sendEventInviteNotification(
        invitedUserIds,
        eventTitle,
        inviterName,
        eventId
    );
}

/**
 * Send notification when a user receives a friend request
 */
export async function sendFriendRequestNotification(
    recipientUserId: string,
    senderName: string,
    senderId: string
): Promise<void> {
    return SimpleNotificationService.sendFriendRequestNotification(
        recipientUserId,
        senderName,
        senderId
    );
}

/**
 * Send notification when a friend request is accepted
 */
export async function sendFriendRequestAcceptedNotification(
    recipientUserId: string,
    accepterName: string,
    accepterId: string
): Promise<void> {
    return SimpleNotificationService.sendFriendRequestAcceptedNotification(
        recipientUserId,
        accepterName,
        accepterId
    );
}

/**
 * Send notification when a user receives a group invite
 */
export async function sendGroupInviteNotification(
    invitedUserIds: string[],
    groupName: string,
    inviterName: string,
    groupId: string
): Promise<void> {
    return SimpleNotificationService.sendGroupInviteNotification(
        invitedUserIds,
        groupName,
        inviterName,
        groupId
    );
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

        // Use simple service to get tokens from user profiles
        const userTokens = await SimpleNotificationService.getUserTokens(recipientIds);

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
            `� ${senderName}`,
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
 * Send notification when a group owner receives a join request
 */
export async function sendGroupJoinRequestNotification(
    ownerUserId: string,
    requesterName: string,
    requesterId: string,
    groupName: string,
    groupId: string
): Promise<void> {
    try {
        // Use simple service to get owner's token
        const userTokens = await SimpleNotificationService.getUserTokens([ownerUserId]);

        if (userTokens.length === 0) {
            console.log('Owner does not have notifications enabled or no token');
            return;
        }

        await notificationService.sendPushNotification(
            userTokens,
            '🔔 Group Join Request',
            `${requesterName} requested to join "${groupName}"`,
            {
                type: 'group_join_request',
                requesterId,
                requesterName,
                groupId,
                groupName
            }
        );

        console.log('Group join request notification sent');
    } catch (error) {
        console.error('Error sending group join request notification:', error);
    }
}
