import { getUserProfile, updateUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { MaterialIcons } from '@expo/vector-icons';
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

const PrivacySettings = () => {
    const router = useRouter();
    const { user, refetch } = useGlobalContext();
    const { colors } = useTheme();
    const userId = user?.$id;

    const [isPrivate, setIsPrivate] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Load profile data
    useEffect(() => {
        const loadProfile = async () => {
            if (!userId) return;

            try {
                const profile = await getUserProfile(userId);
                if (profile) {
                    setIsPrivate(!profile.isPublic);
                }
            } catch (err) {
                console.error('Error loading profile:', err);
            }
        };

        loadProfile();
    }, [userId]);

    const handleTogglePrivacy = async (value: boolean) => {
        try {
            setIsLoading(true);
            setIsPrivate(value);

            if (!userId) return;

            // Get current profile to preserve other data
            const currentProfile = await getUserProfile(userId);

            await updateUserProfile({
                $id: userId,
                firstName: currentProfile?.firstName || '',
                lastName: currentProfile?.lastName || '',
                email: currentProfile?.email || user?.email || '',
                isPublic: !value, // Invert because isPrivate is opposite of isPublic
                preferences: currentProfile?.preferences || [],
                friends: currentProfile?.friends || [],
                photoId: currentProfile?.photoId,
            });

            await refetch();
            Alert.alert('Success', 'Privacy settings updated successfully');
        } catch (err) {
            console.error('Error updating privacy settings:', err);
            Alert.alert('Error', 'Failed to update privacy settings');
            // Revert the switch if update failed
            setIsPrivate(!value);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Settings</Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* Privacy Settings Section */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="security" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Profile Privacy</Text>
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingContent}>
                            <Text style={[styles.settingTitle, { color: colors.text }]}>Private Profile</Text>
                            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                When enabled, your profile will be hidden from search results and only friends can see your profile information.
                            </Text>
                        </View>
                        <Switch
                            value={isPrivate}
                            onValueChange={handleTogglePrivacy}
                            disabled={isLoading}
                            trackColor={{ false: '#E0E0E0', true: '#FF8A65' }}
                            thumbColor={isPrivate ? '#FFFFFF' : '#f4f3f4'}
                        />
                    </View>
                </View>

                {/* Information Card */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="info" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Privacy Information</Text>
                    </View>

                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        • Public profiles can be found in search results and viewed by anyone
                    </Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        • Private profiles are only visible to your friends
                    </Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        • Your events and group memberships may still be visible depending on group privacy settings
                    </Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        • Friends can always see your basic profile information regardless of privacy settings
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

export default PrivacySettings;
