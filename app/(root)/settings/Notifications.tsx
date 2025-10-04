import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const NotificationSettings = () => {
    const router = useRouter();
    const { user, refetch } = useGlobalContext();
    const { colors } = useTheme();
    const userId = user?.$id;

    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [eventReminders, setEventReminders] = useState(true);
    const [friendRequests, setFriendRequests] = useState(true);
    const [groupInvites, setGroupInvites] = useState(true);
    const [eventInvites, setEventInvites] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    // Initialize notification settings from AsyncStorage
    useEffect(() => {
        const loadNotificationSettings = async () => {
            if (!userId) return;

            try {
                const [notifEnabled, eventRem, friendReq, groupInv, eventInv] = await Promise.all([
                    AsyncStorage.getItem(`notifications_enabled_${userId}`),
                    AsyncStorage.getItem(`event_reminders_${userId}`),
                    AsyncStorage.getItem(`friend_requests_${userId}`),
                    AsyncStorage.getItem(`group_invites_${userId}`),
                    AsyncStorage.getItem(`event_invites_${userId}`)
                ]);

                setNotificationsEnabled(notifEnabled !== null ? JSON.parse(notifEnabled) : true);
                setEventReminders(eventRem !== null ? JSON.parse(eventRem) : true);
                setFriendRequests(friendReq !== null ? JSON.parse(friendReq) : true);
                setGroupInvites(groupInv !== null ? JSON.parse(groupInv) : true);
                setEventInvites(eventInv !== null ? JSON.parse(eventInv) : true);
            } catch (err) {
                console.error('Error loading notification settings:', err);
                // Set defaults on error
                setNotificationsEnabled(true);
                setEventReminders(true);
                setFriendRequests(true);
                setGroupInvites(true);
                setEventInvites(true);
            }
        };

        loadNotificationSettings();
    }, [userId]);

    const handleToggleNotifications = async (value: boolean) => {
        if (!userId) return;

        try {
            setIsLoading(true);
            setNotificationsEnabled(value);

            // Store in AsyncStorage
            await AsyncStorage.setItem(`notifications_enabled_${userId}`, JSON.stringify(value));

            console.log(`Notifications ${value ? 'enabled' : 'disabled'}`);
            Alert.alert('Success', `Notifications ${value ? 'enabled' : 'disabled'}`);
        } catch (err) {
            console.error('Error updating notification settings:', err);
            Alert.alert('Error', 'Failed to update notification settings');
            setNotificationsEnabled(!value);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleSpecificNotification = async (type: string, value: boolean) => {
        if (!userId) return;

        try {
            switch (type) {
                case 'eventReminders':
                    setEventReminders(value);
                    await AsyncStorage.setItem(`event_reminders_${userId}`, JSON.stringify(value));
                    break;
                case 'friendRequests':
                    setFriendRequests(value);
                    await AsyncStorage.setItem(`friend_requests_${userId}`, JSON.stringify(value));
                    break;
                case 'groupInvites':
                    setGroupInvites(value);
                    await AsyncStorage.setItem(`group_invites_${userId}`, JSON.stringify(value));
                    break;
                case 'eventInvites':
                    setEventInvites(value);
                    await AsyncStorage.setItem(`event_invites_${userId}`, JSON.stringify(value));
                    break;
            }
            console.log(`${type} ${value ? 'enabled' : 'disabled'}`);
        } catch (err) {
            console.error(`Error updating ${type}:`, err);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* General Notifications Section */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="notifications" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>General Notifications</Text>
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingContent}>
                            <Text style={[styles.settingTitle, { color: colors.text }]}>Push Notifications</Text>
                            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                Receive push notifications for events and activities
                            </Text>
                        </View>
                        <Switch
                            value={!!notificationsEnabled}
                            onValueChange={handleToggleNotifications}
                            disabled={isLoading}
                            trackColor={{ false: '#E0E0E0', true: '#FF8A65' }}
                            thumbColor={notificationsEnabled ? '#FFFFFF' : '#f4f3f4'}
                        />
                    </View>
                </View>

                {/* Specific Notification Types */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="tune" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Notification Types</Text>
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingContent}>
                            <Text style={[styles.settingTitle, { color: colors.text }]}>Event Reminders</Text>
                            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                Get notified about upcoming events you're attending
                            </Text>
                        </View>
                        <Switch
                            value={eventReminders}
                            onValueChange={(value) => handleToggleSpecificNotification('eventReminders', value)}
                            disabled={!notificationsEnabled}
                            trackColor={{ false: '#E0E0E0', true: '#FF8A65' }}
                            thumbColor={eventReminders && notificationsEnabled ? '#FFFFFF' : '#f4f3f4'}
                        />
                    </View>

                    <View style={[styles.settingItem, styles.settingItemBorder, { borderTopColor: colors.border }]}>
                        <View style={styles.settingContent}>
                            <Text style={[styles.settingTitle, { color: colors.text }]}>Friend Requests</Text>
                            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                Get notified when someone sends you a friend request
                            </Text>
                        </View>
                        <Switch
                            value={friendRequests}
                            onValueChange={(value) => handleToggleSpecificNotification('friendRequests', value)}
                            disabled={!notificationsEnabled}
                            trackColor={{ false: '#E0E0E0', true: '#FF8A65' }}
                            thumbColor={friendRequests && notificationsEnabled ? '#FFFFFF' : '#f4f3f4'}
                        />
                    </View>

                    <View style={[styles.settingItem, styles.settingItemBorder, { borderTopColor: colors.border }]}>
                        <View style={styles.settingContent}>
                            <Text style={[styles.settingTitle, { color: colors.text }]}>Group Invites</Text>
                            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                Get notified when you're invited to join a group
                            </Text>
                        </View>
                        <Switch
                            value={groupInvites}
                            onValueChange={(value) => handleToggleSpecificNotification('groupInvites', value)}
                            disabled={!notificationsEnabled}
                            trackColor={{ false: '#E0E0E0', true: '#FF8A65' }}
                            thumbColor={groupInvites && notificationsEnabled ? '#FFFFFF' : '#f4f3f4'}
                        />
                    </View>

                    <View style={[styles.settingItem, styles.settingItemBorder, { borderTopColor: colors.border }]}>
                        <View style={styles.settingContent}>
                            <Text style={[styles.settingTitle, { color: colors.text }]}>Event Invites</Text>
                            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                Get notified when you're invited to events
                            </Text>
                        </View>
                        <Switch
                            value={eventInvites}
                            onValueChange={(value) => handleToggleSpecificNotification('eventInvites', value)}
                            disabled={!notificationsEnabled}
                            trackColor={{ false: '#E0E0E0', true: '#FF8A65' }}
                            thumbColor={eventInvites && notificationsEnabled ? '#FFFFFF' : '#f4f3f4'}
                        />
                    </View>
                </View>

                {/* Information Card */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="info" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Notification Information</Text>
                    </View>

                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        • Notifications must be enabled to receive any type of notification
                    </Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        • You can control specific notification types even when general notifications are on
                    </Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        • Some notifications may still appear in the app even if push notifications are disabled
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
        width: 40,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 10,
    },
    scrollContainer: {
        flex: 1,
    },
    card: {
        margin: 16,
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 8,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    settingItemBorder: {
        borderTopWidth: 1,
        marginTop: 12,
        paddingTop: 20,
    },
    settingContent: {
        flex: 1,
        marginRight: 16,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 14,
        lineHeight: 20,
    },
    infoText: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8,
    },
});

export default NotificationSettings;
