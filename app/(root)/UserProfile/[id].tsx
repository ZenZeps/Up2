import { getUserGroups } from '@/lib/api/group';
import { getProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getFriends, getUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { Group } from '@/lib/types/Groups';
import { UserProfile as UserProfileType } from '@/lib/types/Users';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    Image,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';

const UserProfile = () => {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { user: currentUser } = useGlobalContext();
    const { colors } = useTheme();
    const userId = Array.isArray(id) ? id[0] : id;

    const [userProfile, setUserProfile] = useState<UserProfileType | null>(null);
    const [friends, setFriends] = useState<any[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        friends: 0,
        groups: 0,
    });

    // Load user data
    useEffect(() => {
        const loadUserData = async () => {
            if (!userId) return;

            try {
                setLoading(true);

                // Load user profile
                const profile = await getUserProfile(userId);
                if (!profile) {
                    router.back();
                    return;
                } setUserProfile(profile);

                // Load friends and groups
                const [userFriends, userGroups] = await Promise.all([
                    getFriends(userId),
                    getUserGroups(userId)
                ]);

                setFriends(userFriends || []);
                setGroups(userGroups || []);
                setStats({
                    friends: userFriends?.length || 0,
                    groups: userGroups?.length || 0,
                });

                // Load profile photo if available
                if (profile?.photoId) {
                    const photoUrl = await getProfilePhotoUrl(profile.photoId);
                    setProfilePhotoUrl(photoUrl);
                }
            } catch (error) {
                console.error('Error loading user profile:', error);
            } finally {
                setLoading(false);
            }
        };

        loadUserData();
    }, [userId]);

    const handleMessageUser = () => {
        // Navigate to conversation with this user
        router.push(`/(root)/Messages/${userId}` as any);
    };

    const handleViewCalendar = () => {
        try {
            console.log('Navigating to calendar for user:', userId);
            // Navigate to user's calendar page
            router.push(`/(root)/UserCalendar/${userId}` as any);
        } catch (error) {
            console.error('Error navigating to calendar:', error);
        }
    }; if (loading) {
        return (
            <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
                <View className="flex-1 items-center justify-center">
                    <Text style={{ color: colors.text }}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!userProfile) {
        return (
            <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
                <View className="flex-1 items-center justify-center">
                    <Text style={{ color: colors.text }}>User not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    const { firstName = '', lastName = '' } = userProfile || {};

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            {/* Header */}
            <LinearGradient
                colors={['#1a1a1a', '#4a4a4a']}
                start={[0, 0]}
                end={[1, 0]}
                className="flex-row items-center justify-between p-4 border-b"
                style={{ borderBottomColor: '#333333' }}
            >
                <TouchableOpacity onPress={() => router.back()} className="mr-3">
                    <Text className="text-lg font-rubik-medium" style={{ color: '#ffffff' }}>←</Text>
                </TouchableOpacity>
                <View className="flex-row items-center flex-1">
                    {profilePhotoUrl ? (
                        <Image
                            source={{ uri: profilePhotoUrl }}
                            className="w-16 h-16 rounded-full"
                        />
                    ) : (
                        <View className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center">
                            <Text className="text-xl text-gray-400 font-rubik-medium">
                                {userDisplayUtils.getInitials({ firstName, lastName })}
                            </Text>
                        </View>
                    )}
                    <View className="ml-3 flex-1">
                        <Text className="text-xl font-rubik-semibold" style={{ color: '#ffffff' }}>
                            {userDisplayUtils.getFullName({ firstName, lastName })}
                        </Text>
                    </View>
                </View>
                <View className="flex-row items-center">
                    <View className="flex-row items-center">
                        <View className="items-center mr-4">
                            <Text className="text-lg font-rubik-semibold" style={{ color: '#ffffff' }}>{stats.friends}</Text>
                            <Text className="text-xs" style={{ color: '#ffffff', opacity: 0.8 }}>Friends</Text>
                        </View>
                        <View className="items-center">
                            <Text className="text-lg font-rubik-semibold" style={{ color: '#ffffff' }}>{stats.groups}</Text>
                            <Text className="text-xs" style={{ color: '#ffffff', opacity: 0.8 }}>Groups</Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
                {/* Profile Info Section */}
                <View className="px-4 py-4">
                    {/* Status Section - Only show if user has a status */}
                    {userProfile.status && (
                        <View className="mb-6">
                            <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>Status</Text>
                            <View className="p-3 rounded-lg" style={{ backgroundColor: colors.surface }}>
                                <Text className="text-base font-rubik" style={{ color: colors.text }}>
                                    {userProfile.status}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* About Me Section - Only show if user has nationality or age */}
                    {(userProfile.nationality || userProfile.age) && (
                        <View className="mb-6">
                            <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>About Me</Text>
                            <View className="p-3 rounded-lg" style={{ backgroundColor: colors.surface }}>
                                {userProfile.nationality && (
                                    <View className={`flex-row justify-between items-center ${userProfile.age ? 'mb-2' : ''}`}>
                                        <Text className="text-sm font-rubik-medium" style={{ color: colors.textSecondary }}>Nationality:</Text>
                                        <Text className="text-base font-rubik" style={{ color: colors.text }}>
                                            {userProfile.nationality}
                                        </Text>
                                    </View>
                                )}
                                {userProfile.age && (
                                    <View className="flex-row justify-between items-center">
                                        <Text className="text-sm font-rubik-medium" style={{ color: colors.textSecondary }}>Age:</Text>
                                        <Text className="text-base font-rubik" style={{ color: colors.text }}>
                                            {userProfile.age} years old
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Friends Section */}
                    <View className="mt-6">
                        <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>Friends</Text>
                        <View style={{ height: 100 }}>
                            <FlatList
                                data={friends}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={(item) => item.$id}
                                nestedScrollEnabled={true}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        className="mr-4 items-center"
                                        onPress={() => {
                                            // Navigate to another user's profile
                                            router.push(`/(root)/UserProfile/${item.$id}` as any);
                                        }}
                                    >
                                        <UserAvatar
                                            photoUrl={item.photoId ? getProfilePhotoUrl(item.photoId) : null}
                                            firstName={item.firstName}
                                            lastName={item.lastName}
                                            size={64}
                                        />
                                        <Text className="text-sm font-rubik mt-1" style={{ color: colors.text }}>{userDisplayUtils.getFullName(item)}</Text>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <Text className="text-gray-500 font-rubik" style={{ color: colors.textSecondary }}>No friends yet</Text>
                                }
                            />
                        </View>
                    </View>

                    {/* Groups Section */}
                    <View className="mt-6">
                        <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>Groups</Text>
                        <View style={{ height: 100 }}>
                            <FlatList
                                data={groups}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={(item) => item.$id}
                                nestedScrollEnabled={true}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        className="mr-4 items-center"
                                        onPress={() => router.push(`/Group/${item.$id}`)}
                                    >
                                        <View className="w-16 h-16 rounded-full bg-black items-center justify-center mb-2">
                                            <Text className="text-white text-xl font-rubik-semibold">
                                                {item.title.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text
                                            className="text-sm font-rubik text-center"
                                            style={{ color: colors.text }}
                                            numberOfLines={1}
                                        >
                                            {item.title}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <Text className="text-gray-500 font-rubik" style={{ color: colors.textSecondary }}>No groups yet</Text>
                                }
                            />
                        </View>
                    </View>

                    {/* View Calendar Button */}
                    <View className="mt-6">
                        <TouchableOpacity
                            onPress={handleViewCalendar}
                            className="bg-black py-3 px-6 rounded-lg items-center"
                        >
                            <Text className="text-white font-rubik-semibold text-lg">View Calendar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default UserProfile;
