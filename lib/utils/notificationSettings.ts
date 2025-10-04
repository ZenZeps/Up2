import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationSettings {
    notificationsEnabled: boolean;
    eventReminders: boolean;
    friendRequests: boolean;
    groupInvites: boolean;
    eventInvites: boolean;
}

/**
 * Get user's notification settings from AsyncStorage
 */
export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
    try {
        const [notifEnabled, eventRem, friendReq, groupInv, eventInv] = await Promise.all([
            AsyncStorage.getItem(`notifications_enabled_${userId}`),
            AsyncStorage.getItem(`event_reminders_${userId}`),
            AsyncStorage.getItem(`friend_requests_${userId}`),
            AsyncStorage.getItem(`group_invites_${userId}`),
            AsyncStorage.getItem(`event_invites_${userId}`)
        ]);

        return {
            notificationsEnabled: notifEnabled !== null ? JSON.parse(notifEnabled) : true,
            eventReminders: eventRem !== null ? JSON.parse(eventRem) : true,
            friendRequests: friendReq !== null ? JSON.parse(friendReq) : true,
            groupInvites: groupInv !== null ? JSON.parse(groupInv) : true,
            eventInvites: eventInv !== null ? JSON.parse(eventInv) : true
        };
    } catch (error) {
        console.error('Error loading notification settings:', error);
        // Return defaults on error
        return {
            notificationsEnabled: true,
            eventReminders: true,
            friendRequests: true,
            groupInvites: true,
            eventInvites: true
        };
    }
}

/**
 * Save user's notification settings to AsyncStorage
 */
export async function saveNotificationSettings(userId: string, settings: NotificationSettings): Promise<void> {
    try {
        await AsyncStorage.multiSet([
            [`notifications_enabled_${userId}`, JSON.stringify(settings.notificationsEnabled)],
            [`event_reminders_${userId}`, JSON.stringify(settings.eventReminders)],
            [`friend_requests_${userId}`, JSON.stringify(settings.friendRequests)],
            [`group_invites_${userId}`, JSON.stringify(settings.groupInvites)],
            [`event_invites_${userId}`, JSON.stringify(settings.eventInvites)]
        ]);
    } catch (error) {
        console.error('Error saving notification settings:', error);
        throw error;
    }
}

/**
 * Check if user should receive a specific type of notification
 */
export async function shouldReceiveNotification(userId: string, type: keyof NotificationSettings): Promise<boolean> {
    try {
        const settings = await getNotificationSettings(userId);

        // If notifications are disabled globally, return false
        if (!settings.notificationsEnabled) {
            return false;
        }

        // Check specific notification type
        return settings[type];
    } catch (error) {
        console.error('Error checking notification permission:', error);
        // Default to true on error to avoid blocking notifications
        return true;
    }
}

/**
 * Check if this is a first-time user
 */
export async function isFirstTimeUser(userId: string): Promise<boolean> {
    try {
        const firstTimeSetupCompleted = await AsyncStorage.getItem(`first_time_setup_${userId}`);
        return firstTimeSetupCompleted === null;
    } catch (error) {
        console.error('Error checking first-time user status:', error);
        return false;
    }
}

/**
 * Mark first-time setup as completed
 */
export async function markFirstTimeSetupComplete(userId: string): Promise<void> {
    try {
        await AsyncStorage.setItem(`first_time_setup_${userId}`, 'true');
    } catch (error) {
        console.error('Error marking first-time setup complete:', error);
        throw error;
    }
}