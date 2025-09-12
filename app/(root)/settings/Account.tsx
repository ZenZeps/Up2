import { Background } from '@/components/Background';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
import { getUserProfile, updateUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

const AccountSettings = () => {
    const router = useRouter();
    const { user, refetch } = useGlobalContext();
    const { isDark, toggleTheme, isColorful, setColorfulMode, colors } = useTheme();
    const { currentLanguage, setLanguage, t } = useLanguage();
    const userId = user?.$id;

    const handleLanguageChange = () => {
        Alert.alert(
            t('settings.language'),
            t('settings.changeLanguage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: 'English',
                    onPress: async () => {
                        await setLanguage('en');
                        // Also update the user profile with the language preference
                        if (userId) {
                            try {
                                const currentProfile = await getUserProfile(userId);
                                if (currentProfile) {
                                    await updateUserProfile({
                                        ...currentProfile,
                                        language: 'en'
                                    });
                                    Alert.alert(t('common.success'), t('accountSettings.languageUpdatedInProfile'));
                                } else {
                                    Alert.alert(t('common.success'), 'Language changed to English');
                                }
                            } catch (error) {
                                Alert.alert(t('common.success'), 'Language changed to English');
                            }
                        } else {
                            Alert.alert(t('common.success'), 'Language changed to English');
                        }
                    }
                },
                {
                    text: 'Español',
                    onPress: async () => {
                        await setLanguage('es');
                        // Also update the user profile with the language preference
                        if (userId) {
                            try {
                                const currentProfile = await getUserProfile(userId);
                                if (currentProfile) {
                                    await updateUserProfile({
                                        ...currentProfile,
                                        language: 'es'
                                    });
                                    Alert.alert(t('common.success'), t('accountSettings.languageUpdatedInProfile'));
                                } else {
                                    Alert.alert(t('common.success'), 'Idioma cambiado a Español');
                                }
                            } catch (error) {
                                Alert.alert(t('common.success'), 'Idioma cambiado a Español');
                            }
                        } else {
                            Alert.alert(t('common.success'), 'Idioma cambiado a Español');
                        }
                    }
                }
            ]
        );
    };

    const handleChangePassword = () => {
        const userEmail = user?.email || '';

        if (userEmail) {
            // If we have the user's email, show confirmation dialog
            Alert.alert(
                'Change Password',
                `Send password reset link to ${userEmail}?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Send Reset Link',
                        onPress: async () => {
                            try {
                                const { PasswordResetHandler } = await import('@/lib/auth/passwordReset');
                                await PasswordResetHandler.sendResetEmail(userEmail.toLowerCase());
                                Alert.alert(
                                    'Reset Link Sent',
                                    `A password reset link has been sent to ${userEmail}. Please check your inbox and spam folder.`
                                );
                            } catch (err: any) {
                                console.error('Failed to send password reset email:', err);
                                Alert.alert('Error', err.message || 'Failed to send password reset email');
                            }
                        }
                    }
                ]
            );
        } else {
            // If no email available, use the dialog to get email
            import('@/lib/auth/passwordReset').then(({ PasswordResetHandler }) => {
                PasswordResetHandler.showForgotPasswordDialog(
                    "",
                    (emailAddress) => {
                        Alert.alert(
                            'Reset Link Sent',
                            `A password reset link has been sent to ${emailAddress}. Please check your inbox and spam folder.`
                        );
                    }
                );
            }).catch((err) => {
                console.error('Failed to load password reset handler:', err);
                Alert.alert('Error', 'Failed to load password reset functionality');
            });
        }
    };

    return (
        <Background>
            <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Account Settings</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                    {/* App Preferences */}
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.cardHeader}>
                            <MaterialIcons name="settings" size={20} color={colors.primary} />
                            <Text style={[styles.cardTitle, { color: colors.text }]}>App Preferences</Text>
                        </View>

                        {/* Dark Mode Toggle */}
                        <View style={styles.settingItem}>
                            <View style={styles.settingContent}>
                                <Text style={[styles.settingTitle, { color: colors.text }]}>{t('settings.darkMode')}</Text>
                                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                    {t('settings.useDarkTheme')}
                                </Text>
                            </View>
                            <Switch
                                value={isDark}
                                onValueChange={toggleTheme}
                                trackColor={{ false: '#E0E0E0', true: '#FF8A65' }}
                                thumbColor={isDark ? '#FFFFFF' : '#f4f3f4'}
                            />
                        </View>

                        {/* Colorful Mode Toggle */}
                        <View style={[styles.settingItem, styles.settingItemBorder, { borderTopColor: colors.border }]}>
                            <View style={styles.settingContent}>
                                <Text style={[styles.settingTitle, { color: colors.text }]}>{t('settings.colorfulMode')}</Text>
                                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                    {t('settings.useColorfulTheme')}
                                </Text>
                            </View>
                            <Switch
                                value={isColorful}
                                onValueChange={setColorfulMode}
                                trackColor={{ false: '#E0E0E0', true: '#FF8A65' }}
                                thumbColor={isColorful ? '#FFFFFF' : '#f4f3f4'}
                            />
                        </View>

                        {/* Language Setting */}
                        <TouchableOpacity style={[styles.settingItem, styles.settingItemBorder, { borderTopColor: colors.border }]} onPress={handleLanguageChange}>
                            <View style={styles.settingContent}>
                                <Text style={[styles.settingTitle, { color: colors.text }]}>{t('settings.language')}</Text>
                                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                    {t('settings.changeLanguage')} ({currentLanguage === 'en' ? 'English' : 'Español'})
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.chevronButton} onPress={handleLanguageChange}>
                                <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </View>

                    {/* Security Settings */}
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.cardHeader}>
                            <MaterialIcons name="security" size={20} color={colors.primary} />
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Security</Text>
                        </View>

                        {/* Change Password */}
                        <TouchableOpacity style={styles.settingItem} onPress={handleChangePassword}>
                            <View style={styles.settingContent}>
                                <Text style={[styles.settingTitle, { color: colors.text }]}>Change Password</Text>
                                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                    Send a password reset email to change your password
                                </Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Delete Account */}
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.cardHeader}>
                            <MaterialIcons name="delete" size={20} color={colors.primary} />
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Delete Account</Text>
                        </View>

                        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                            Permanently delete your account and all associated data. This action cannot be undone.
                        </Text>

                        {userId && (
                            <DeleteAccountButton
                                userId={userId}
                                onDeleteComplete={() => {
                                    // Handle any cleanup if needed
                                    refetch();
                                }}
                            />
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </Background>
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
        width: 40,
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
    cardDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
        lineHeight: 20,
    },
    chevronButton: {
        padding: 4,
    },
});

export default AccountSettings;
