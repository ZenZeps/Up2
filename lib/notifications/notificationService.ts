import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationTokenService } from './notificationTokenService';
// Temporary fallback
import { notificationTokenManager } from './tokenManager';

// Configure notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export class NotificationService {
    private static instance: NotificationService;
    private notificationToken: string | null = null;

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Register for push notifications and get the token
     */
    public async registerForPushNotifications(): Promise<string | null> {
        let token = null;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.warn('Failed to get push token for push notification!');
                return null;
            }

            try {
                // For development, try without project ID first
                const pushTokenString = (
                    await Notifications.getExpoPushTokenAsync()
                ).data;

                token = pushTokenString;
                this.notificationToken = token;
                console.log('Push token:', token);
            } catch (error) {
                console.error('Error getting push token:', error);
            }
        } else {
            console.warn('Must use physical device for Push Notifications');
        }

        return token;
    }

    /**
 * Update the notification token for a specific user using proper architecture
 */
    public async updateUserNotificationToken(userId: string): Promise<void> {
        try {
            const token = await this.registerForPushNotifications();
            if (token) {
                try {
                    // Use production NotificationTokenService
                    await NotificationTokenService.registerToken(userId, token);
                    console.log('✅ Notification token registered in production database');
                } catch (error) {
                    console.log('⚠️ Production database failed, using temporary storage as fallback:', error);
                    notificationTokenManager.setUserToken(userId, token, true);
                    console.log('✅ Notification token stored temporarily for user:', userId);
                }
            }
        } catch (error) {
            console.error('Error updating user notification token:', error);
        }
    }

    /**
     * Send a local notification (for testing)
     */
    public async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
            },
            trigger: null,
        });
    }

    /**
     * Send push notification to specific users
     */
    public async sendPushNotification(
        userTokens: string[],
        title: string,
        body: string,
        data?: any
    ): Promise<void> {
        console.log('🚀 NotificationService.sendPushNotification called:', {
            tokenCount: userTokens.length,
            title,
            body,
            data
        });

        const messages = userTokens
            .filter(token => token && token.trim() !== '')
            .map(token => ({
                to: token,
                sound: 'default',
                title,
                body,
                data,
            }));

        console.log('📝 Prepared messages:', messages.length, 'valid tokens');

        if (messages.length === 0) {
            console.warn('⚠️ No valid notification tokens provided');
            return;
        }

        try {
            console.log('📡 Sending to Expo push service...');
            const response = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages),
            });

            const result = await response.json();
            console.log('✅ Push notification response:', result);

            if (!response.ok) {
                console.error('❌ Push notification failed:', response.status, result);
            }
        } catch (error) {
            console.error('❌ Error sending push notification:', error);
        }
    }

    /**
     * Add notification listener
     */
    public addNotificationListener(
        callback: (notification: Notifications.Notification) => void
    ): Notifications.Subscription {
        return Notifications.addNotificationReceivedListener(callback);
    }

    /**
     * Add notification response listener (when user taps notification)
     */
    public addNotificationResponseListener(
        callback: (response: Notifications.NotificationResponse) => void
    ): Notifications.Subscription {
        return Notifications.addNotificationResponseReceivedListener(callback);
    }

    /**
     * Remove notification listener
     */
    public removeNotificationListener(subscription: Notifications.Subscription): void {
        Notifications.removeNotificationSubscription(subscription);
    }

    /**
     * Get notification token
     */
    public getNotificationToken(): string | null {
        return this.notificationToken;
    }
}

export default NotificationService.getInstance();
