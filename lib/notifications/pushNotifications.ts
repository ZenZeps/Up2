import { config, databases } from '@/lib/appwrite/appwrite';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ID } from 'react-native-appwrite';

// Configure notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export async function registerForPushNotifications(userId: string) {
    let token;

    if (!Device.isDevice) {
        throw new Error('Push Notifications are only supported on physical devices');
    }

    // Check permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        throw new Error('Permission to send push notifications was denied');
    }

    // Get push token
    token = (await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    })).data;

    // Platform-specific settings
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    // Store token in Appwrite
    try {
        await databases.createDocument(
            config.databaseID!,
            'push_tokens', // You'll need to create this collection
            ID.unique(),
            {
                userId: userId,
                token: token,
                platform: Platform.OS,
                createdAt: new Date().toISOString(),
            }
        );
    } catch (error) {
        console.error('Error storing push token:', error);
        throw error;
    }

    return token;
}

export async function sendPushNotification(expoPushToken: string, title: string, body: string, data?: object) {
    const message = {
        to: expoPushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
    });
}

export async function sendEventNotification(userId: string, eventTitle: string, type: 'reminder' | 'invitation' | 'update') {
    try {
        // Get user's push token
        const tokens = await databases.listDocuments(
            config.databaseID!,
            'push_tokens',
            [databases.createQuery().equal('userId', userId)]
        );

        if (tokens.documents.length === 0) return;

        const token = tokens.documents[0].token;
        let title, body;

        switch (type) {
            case 'reminder':
                title = 'Event Reminder';
                body = `Your event "${eventTitle}" is starting soon!`;
                break;
            case 'invitation':
                title = 'New Event Invitation';
                body = `You've been invited to "${eventTitle}"`;
                break;
            case 'update':
                title = 'Event Update';
                body = `The event "${eventTitle}" has been updated`;
                break;
        }

        await sendPushNotification(token, title, body, { eventTitle, type });
    } catch (error) {
        console.error('Error sending event notification:', error);
        throw error;
    }
} 