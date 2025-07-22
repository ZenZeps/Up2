import { CATEGORIES } from '@/constants/categories';
import { getProfilePhotoUrl, pickProfilePhoto, uploadProfilePhoto } from '@/lib/api/profilePhoto';
import { getUserProfile, updateUserProfile } from '@/lib/api/user';
import { logout } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
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

                    // Update profile with new photo
                    await updateUserProfile({
                        $id: userId,
                        firstName,
                        lastName,
                        email,
                        isPublic: !isPrivate,
                        preferences: selectedEventTypes,
                        friends: [], // Keep existing friends
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

            await updateUserProfile({
                $id: userId,
                firstName,
                lastName,
                email,
                isPublic: !isPrivate,
                preferences: selectedEventTypes,
                friends: [], // Keep existing friends
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
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <ScrollView>
                {/* Header */}
                <View className="px-4 py-3 flex-row items-center justify-between border-b" style={{ borderBottomColor: colors.border }}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text className="text-blue-500 font-rubik-medium">← Back</Text>
                    </TouchableOpacity>
                    <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>
                        Settings
                    </Text>
                    <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                        <Text className={`font-rubik-medium ${isLoading ? 'text-gray-400' : 'text-blue-500'}`}>
                            {isLoading ? 'Saving...' : 'Save'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Profile Section */}
                <View className="px-4 py-4">
                    <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>Profile</Text>

                    {/* Profile Photo */}
                    <View className="items-center mb-6">
                        <TouchableOpacity onPress={handlePhotoUpload} className="mb-2">
                            {profilePhotoUrl ? (
                                <Image
                                    source={{ uri: profilePhotoUrl }}
                                    className="w-24 h-24 rounded-full"
                                />
                            ) : (
                                <View className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center">
                                    <Text className="text-4xl text-gray-400 font-rubik-medium">
                                        {userDisplayUtils.getInitials({ firstName, lastName })}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <Text className="text-sm text-blue-500 font-rubik" onPress={handlePhotoUpload}>
                            Change Photo
                        </Text>
                    </View>

                    {/* Name Fields */}
                    <View className="mb-4">
                        <Text className="text-sm font-rubik-medium mb-2" style={{ color: colors.text }}>First Name</Text>
                        <TextInput
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="Enter first name"
                            className="border border-gray-300 rounded-lg px-3 py-2 font-rubik"
                            style={{ color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }}
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>

                    <View className="mb-4">
                        <Text className="text-sm font-rubik-medium mb-2" style={{ color: colors.text }}>Last Name</Text>
                        <TextInput
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Enter last name"
                            className="border border-gray-300 rounded-lg px-3 py-2 font-rubik"
                            style={{ color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }}
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>

                    <View className="mb-4">
                        <Text className="text-sm font-rubik-medium mb-2" style={{ color: colors.text }}>Email</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Enter email"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            className="border border-gray-300 rounded-lg px-3 py-2 font-rubik"
                            style={{ color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }}
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>
                </View>

                {/* Privacy Section */}
                <View className="px-4 py-4 border-t" style={{ borderTopColor: colors.border }}>
                    <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>Privacy</Text>

                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-1">
                            <Text className="font-rubik-medium" style={{ color: colors.text }}>Private Profile</Text>
                            <Text className="text-sm font-rubik" style={{ color: colors.textSecondary }}>
                                Hide your profile from search results
                            </Text>
                        </View>
                        <Switch
                            value={isPrivate}
                            onValueChange={setIsPrivate}
                            trackColor={{ false: colors.border, true: '#007AFF' }}
                            thumbColor={isPrivate ? '#FFFFFF' : '#f4f3f4'}
                        />
                    </View>
                </View>

                {/* App Settings Section */}
                <View className="px-4 py-4 border-t" style={{ borderTopColor: colors.border }}>
                    <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>App Settings</Text>

                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-1">
                            <Text className="font-rubik-medium" style={{ color: colors.text }}>Dark Mode</Text>
                            <Text className="text-sm font-rubik" style={{ color: colors.textSecondary }}>
                                Use dark theme throughout the app
                            </Text>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: colors.border, true: '#007AFF' }}
                            thumbColor={isDark ? '#FFFFFF' : '#f4f3f4'}
                        />
                    </View>
                </View>

                {/* Interests Section */}
                <View className="px-4 py-4 border-t" style={{ borderTopColor: colors.border }}>
                    <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>Interests</Text>
                    <Text className="text-sm font-rubik mb-4" style={{ color: colors.textSecondary }}>
                        Select your interests to see relevant events
                    </Text>

                    <View className="flex-row flex-wrap">
                        {CATEGORIES.map((category) => {
                            const isSelected = selectedEventTypes.includes(category.value);
                            return (
                                <TouchableOpacity
                                    key={category.value}
                                    onPress={() => toggleEventType(category.value)}
                                    className={`mr-2 mb-2 px-3 py-2 rounded-full border ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                                        }`}
                                    style={{
                                        backgroundColor: isSelected ? '#007AFF' : colors.surface,
                                        borderColor: isSelected ? '#007AFF' : colors.border,
                                    }}
                                >
                                    <Text
                                        className={`text-sm font-rubik ${isSelected ? 'text-white' : ''}`}
                                        style={{ color: isSelected ? 'white' : colors.text }}
                                    >
                                        {category.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Logout Section */}
                <View className="px-4 py-6 border-t" style={{ borderTopColor: colors.border }}>
                    <TouchableOpacity
                        onPress={handleLogout}
                        className="bg-red-500 py-3 rounded-lg"
                    >
                        <Text className="text-white text-center font-rubik-medium">
                            Log Out
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Settings;
