import { CATEGORIES } from '@/constants/categories';
import { getProfilePhotoUrl, pickProfilePhoto, uploadProfilePhoto } from '@/lib/api/profilePhoto';
import { getUserProfile, updateUserProfile } from '@/lib/api/user';
import { logout } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Settings = () => {
    const router = useRouter();
    const { user, refetch } = useGlobalContext();
    const { isDark, toggleTheme, colors } = useTheme();
    const userId = user?.$id;

    const [firstName, setFirstName] = useState(user?.profile?.firstName || '');
    const [lastName, setLastName] = useState(user?.profile?.lastName || '');
    const [email, setEmail] = useState(user?.email || '');
    const [isPrivate, setIsPrivate] = useState(false);
    const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
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
                    setIsPrivate(!profile.isPublic);
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
                        email,
                        isPublic: !isPrivate,
                        preferences: selectedEventTypes,
                        friends: currentProfile?.friends || [], // Preserve existing friends
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

            // Get current profile to preserve friends list
            const currentProfile = await getUserProfile(userId);

            await updateUserProfile({
                $id: userId,
                firstName,
                lastName,
                email,
                isPublic: !isPrivate,
                preferences: selectedEventTypes,
                friends: currentProfile?.friends || [], // Preserve existing friends
                photoId: user?.profile?.photoId,
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

    const toggleEventType = (type: string) => {
        setSelectedEventTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Enhanced Header */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <MaterialIcons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <View style={styles.settingsIconContainer}>
                            <MaterialIcons name="settings" size={20} color="white" />
                        </View>
                        <Text style={styles.headerTitle}>Settings</Text>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            { backgroundColor: isLoading ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)' }
                        ]}
                        onPress={handleSave}
                        disabled={isLoading}
                    >
                        <MaterialIcons
                            name={isLoading ? "hourglass-empty" : "check"}
                            size={18}
                            color="white"
                        />
                        <Text style={styles.saveButtonText}>
                            {isLoading ? 'Saving...' : 'Save'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="person" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Profile</Text>
                    </View>

                    {/* Profile Photo */}
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
                                Change Photo
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Name Fields */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.text }]}>First Name</Text>
                        <TextInput
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="Enter first name"
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
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Last Name</Text>
                        <TextInput
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Enter last name"
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

                {/* Privacy Section */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="security" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Privacy</Text>
                    </View>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <MaterialIcons name="visibility-off" size={18} color={colors.textSecondary} />
                            <View style={styles.settingTextContainer}>
                                <Text style={[styles.settingTitle, { color: colors.text }]}>Private Profile</Text>
                                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                    Hide your profile from search results
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={isPrivate}
                            onValueChange={setIsPrivate}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor={isPrivate ? '#FFFFFF' : '#f4f3f4'}
                        />
                    </View>
                </View>

                {/* App Settings Section */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="tune" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>App Settings</Text>
                    </View>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <MaterialIcons name="dark-mode" size={18} color={colors.textSecondary} />
                            <View style={styles.settingTextContainer}>
                                <Text style={[styles.settingTitle, { color: colors.text }]}>Dark Mode</Text>
                                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                    Use dark theme throughout the app
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor={isDark ? '#FFFFFF' : '#f4f3f4'}
                        />
                    </View>
                </View>

                {/* Interests Section */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="favorite" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Interests</Text>
                    </View>

                    <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                        Select your interests to see relevant events
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

                {/* Logout Section */}
                <View style={styles.logoutContainer}>
                    <TouchableOpacity
                        onPress={handleLogout}
                        style={styles.logoutButton}
                    >
                        <MaterialIcons name="logout" size={20} color="white" />
                        <Text style={styles.logoutButtonText}>
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
        backgroundColor: '#000',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        padding: 4,
        marginRight: 12,
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingsIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: 'white',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
    },
    scrollContainer: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    card: {
        marginBottom: 16,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
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
    cardDescription: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
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
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        borderColor: '#fff',
    },
    photoPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    photoPlaceholderText: {
        fontSize: 24,
        fontWeight: '700',
        color: 'white',
    },
    photoEditIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        backgroundColor: '#000',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    changePhotoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 20,
    },
    changePhotoText: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    textInput: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 16,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    settingInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingTextContainer: {
        flex: 1,
        marginLeft: 12,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    settingDescription: {
        fontSize: 14,
        lineHeight: 18,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
    },
    tag: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
        marginBottom: 8,
    },
    tagText: {
        fontSize: 14,
        fontWeight: '500',
    },
    logoutContainer: {
        paddingVertical: 20,
        paddingBottom: 40,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EF4444',
        paddingVertical: 16,
        borderRadius: 12,
    },
    logoutButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
});

export default Settings;
