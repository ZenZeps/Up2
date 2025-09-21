import { CATEGORIES } from '@/constants/categories';
import { getProfilePhotoUrl, pickProfilePhoto, uploadProfilePhoto } from '@/lib/api/profilePhoto';
import { getUserProfile, updateUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ProfileSettings = () => {
    const router = useRouter();
    const { user, refetch } = useGlobalContext();
    const { colors } = useTheme();
    const { t } = useLanguage();
    const userId = user?.$id;

    const [firstName, setFirstName] = useState(user?.profile?.firstName || '');
    const [lastName, setLastName] = useState(user?.profile?.lastName || '');
    const [email, setEmail] = useState(user?.email || '');
    const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
    const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Load profile data
    useEffect(() => {
        const loadProfile = async () => {
            if (!userId) return;

            try {
                const profile = await getUserProfile(userId);

                if (profile) {
                    setFirstName(profile.firstName || '');
                    setLastName(profile.lastName || '');
                    setEmail(profile.email || user?.email || '');
                    setSelectedEventTypes(profile.preferences || []);

                    if (profile.photoId) {
                        const photoUrl = await getProfilePhotoUrl(profile.photoId);
                        setProfilePhotoUrl(photoUrl);
                    }
                }
            } catch (err) {
                console.error('Error loading profile:', err);
            }
        };

        loadProfile();
    }, [userId, user?.email]);

    const handlePhotoUpload = async () => {
        try {
            console.log('Starting photo upload...');
            const result = await pickProfilePhoto();
            console.log('Photo picked:', result);

            if (result && userId) {
                console.log('Uploading photo for user:', userId);
                const photoId = await uploadProfilePhoto(userId, result.uri);
                console.log('Photo uploaded with ID:', photoId);

                if (photoId) {
                    const photoUrl = await getProfilePhotoUrl(photoId);
                    console.log('Photo URL generated:', photoUrl);
                    setProfilePhotoUrl(photoUrl);

                    // Get current profile to preserve friends list
                    const currentProfile = await getUserProfile(userId);

                    // Update profile with new photo, preserving existing friends
                    await updateUserProfile({
                        $id: userId,
                        firstName,
                        lastName,
                        name: `${firstName} ${lastName}`.trim(),
                        email,
                        isPublic: currentProfile?.isPublic ?? true,
                        preferences: selectedEventTypes,
                        friends: currentProfile?.friends || [],
                        photoId,
                    });

                    refetch();
                    Alert.alert('Success', 'Profile photo updated successfully');
                }
            }
        } catch (error: any) {
            console.error('Error uploading photo:', error);
            Alert.alert('Error', `Failed to upload photo: ${error.message || 'Unknown error'}`);
        }
    };

    const handleSave = async () => {
        if (!userId) return;

        try {
            setIsLoading(true);

            // Get current profile to preserve other data
            const currentProfile = await getUserProfile(userId);

            await updateUserProfile({
                $id: userId,
                firstName,
                lastName,
                name: `${firstName} ${lastName}`.trim(),
                email,
                isPublic: currentProfile?.isPublic ?? true,
                preferences: selectedEventTypes,
                friends: currentProfile?.friends || [],
                photoId: currentProfile?.photoId,
            });

            await refetch();
            Alert.alert('Success', 'Profile updated successfully');
        } catch (err) {
            console.error('Error updating profile:', err);
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleEventType = (type: string) => {
        setSelectedEventTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Profile Settings</Text>
                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleSave}
                    disabled={isLoading}
                >
                    <MaterialIcons
                        name={isLoading ? "hourglass-empty" : "check"}
                        size={18}
                        color={colors.buttonText}
                    />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* Profile Photo Section */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="photo-camera" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Profile Photo</Text>
                    </View>

                    <View style={styles.photoSection}>
                        <TouchableOpacity style={styles.photoContainer} onPress={handlePhotoUpload}>
                            {profilePhotoUrl ? (
                                <Image
                                    source={{ uri: profilePhotoUrl }}
                                    style={styles.profilePhoto}
                                />
                            ) : (
                                <View style={[styles.photoPlaceholder, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.photoPlaceholderText}>
                                        {userDisplayUtils.getInitials({ firstName, lastName })}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.photoEditIndicator}>
                                <MaterialIcons name="camera-alt" size={16} color="white" />
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.changePhotoButton} onPress={handlePhotoUpload}>
                            <MaterialIcons name="edit" size={16} color={colors.primary} />
                            <Text style={[styles.changePhotoText, { color: colors.primary }]}>
                                {t('settingsProfile.changePhoto')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Personal Information Section */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="person" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settingsProfile.personalInformation')}</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.text }]}>{t('settingsProfile.firstName')}</Text>
                        <TextInput
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder={t('settingsProfile.enterFirstName')}
                            style={[
                                styles.textInput,
                                {
                                    color: colors.text,
                                    backgroundColor: colors.background,
                                    borderColor: colors.border
                                }
                            ]}
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.text }]}>{t('settingsProfile.lastName')}</Text>
                        <TextInput
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder={t('settingsProfile.enterLastName')}
                            style={[
                                styles.textInput,
                                {
                                    color: colors.text,
                                    backgroundColor: colors.background,
                                    borderColor: colors.border
                                }
                            ]}
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Email</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Enter email"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            style={[
                                styles.textInput,
                                {
                                    color: colors.text,
                                    backgroundColor: colors.background,
                                    borderColor: colors.border
                                }
                            ]}
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>
                </View>

                {/* Interests Section */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="favorite" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Your Interests</Text>
                    </View>

                    <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                        Select your interests to see relevant events and connect with like-minded people
                    </Text>

                    <View style={styles.tagsContainer}>
                        {CATEGORIES.map((category) => {
                            const isSelected = selectedEventTypes.includes(category.value);
                            return (
                                <TouchableOpacity
                                    key={category.value}
                                    onPress={() => toggleEventType(category.value)}
                                    style={[
                                        styles.tag,
                                        {
                                            backgroundColor: isSelected ? colors.primary : colors.background,
                                            borderColor: isSelected ? colors.primary : colors.border,
                                        }
                                    ]}
                                >
                                    <Text style={styles.tagEmoji}>{category.emoji}</Text>
                                    <Text
                                        style={[
                                            styles.tagText,
                                            { color: isSelected ? 'white' : colors.text }
                                        ]}
                                    >
                                        {category.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Blocked Users Section */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="block" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Blocked Users</Text>
                    </View>

                    <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                        Manage users you have blocked from interacting with you
                    </Text>

                    <TouchableOpacity
                        style={[styles.actionButton, { borderColor: colors.border }]}
                        onPress={() => router.push('/(root)/settings/BlockedUsers')}
                    >
                        <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                        <Text style={[styles.actionButtonText, { color: colors.text }]}>
                            View Blocked Users
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
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 10,
    },
    saveButton: {
        padding: 8,
        borderRadius: 20,
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
    photoSection: {
        alignItems: 'center',
        marginBottom: 20,
    },
    photoContainer: {
        position: 'relative',
        marginBottom: 12,
    },
    profilePhoto: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    photoPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoPlaceholderText: {
        color: 'white',
        fontSize: 24,
        fontWeight: '600',
    },
    photoEditIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#FF8A65',
        borderRadius: 15,
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    changePhotoButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    changePhotoText: {
        marginLeft: 4,
        fontSize: 14,
        fontWeight: '500',
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 16,
    },
    cardDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
        lineHeight: 20,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 8,
    },
    tagEmoji: {
        fontSize: 16,
        marginRight: 6,
    },
    tagText: {
        fontSize: 14,
        fontWeight: '500',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderRadius: 8,
        marginTop: 8,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
    },
});

export default ProfileSettings;
