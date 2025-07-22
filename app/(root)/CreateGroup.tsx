import { createGroup } from '@/lib/api/group';
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
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserAvatar from './components/UserAvatar';

const CreateGroup = () => {
    const router = useRouter();
    const { user } = useGlobalContext();
    const { colors } = useTheme();
    const userId = user?.$id;

    const [groupName, setGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);

    useEffect(() => {
        const loadUsers = async () => {
            try {
                const users = await getAllUsers();
                // Filter out current user
                const otherUsers = users.filter(u => u.$id !== userId);
                setAllUsers(otherUsers);
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

            const group = await createGroup(groupName.trim(), userId, allMembers);

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
            <ScrollView className="flex-1 px-4">
                {/* Header */}
                <View className="flex-row items-center justify-between py-4 border-b" style={{ borderBottomColor: colors.border }}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text className="text-lg" style={{ color: colors.primary }}>Cancel</Text>
                    </TouchableOpacity>
                    <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>Create Group</Text>
                    <TouchableOpacity
                        onPress={handleCreateGroup}
                        disabled={isLoading || !groupName.trim()}
                    >
                        <Text
                            className="text-lg font-rubik-medium"
                            style={{
                                color: (isLoading || !groupName.trim()) ? colors.textSecondary : colors.primary
                            }}
                        >
                            {isLoading ? 'Creating...' : 'Create'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Group Name Input */}
                <View className="py-6">
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

                {/* Members Selection */}
                <View className="flex-1">
                    <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>
                        Invite Members ({selectedUsers.length} selected)
                    </Text>

                    {isLoadingUsers ? (
                        <View className="py-8 items-center">
                            <Text style={{ color: colors.textSecondary }}>Loading users...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={allUsers}
                            keyExtractor={(item) => item.$id}
                            renderItem={({ item }) => {
                                const isSelected = selectedUsers.includes(item.$id);
                                return (
                                    <TouchableOpacity
                                        onPress={() => toggleUserSelection(item.$id)}
                                        className="flex-row items-center py-3 px-2"
                                    >
                                        <UserAvatar
                                            photoUrl={item.photoId ? `photo-${item.photoId}` : null}
                                            firstName={item.firstName}
                                            lastName={item.lastName}
                                            size={48}
                                        />
                                        <View className="flex-1 ml-3">
                                            <Text className="font-rubik-medium" style={{ color: colors.text }}>
                                                {userDisplayUtils.getFullName(item)}
                                            </Text>
                                            <Text className="text-sm" style={{ color: colors.textSecondary }}>
                                                {item.email}
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
            </ScrollView>
        </SafeAreaView>
    );
};

export default CreateGroup;
