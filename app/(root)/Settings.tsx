import { logout } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Settings = () => {
    const router = useRouter();
    const { user, refetch } = useGlobalContext();
    const { isDark, toggleTheme, colors } = useTheme();
    const userId = user?.$id;

    const handleLogout = async () => {
        try {
            await logout();

            // Clear the global state by refetching (which will detect no session)
            await refetch();

            // Use router to navigate instead of window.location
            router.replace('/SignIn');
        } catch (err) {
            console.error('Logout failed:', err);
            Alert.alert('Error', 'Failed to log out');
        }
    };

    const handleChangePassword = () => {
        // Use PasswordResetHandler to send reset email for signed-in user
        Alert.prompt(
            'Change Password',
            'Enter your email to receive a password reset link:',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send',
                    onPress: async (emailInput?: string) => {
                        const emailToUse = emailInput?.trim() || user?.email || '';
                        if (!emailToUse) {
                            Alert.alert('Error', 'Please enter a valid email address');
                            return;
                        }

                        try {
                            const { PasswordResetHandler } = await import('@/lib/auth/passwordReset');
                            await PasswordResetHandler.sendResetEmail(emailToUse.toLowerCase());
                            Alert.alert('Success', 'Password reset email sent');
                        } catch (err: any) {
                            console.error('Failed to send password reset email:', err);
                            Alert.alert('Error', err.message || 'Failed to send password reset email');
                        }
                    }
                }
            ],
            'plain-text',
            user?.email || '',
            'email-address'
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* Settings Menu */}
                <View style={styles.settingsContainer}>
                    {/* Profile Settings */}
                    <TouchableOpacity
                        style={[styles.settingItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => router.push('/(root)/settings/Profile')}
                    >
                        <MaterialIcons name="person" size={24} color={colors.text} />
                        <View style={styles.settingTextContainer}>
                            <Text style={[styles.settingText, { color: colors.text }]}>Profile Settings</Text>
                            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                Edit your personal information and profile photo
                            </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>

                    {/* Privacy Settings */}
                    <TouchableOpacity
                        style={[styles.settingItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => router.push('/(root)/settings/Privacy')}
                    >
                        <MaterialIcons name="security" size={24} color={colors.text} />
                        <View style={styles.settingTextContainer}>
                            <Text style={[styles.settingText, { color: colors.text }]}>Privacy Settings</Text>
                            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                Control who can see your profile and information
                            </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>

                    {/* Notification Settings */}
                    <TouchableOpacity
                        style={[styles.settingItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => router.push('/(root)/settings/Notifications')}
                    >
                        <MaterialIcons name="notifications" size={24} color={colors.text} />
                        <View style={styles.settingTextContainer}>
                            <Text style={[styles.settingText, { color: colors.text }]}>Notifications</Text>
                            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                Manage your notification preferences
                            </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>

                    {/* Account Settings */}
                    <TouchableOpacity
                        style={[styles.settingItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => router.push('/(root)/settings/Account')}
                    >
                        <MaterialIcons name="settings" size={24} color={colors.text} />
                        <View style={styles.settingTextContainer}>
                            <Text style={[styles.settingText, { color: colors.text }]}>Account Settings</Text>
                            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                Dark mode, language, password, and account deletion
                            </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Logout Section */}
                <View style={styles.logoutContainer}>
                    <TouchableOpacity
                        onPress={handleLogout}
                        style={[styles.logoutButton, { backgroundColor: colors.primary }]}
                    >
                        <MaterialIcons name="logout" size={20} color={colors.buttonText} />
                        <Text style={[styles.logoutButtonText, { color: colors.buttonText }]}>
                            Log Out
                        </Text>
                    </TouchableOpacity>
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
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 10,
    },
    headerSpacer: {
        width: 40, // Same width as back button to center the title
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
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 8,
    },
    welcomeText: {
        fontSize: 16,
        lineHeight: 22,
    },
    settingsContainer: {
        marginHorizontal: 16,
        marginTop: 20,
        gap: 1,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderWidth: 1,
        borderRadius: 12,
        marginBottom: 8,
    },
    settingTextContainer: {
        flex: 1,
        marginLeft: 16,
        marginRight: 8,
    },
    settingText: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 2,
    },
    settingDescription: {
        fontSize: 14,
        lineHeight: 18,
    },
    logoutContainer: {
        margin: 16,
        marginTop: 32,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
    },
    logoutButtonText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    dangerZone: {
        margin: 16,
        marginTop: 32,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    dangerZoneCard: {
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
    },
    dangerZoneHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    dangerZoneText: {
        flex: 1,
        marginLeft: 12,
    },
    dangerZoneTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    dangerZoneDescription: {
        fontSize: 14,
        lineHeight: 20,
    },
});

export default Settings;
