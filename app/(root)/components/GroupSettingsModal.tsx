import { addUserToGroup } from '@/lib/api/group';
import { getUsersByName } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { Group } from '@/lib/types/Groups';
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

interface GroupSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    group: Group;
    isCreator: boolean;
    onUpdateGroup: () => void;
}

const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
    visible,
    onClose,
    group,
    isCreator,
    onUpdateGroup
}) => {
    const { colors } = useTheme();
    const [addMemberName, setAddMemberName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAddMember = async () => {
        if (!addMemberName.trim()) {
            Alert.alert('Error', 'Please enter a name to search');
            return;
        }

        try {
            setLoading(true);

            // Find users by name
            const users = await getUsersByName(addMemberName.trim());
            if (users.length === 0) {
                Alert.alert('User Not Found', 'No users found with this name');
                return;
            }

            // If multiple users found, show selection dialog
            if (users.length > 1) {
                const userOptions = users.map(user => ({
                    text: `${user.firstName} ${user.lastName} (${user.email})`,
                    onPress: () => addSelectedUser(user)
                }));

                Alert.alert(
                    'Multiple Users Found',
                    'Please select a user:',
                    [
                        ...userOptions,
                        { text: 'Cancel', style: 'cancel' }
                    ]
                );
                return;
            }

            // Single user found, add them directly
            await addSelectedUser(users[0]);

        } catch (error) {
            console.error('Add member error:', error);
            Alert.alert('Error', 'Failed to search for users');
        } finally {
            setLoading(false);
        }
    };

    const addSelectedUser = async (userToAdd: any) => {
        try {
            // Check if user is already a member
            if (group.users?.includes(userToAdd.$id)) {
                Alert.alert('Already Member', 'This user is already a member of the group');
                return;
            }

            // Add user to group
            await addUserToGroup(group.$id, userToAdd.$id);

            Alert.alert('Success', `${userToAdd.firstName} ${userToAdd.lastName} has been added to the group`);
            setAddMemberName('');
            onUpdateGroup();

        } catch (error) {
            console.error('Add member error:', error);
            Alert.alert('Error', 'Failed to add member to group');
        }
    };

    const handleDeleteGroup = () => {
        Alert.alert(
            'Delete Group',
            `Are you sure you want to delete "${group.title}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        // TODO: Implement delete group functionality
                        Alert.alert('Coming Soon', 'Group deletion will be implemented soon');
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
            onRequestClose={onClose}
        >
            <View className="flex-1" style={{ backgroundColor: colors.background }}>
                {/* Header */}
                <View className="px-4 py-4 border-b flex-row items-center justify-between"
                    style={{ borderBottomColor: colors.border }}>
                    <TouchableOpacity onPress={onClose}>
                        <Text className="text-lg font-rubik-medium" style={{ color: colors.primary }}>
                            Cancel
                        </Text>
                    </TouchableOpacity>
                    <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>
                        Group Settings
                    </Text>
                    <View style={{ width: 60 }} />
                </View>

                <ScrollView className="flex-1 px-4 py-6">
                    {/* Group Info */}
                    <View className="mb-6">
                        <Text className="text-lg font-rubik-semibold mb-2" style={{ color: colors.text }}>
                            {group.title}
                        </Text>
                        <Text className="font-rubik" style={{ color: colors.textSecondary }}>
                            {group.description || 'No description'}
                        </Text>
                        <Text className="font-rubik text-sm mt-2" style={{ color: colors.textSecondary }}>
                            {group.users?.length || 0} members
                        </Text>
                    </View>

                    {/* Add Member Section (Creator Only) */}
                    {isCreator && (
                        <View className="mb-6">
                            <Text className="text-lg font-rubik-semibold mb-4" style={{ color: colors.text }}>
                                Add Member
                            </Text>
                            <TextInput
                                placeholder="Enter user's name"
                                value={addMemberName}
                                onChangeText={setAddMemberName}
                                className="border rounded-lg px-4 py-3 mb-3 font-rubik"
                                style={{
                                    borderColor: colors.border,
                                    backgroundColor: colors.card,
                                    color: colors.text
                                }}
                                placeholderTextColor={colors.textSecondary}
                                autoCapitalize="words"
                            />
                            <TouchableOpacity
                                onPress={handleAddMember}
                                disabled={loading}
                                className="py-3 rounded-lg"
                                style={{ backgroundColor: colors.primary }}
                            >
                                <Text className="text-center text-white font-rubik-medium">
                                    {loading ? 'Adding...' : 'Add Member'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Group Management (Creator Only) */}
                    {isCreator && (
                        <View className="mb-6">
                            <Text className="text-lg font-rubik-semibold mb-4" style={{ color: colors.text }}>
                                Group Management
                            </Text>

                            <TouchableOpacity
                                onPress={() => Alert.alert('Coming Soon', 'Edit group details will be implemented soon')}
                                className="py-3 px-4 rounded-lg mb-3 border"
                                style={{
                                    borderColor: colors.border,
                                    backgroundColor: colors.card
                                }}
                            >
                                <Text className="font-rubik-medium" style={{ color: colors.text }}>
                                    Edit Group Details
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => Alert.alert('Coming Soon', 'Member management will be implemented soon')}
                                className="py-3 px-4 rounded-lg mb-3 border"
                                style={{
                                    borderColor: colors.border,
                                    backgroundColor: colors.card
                                }}
                            >
                                <Text className="font-rubik-medium" style={{ color: colors.text }}>
                                    Manage Members
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleDeleteGroup}
                                className="py-3 px-4 rounded-lg"
                                style={{ backgroundColor: '#ef4444' }}
                            >
                                <Text className="text-center text-white font-rubik-medium">
                                    Delete Group
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
};

export default GroupSettingsModal;
