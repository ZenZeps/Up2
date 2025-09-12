import * as Device from 'expo-device';
import { Platform } from 'react-native';
// Temporary fallback
import { notificationTokenManager } from './tokenManager';

// Conditional import for notifications to handle Expo Go limitation
let Notifications: any = null;
try {
    Notifications = require('expo-notifications');
    // Configure notifications only if available
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
} catch (error) {
    console.warn('📱 Push notifications not available in Expo Go. Use a development build for notifications.');
}

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
        if (!Notifications) {
            console.warn('📱 Push notifications not available in Expo Go. Use a development build.');
            return null;
        }

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
     * Update the notification token for a specific user using temporary storage (simplest approach)
     */
    public async updateUserNotificationToken(userId: string): Promise<void> {
        try {
            const token = await this.registerForPushNotifications();
            if (token) {
                // Store token using temporary storage (no database schema changes needed)
                notificationTokenManager.setUserToken(userId, token, true);
                console.log('📱 Token stored for user', userId + ':', token.substring(0, 25) + '...');
                console.log('✅ Notification token stored temporarily for user:', userId);
            }
        } catch (error) {
            console.error('Error updating user notification token:', error);
        }
    }

    /**
     * Send a local notification (for testing)
     */
    public async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
        if (!Notifications) {
            console.warn('📱 Local notifications not available in Expo Go');
            return;
        }

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
     * Send push notification to specific users with SCALABILITY LIMITS
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

        // SCALABILITY FIX: Limit notifications to prevent spam and API abuse
        const MAX_NOTIFICATIONS = 500; // Expo limit is ~100/hour for free, 1000+ for paid
        if (userTokens.length > MAX_NOTIFICATIONS) {
            console.warn(`⚠️ Too many notification recipients (${userTokens.length}). Limiting to ${MAX_NOTIFICATIONS} to prevent API abuse.`);
            userTokens = userTokens.slice(0, MAX_NOTIFICATIONS);
        }

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

        // SCALABILITY FIX: Send notifications in batches to prevent timeout
        const BATCH_SIZE = 100; // Expo recommends batches of 100
        const batches = [];
        for (let i = 0; i < messages.length; i += BATCH_SIZE) {
            batches.push(messages.slice(i, i + BATCH_SIZE));
        }

        console.log(`� Sending ${messages.length} notifications in ${batches.length} batches`);

        try {
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                console.log(`📡 Sending batch ${i + 1}/${batches.length} with ${batch.length} notifications...`);

                const response = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(batch),
                });

                const result = await response.json();
                console.log(`✅ Batch ${i + 1} response:`, result);

                if (!response.ok) {
                    console.error(`❌ Batch ${i + 1} failed:`, response.status, result);
                }

                // Add small delay between batches to prevent rate limiting
                if (i < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            console.log('🎉 All notification batches sent successfully');
        } catch (error) {
            console.error('❌ Error sending push notification batches:', error);
        }
    }

    /**
     * Add notification listener
     */
    public addNotificationListener(
        callback: (notification: any) => void
    ): any {
        if (!Notifications) return null;
        return Notifications.addNotificationReceivedListener(callback);
    }

    /**
     * Add notification response listener (when user taps notification)
     */
    public addNotificationResponseListener(
        callback: (response: any) => void
    ): any {
        if (!Notifications) return null;
        return Notifications.addNotificationResponseReceivedListener(callback);
    }

    /**
     * Remove notification listener - FIXED deprecated method
     */
    public removeNotificationListener(subscription: any): void {
        if (subscription) {
            subscription.remove(); // Use the new method instead of deprecated removeNotificationSubscription
        }
    }

    /**
     * Get notification token
     */
    public getNotificationToken(): string | null {
        return this.notificationToken;
    }
}

export default NotificationService.getInstance();
