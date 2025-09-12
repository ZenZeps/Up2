import notificationService from './notificationService';
import { notificationTokenManager } from './tokenManager';

/**
 * Simple notification service using temporary token storage
 * This is the quickest way to get notifications working without database schema changes
 */
export class SimpleNotificationService {
    /**
     * Get notification tokens for users from temporary storage
     */
    static async getUserTokens(userIds: string[]): Promise<string[]> {
        try {
            const tokens: string[] = [];

            for (const userId of userIds) {
                const tokenData = notificationTokenManager.getUserToken(userId);
                if (tokenData?.token && tokenData.enabled) {
                    tokens.push(tokenData.token);
                }
            }

            console.log(`📱 Found ${tokens.length} notification tokens for ${userIds.length} users`);
            return tokens;
        } catch (error) {
            console.error('❌ Error fetching user notification tokens:', error);
            return [];
        }
    }

    /**
     * Send friend request notification
     */
    static async sendFriendRequestNotification(
        toUserId: string,
        senderName: string,
        senderId: string
    ): Promise<void> {
        try {
            const tokens = await this.getUserTokens([toUserId]);

            if (tokens.length === 0) {
                console.log('📴 No notification tokens available for friend request');
                return;
            }

            await notificationService.sendPushNotification(
                tokens,
                '👋 New Friend Request',
                `${senderName} sent you a friend request`,
                {
                    type: 'friend_request',
                    senderId,
                    senderName,
                }
            );

            console.log('✅ Friend request notification sent');
        } catch (error) {
            console.error('❌ Error sending friend request notification:', error);
        }
    }

    /**
     * Send friend request accepted notification
     */
    static async sendFriendRequestAcceptedNotification(
        toUserId: string,
        accepterName: string,
        accepterId: string
    ): Promise<void> {
        try {
            const tokens = await this.getUserTokens([toUserId]);

            if (tokens.length === 0) {
                console.log('📴 No notification tokens available for friend request accepted');
                return;
            }

            await notificationService.sendPushNotification(
                tokens,
                '✅ Friend Request Accepted',
                `${accepterName} accepted your friend request`,
                {
                    type: 'friend_request_accepted',
                    accepterId,
                    accepterName,
                }
            );

            console.log('✅ Friend request accepted notification sent');
        } catch (error) {
            console.error('❌ Error sending friend request accepted notification:', error);
        }
    }

    /**
     * Send event invitation notification
     */
    static async sendEventInviteNotification(
        invitedUserIds: string[],
        eventTitle: string,
        inviterName: string,
        eventId: string
    ): Promise<void> {
        try {
            const tokens = await this.getUserTokens(invitedUserIds);

            if (tokens.length === 0) {
                console.log('📴 No notification tokens available for event invite');
                return;
            }

            await notificationService.sendPushNotification(
                tokens,
                '🎉 Event Invitation',
                `${inviterName} invited you to "${eventTitle}"`,
                {
                    type: 'event_invite',
                    eventId,
                    inviterName,
                    eventTitle,
                }
            );

            console.log(`✅ Event invite notification sent to ${tokens.length} users`);
        } catch (error) {
            console.error('❌ Error sending event invite notification:', error);
        }
    }

    /**
     * Send group invitation notification
     */
    static async sendGroupInviteNotification(
        invitedUserIds: string[],
        groupName: string,
        inviterName: string,
        groupId: string
    ): Promise<void> {
        try {
            const tokens = await this.getUserTokens(invitedUserIds);

            if (tokens.length === 0) {
                console.log('📴 No notification tokens available for group invite');
                return;
            }

            await notificationService.sendPushNotification(
                tokens,
                '👥 Group Invitation',
                `${inviterName} invited you to join "${groupName}"`,
                {
                    type: 'group_invite',
                    groupId,
                    inviterName,
                    groupName,
                }
            );

            console.log(`✅ Group invite notification sent to ${tokens.length} users`);
        } catch (error) {
            console.error('❌ Error sending group invite notification:', error);
        }
    }
}
