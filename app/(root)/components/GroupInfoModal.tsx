import { addUserToGroup, leaveGroup } from '@/lib/api/group';
import { getUsersByName } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { Group } from '@/lib/types/Groups';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface GroupInfoModalProps {
    visible: boolean;
    onClose: () => void;
    group: Group;
    onUpdateGroup: () => void;
}

const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
    visible,
    onClose,
    group,
    onUpdateGroup
}) => {
    const { colors } = useTheme();
    const { user } = useGlobalContext();
    const router = useRouter();
    const [inviteName, setInviteName] = useState('');
    const [loading, setLoading] = useState(false);

    const isCreator = group.creatorId === user?.$id;

    const handleInviteFriend = async () => {
        if (!inviteName.trim()) {
            Alert.alert('Error', 'Please enter a name to search');
            return;
        }

        try {
            setLoading(true);

            // Find users by name
            const users = await getUsersByName(inviteName.trim());
            if (users.length === 0) {
                Alert.alert('User Not Found', 'No users found with this name');
                return;
            }

            // If multiple users found, show selection
            if (users.length > 1) {
                Alert.alert(
                    'Multiple Users Found',
                    'Multiple users found with this name. Please be more specific.',
                    [{ text: 'OK' }]
                );
                return;
            }

            const userToAdd = users[0];

            // Check if user is already in the group
            if (group.users?.includes(userToAdd.$id)) {
                Alert.alert('Info', 'This user is already a member of the group');
                return;
            }

            // Add user to group
            const success = await addUserToGroup(group.$id, userToAdd.$id);
            if (success) {
                Alert.alert('Success', `${userToAdd.firstName} ${userToAdd.lastName} has been invited to the group!`);
                setInviteName('');
                onUpdateGroup();
            } else {
                Alert.alert('Error', 'Failed to invite user to group');
            }
        } catch (error) {
            console.error('Invite friend error:', error);
            Alert.alert('Error', 'Failed to invite user to group');
        } finally {
            setLoading(false);
        }
    };

    const handleLeaveGroup = async () => {
        if (!user?.$id) return;

        // Don't allow creator to leave their own group
        if (isCreator) {
            Alert.alert('Cannot Leave', 'As the group creator, you cannot leave the group. You can delete the group from Settings instead.');
            return;
        }

        Alert.alert(
            'Leave Group',
            `Are you sure you want to leave "${group.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await leaveGroup(group.$id, user.$id);
                            if (success) {
                                Alert.alert('Success', 'You have left the group.', [
                                    { 
                                        text: 'OK', 
                                        onPress: () => {
                                            onClose();
                                            router.back();
                                        }
                                    }
                                ]);
                            } else {
                                Alert.alert('Error', 'Failed to leave the group.');
                            }
                        } catch (error) {
                            console.error('Leave group error:', error);
                            Alert.alert('Error', 'Failed to leave the group.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
        >
            <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
                {/* Header */}
                <View className="px-4 py-4 border-b flex-row items-center justify-between" style={{ borderBottomColor: colors.border }}>
                    <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>
                        Group Info
                    </Text>
                    <TouchableOpacity onPress={onClose}>
                        <Text className="text-blue-500 font-rubik-medium">Done</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView className="flex-1 px-4 py-6">
                    {/* Group Details */}
                    <View className="mb-6">
                        <Text className="text-2xl font-rubik-bold mb-2" style={{ color: colors.text }}>
                            {group.title}
                        </Text>
                        
                        <Text className="text-sm font-rubik mb-4" style={{ color: colors.textSecondary }}>
                            {group.users?.length || 0} members
                        </Text>

                        {group.description && (
                            <View className="mb-4">
                                <Text className="text-lg font-rubik-semibold mb-2" style={{ color: colors.text }}>
                                    Description
                                </Text>
                                <Text className="font-rubik leading-6" style={{ color: colors.textSecondary }}>
                                    {group.description}
                                </Text>
                            </View>
                        )}

                        <View className="mb-4">
                            <Text className="text-lg font-rubik-semibold mb-2" style={{ color: colors.text }}>
                                Created
                            </Text>
                            <Text className="font-rubik" style={{ color: colors.textSecondary }}>
                                {group.$createdAt ? new Date(group.$createdAt).toLocaleDateString() : 'Unknown'}
                            </Text>
                        </View>
                    </View>

                    {/* Invite Friends Section */}
                    <View className="mb-6 p-4 rounded-lg" style={{ backgroundColor: colors.card }}>
                        <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>
                            Invite Friends
                        </Text>
                        <Text className="font-rubik mb-3" style={{ color: colors.textSecondary }}>
                            Search for friends by name to invite them to this group
                        </Text>
                        
                        <View className="flex-row space-x-2">
                            <TextInput
                                className="flex-1 p-3 rounded-lg border"
                                style={{ 
                                    backgroundColor: colors.background,
                                    borderColor: colors.border,
                                    color: colors.text
                                }}
                                placeholder="Enter friend's name"
                                placeholderTextColor={colors.textSecondary}
                                value={inviteName}
                                onChangeText={setInviteName}
                                editable={!loading}
                            />
                            <TouchableOpacity
                                onPress={handleInviteFriend}
                                disabled={loading || !inviteName.trim()}
                                className={`px-4 py-3 rounded-lg ${loading || !inviteName.trim() ? 'bg-gray-300' : 'bg-blue-500'}`}
                            >
                                <Text className="text-white font-rubik-medium">
                                    {loading ? 'Inviting...' : 'Invite'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View className="space-y-3">
                        {!isCreator && (
                            <TouchableOpacity
                                onPress={handleLeaveGroup}
                                className="bg-red-500 py-3 rounded-lg"
                            >
                                <Text className="text-white font-rubik-medium text-center">
                                    Leave Group
                                </Text>
                            </TouchableOpacity>
                        )}

                        {isCreator && (
                            <TouchableOpacity
                                onPress={() => {
                                    onClose();
                                    // You can add navigation to full group settings here if needed
                                }}
                                className="py-3 rounded-lg border"
                                style={{ borderColor: colors.border }}
                            >
                                <Text className="font-rubik-medium text-center" style={{ color: colors.text }}>
                                    Group Settings
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
};

export default GroupInfoModal;
