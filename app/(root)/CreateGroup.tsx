import { createGroup } from '@/lib/api/group';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getAllUsers } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { UserProfile } from '@/lib/types/Users';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserAvatar from './components/UserAvatar';

const CreateGroup = () => {
    const router = useRouter();
    const { user } = useGlobalContext();
    const { colors } = useTheme();
    const userId = user?.$id;

    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [userPhotoUrls, setUserPhotoUrls] = useState<Record<string, string | null>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);

    useEffect(() => {
        const loadUsers = async () => {
            try {
                const users = await getAllUsers();
                // Filter out current user
                const otherUsers = users.filter(u => u.$id !== userId);
                setAllUsers(otherUsers);

                // Load profile photos for all users
                const photoUrls: Record<string, string | null> = {};
                for (const user of otherUsers) {
                    try {
                        const photoUrl = await getUserProfilePhotoUrl(user.$id);
                        photoUrls[user.$id] = photoUrl;
                    } catch (error) {
                        console.error(`Error fetching photo for user ${user.$id}:`, error);
                        photoUrls[user.$id] = null;
                    }
                }
                setUserPhotoUrls(photoUrls);
            } catch (error) {
                console.error('Error loading users:', error);
                Alert.alert('Error', 'Failed to load users');
            } finally {
                setIsLoadingUsers(false);
            }
        };

        loadUsers();
    }, [userId]);

    const toggleUserSelection = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            Alert.alert('Error', 'Please enter a group name');
            return;
        }

        if (!userId) {
            Alert.alert('Error', 'User not authenticated');
            return;
        }

        setIsLoading(true);
        try {
            // Include current user in the group along with selected users
            const allMembers = [userId, ...selectedUsers];

            const group = await createGroup(
                groupName.trim(),
                userId,
                allMembers,
                isPrivate,
                groupDescription.trim() || undefined
            );

            if (group) {
                Alert.alert('Success', 'Group created successfully!', [
                    {
                        text: 'OK',
                        onPress: () => router.replace(`/(root)/Group/${group.$id}`)
                    }
                ]);
            } else {
                Alert.alert('Error', 'Failed to create group. Please try again.');
            }
        } catch (error) {
            console.error('Error creating group:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to create group. Please try again.';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="flex-1">
                {/* Header */}
                <View className="flex-row items-center justify-between py-4 px-4 bg-black">
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text className="text-lg text-white">Cancel</Text>
                    </TouchableOpacity>
                    <Text className="text-xl font-rubik-semibold text-white">Create Group</Text>
                    <TouchableOpacity
                        onPress={handleCreateGroup}
                        disabled={isLoading || !groupName.trim()}
                    >
                        <Text
                            className="text-lg font-rubik-medium"
                            style={{
                                color: (isLoading || !groupName.trim()) ? '#666666' : '#ffffff'
                            }}
                        >
                            {isLoading ? 'Creating...' : 'Create'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {isLoadingUsers ? (
                    <View className="flex-1 justify-center items-center">
                        <Text style={{ color: colors.textSecondary }}>Loading users...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={allUsers}
                        keyExtractor={(item) => item.$id}
                        contentContainerStyle={{ padding: 16 }}
                        ListHeaderComponent={
                            <View>
                                {/* Group Name Input */}
                                <View className="pb-6">
                                    <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>
                                        Group Name
                                    </Text>
                                    <TextInput
                                        value={groupName}
                                        onChangeText={setGroupName}
                                        placeholder="Enter group name..."
                                        placeholderTextColor={colors.textSecondary}
                                        className="p-4 rounded-lg border font-rubik"
                                        style={{
                                            backgroundColor: colors.background,
                                            borderColor: colors.border,
                                            color: colors.text
                                        }}
                                        maxLength={50}
                                    />
                                </View>

                                {/* Group Description Input */}
                                <View className="pb-6">
                                    <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>
                                        Description (Optional)
                                    </Text>
                                    <TextInput
                                        value={groupDescription}
                                        onChangeText={setGroupDescription}
                                        placeholder="Enter group description..."
                                        placeholderTextColor={colors.textSecondary}
                                        className="p-4 rounded-lg border font-rubik"
                                        style={{
                                            backgroundColor: colors.background,
                                            borderColor: colors.border,
                                            color: colors.text
                                        }}
                                        maxLength={200}
                                        multiline
                                        numberOfLines={3}
                                    />
                                </View>

                                {/* Privacy Setting */}
                                <View className="pb-6">
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-1">
                                            <Text className="text-lg font-rubik-semibold" style={{ color: colors.text }}>
                                                Private Group
                                            </Text>
                                            <Text className="text-sm font-rubik mt-1" style={{ color: colors.textSecondary }}>
                                                {isPrivate
                                                    ? 'Only invited members can join this group'
                                                    : 'Anyone can discover and join this group'
                                                }
                                            </Text>
                                        </View>
                                        <Switch
                                            value={isPrivate}
                                            onValueChange={setIsPrivate}
                                            trackColor={{ false: colors.border, true: colors.primary }}
                                            thumbColor={isPrivate ? colors.background : colors.textSecondary}
                                        />
                                    </View>
                                </View>

                                {/* Members Selection Header */}
                                <View className="pb-3">
                                    <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>
                                        {isPrivate ? 'Invite Members' : 'Add Initial Members'} ({selectedUsers.length} selected)
                                    </Text>
                                    {!isPrivate && (
                                        <Text className="text-sm font-rubik mb-3" style={{ color: colors.textSecondary }}>
                                            For public groups, you can add initial members and others can join later
                                        </Text>
                                    )}
                                </View>
                            </View>
                        }
                        renderItem={({ item }) => {
                            const isSelected = selectedUsers.includes(item.$id);
                            return (
                                <TouchableOpacity
                                    onPress={() => toggleUserSelection(item.$id)}
                                    className="flex-row items-center py-3 px-2"
                                >
                                    <UserAvatar
                                        photoUrl={userPhotoUrls[item.$id]}
                                        firstName={item.firstName}
                                        lastName={item.lastName}
                                        size={48}
                                    />
                                    <View className="flex-1 ml-3">
                                        <Text className="font-rubik-medium" style={{ color: colors.text }}>
                                            {userDisplayUtils.getFullName(item)}
                                        </Text>
                                    </View>
                                    <View
                                        className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? 'bg-blue-500' : ''
                                            }`}
                                        style={{
                                            borderColor: isSelected ? '#3b82f6' : colors.border
                                        }}
                                    >
                                        {isSelected && (
                                            <Text className="text-white text-xs font-bold">✓</Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <View className="py-8 items-center">
                                <Text style={{ color: colors.textSecondary }}>No other users found</Text>
                            </View>
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default CreateGroup;
