import { getUserFriends } from '@/lib/api/friendship';
import {
    addUserToGroup,
    approveJoinRequest,
    deleteGroup,
    getGroupJoinRequests,
    rejectJoinRequest,
    updateGroupDescription
} from '@/lib/api/group';
import {
    banGroupMember,
    checkGroupPermission,
    getGroupMemberRole,
    getGroupMembers,
    updateGroupMemberRole
} from '@/lib/api/groupMembership';
import { getUsersByIds, getUsersByName } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { Group } from '@/lib/types/Groups';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
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
    currentUserId: string;
    onUpdateGroup: () => void;
}

const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
    visible,
    onClose,
    group,
    currentUserId,
    onUpdateGroup
}) => {
    const { colors } = useTheme();
    const [addMemberName, setAddMemberName] = useState('');
    const [friends, setFriends] = useState<any[]>([]);
    const [filteredFriends, setFilteredFriends] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [members, setMembers] = useState<any[]>([]);
    const [joinRequests, setJoinRequests] = useState<any[]>([]);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [canManageMembers, setCanManageMembers] = useState(false);
    const [canManageGroup, setCanManageGroup] = useState(false);
    const [canDeleteGroup, setCanDeleteGroup] = useState(false);
    const [activeTab, setActiveTab] = useState<'members' | 'requests' | 'settings'>('members');
    const [newDescription, setNewDescription] = useState(group.description || '');
    const [updatingDescription, setUpdatingDescription] = useState(false);

    const isOwner = group.creatorId === currentUserId;

    useEffect(() => {
        if (visible) {
            loadUserPermissions();
            loadMembers();
            loadFriends();
            if (group.isPrivate) {
                loadJoinRequests();
            }
        }
    }, [visible, currentUserId, group.$id]);

    const loadUserPermissions = async () => {
        try {
            const role = await getGroupMemberRole(group.$id, currentUserId);
            setUserRole(role);

            const [canManage, canManageGrp, canDelete] = await Promise.all([
                checkGroupPermission(group.$id, currentUserId, 'manage_members'),
                checkGroupPermission(group.$id, currentUserId, 'manage_group'),
                checkGroupPermission(group.$id, currentUserId, 'delete_group')
            ]);

            setCanManageMembers(canManage);
            setCanManageGroup(canManageGrp);
            setCanDeleteGroup(canDelete);
        } catch (error) {
            console.error('Error loading user permissions:', error);
        }
    };

    const loadMembers = async () => {
        try {
            const groupMembers = await getGroupMembers(group.$id);
            setMembers(groupMembers);
        } catch (error) {
            console.error('Error loading members:', error);
        }
    };

    const loadFriends = async () => {
        try {
            const friendIds = await getUserFriends(currentUserId);
            if (friendIds.length > 0) {
                const friendProfiles = await getUsersByIds(friendIds);
                setFriends(friendProfiles);
            }
        } catch (error) {
            console.error('Error loading friends:', error);
        }
    };

    const loadJoinRequests = async () => {
        if (!canManageMembers) return;

        try {
            const requests = await getGroupJoinRequests(group.$id, currentUserId);
            setJoinRequests(requests);
        } catch (error) {
            console.error('Error loading join requests:', error);
        }
    };

    const handleMemberNameChange = (text: string) => {
        setAddMemberName(text);

        if (text.trim().length > 0) {
            // Filter friends that are not already members and match the search
            const availableFriends = friends.filter(friend =>
                !members.some(member => member.$id === friend.$id) &&
                (`${friend.firstName} ${friend.lastName}`.toLowerCase().includes(text.toLowerCase()) ||
                    friend.firstName.toLowerCase().includes(text.toLowerCase()) ||
                    friend.lastName.toLowerCase().includes(text.toLowerCase()))
            );
            setFilteredFriends(availableFriends.slice(0, 5)); // Show max 5 suggestions
            setShowSuggestions(availableFriends.length > 0);
        } else {
            setFilteredFriends([]);
            setShowSuggestions(false);
        }
    };

    const selectFriendSuggestion = (friend: any) => {
        setAddMemberName(`${friend.firstName} ${friend.lastName}`);
        setShowSuggestions(false);
        setFilteredFriends([]);
        // Automatically add the friend
        addSelectedUser(friend);
    };

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
            const isAlreadyMember = members.some(member => member.$id === userToAdd.$id);

            if (isAlreadyMember) {
                Alert.alert('Already Member', 'This user is already a member of the group');
                return;
            }

            // Add user to group
            await addUserToGroup(group.$id, userToAdd.$id);

            Alert.alert('Success', `${userToAdd.firstName} ${userToAdd.lastName} has been added to the group`);
            setAddMemberName('');
            setShowSuggestions(false);
            setFilteredFriends([]);
            loadMembers();
            onUpdateGroup();

        } catch (error) {
            console.error('Add member error:', error);
            Alert.alert('Error', 'Failed to add member to group');
        }
    };

    const handlePromoteToAdmin = async (memberId: string, memberName: string) => {
        if (!isOwner) return;

        Alert.alert(
            'Promote to Admin',
            `Promote ${memberName} to admin? They will be able to manage members and post events.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Promote',
                    onPress: async () => {
                        try {
                            const success = await updateGroupMemberRole(group.$id, memberId, 'admin', currentUserId);
                            if (success) {
                                Alert.alert('Success', `${memberName} has been promoted to admin`);
                                loadMembers();
                            } else {
                                Alert.alert('Error', 'Failed to promote member');
                            }
                        } catch (error) {
                            console.error('Error promoting member:', error);
                            Alert.alert('Error', 'Failed to promote member');
                        }
                    }
                }
            ]
        );
    };

    const handleDemoteToMember = async (memberId: string, memberName: string) => {
        if (!isOwner) return;

        Alert.alert(
            'Demote to Member',
            `Demote ${memberName} to regular member?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Demote',
                    onPress: async () => {
                        try {
                            const success = await updateGroupMemberRole(group.$id, memberId, 'member', currentUserId);
                            if (success) {
                                Alert.alert('Success', `${memberName} has been demoted to member`);
                                loadMembers();
                            } else {
                                Alert.alert('Error', 'Failed to demote member');
                            }
                        } catch (error) {
                            console.error('Error demoting member:', error);
                            Alert.alert('Error', 'Failed to demote member');
                        }
                    }
                }
            ]
        );
    };

    const handleBanMember = async (memberId: string, memberName: string) => {
        if (!canManageMembers) return;

        Alert.alert(
            'Ban Member',
            `Ban ${memberName} from the group? They will not be able to rejoin.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Ban',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await banGroupMember(group.$id, memberId, currentUserId);
                            if (success) {
                                Alert.alert('Success', `${memberName} has been banned from the group`);
                                loadMembers();
                            } else {
                                Alert.alert('Error', 'Failed to ban member');
                            }
                        } catch (error) {
                            console.error('Error banning member:', error);
                            Alert.alert('Error', 'Failed to ban member');
                        }
                    }
                }
            ]
        );
    };

    const handleApproveRequest = async (requestId: string, userName: string) => {
        try {
            const success = await approveJoinRequest(requestId, currentUserId);
            if (success) {
                Alert.alert('Success', `${userName} has been added to the group`);
                loadJoinRequests();
                loadMembers();
                onUpdateGroup();
            } else {
                Alert.alert('Error', 'Failed to approve request');
            }
        } catch (error) {
            console.error('Error approving request:', error);
            Alert.alert('Error', 'Failed to approve request');
        }
    };

    const handleRejectRequest = async (requestId: string, userName: string) => {
        Alert.alert(
            'Reject Request',
            `Reject ${userName}'s request to join?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await rejectJoinRequest(requestId, currentUserId);
                            if (success) {
                                Alert.alert('Success', `Request from ${userName} has been rejected`);
                                loadJoinRequests();
                            } else {
                                Alert.alert('Error', 'Failed to reject request');
                            }
                        } catch (error) {
                            console.error('Error rejecting request:', error);
                            Alert.alert('Error', 'Failed to reject request');
                        }
                    }
                }
            ]
        );
    };

    const handleUpdateDescription = async () => {
        if (!canManageGroup) return;

        try {
            setUpdatingDescription(true);
            const success = await updateGroupDescription(group.$id, newDescription, currentUserId);
            if (success) {
                Alert.alert('Success', 'Group description updated');
                onUpdateGroup();
            } else {
                Alert.alert('Error', 'Failed to update description');
            }
        } catch (error) {
            console.error('Error updating description:', error);
            Alert.alert('Error', 'Failed to update description');
        } finally {
            setUpdatingDescription(false);
        }
    };

    const handleDeleteGroup = () => {
        if (!canDeleteGroup) return;

        Alert.alert(
            'Delete Group',
            `Are you sure you want to delete "${group.title}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await deleteGroup(group.$id, currentUserId);
                            if (success) {
                                Alert.alert('Success', 'Group has been deleted', [
                                    { text: 'OK', onPress: onClose }
                                ]);
                            } else {
                                Alert.alert('Error', 'Failed to delete group');
                            }
                        } catch (error) {
                            console.error('Error deleting group:', error);
                            Alert.alert('Error', 'Failed to delete group');
                        }
                    }
                }
            ]
        );
    };

    const renderMemberItem = ({ item: member }: { item: any }) => {
        const memberName = `${member.firstName} ${member.lastName}`;
        const isCurrentUser = member.$id === currentUserId;
        const isMemberOwner = member.$id === group.creatorId;

        return (
            <View className="flex-row items-center justify-between p-3 border-b" style={{ borderBottomColor: colors.border }}>
                <View className="flex-1">
                    <Text className="font-rubik-medium" style={{ color: colors.text }}>
                        {memberName} {isCurrentUser && '(You)'}
                    </Text>
                    <Text className="font-rubik text-sm" style={{ color: colors.textSecondary }}>
                        {member.role === 'owner' || isMemberOwner ? 'Owner' :
                            member.role === 'admin' ? 'Admin' : 'Member'}
                    </Text>
                </View>

                {canManageMembers && !isCurrentUser && !isMemberOwner && (
                    <View className="flex-row gap-2">
                        {isOwner && member.role !== 'admin' && (
                            <TouchableOpacity
                                onPress={() => handlePromoteToAdmin(member.$id, memberName)}
                                className="bg-blue-500 px-3 py-1 rounded"
                            >
                                <Text className="text-white font-rubik-medium text-sm">Promote</Text>
                            </TouchableOpacity>
                        )}

                        {isOwner && member.role === 'admin' && (
                            <TouchableOpacity
                                onPress={() => handleDemoteToMember(member.$id, memberName)}
                                className="bg-amber-500 px-3 py-1 rounded"
                            >
                                <Text className="text-white font-rubik-medium text-sm">Demote</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={() => handleBanMember(member.$id, memberName)}
                            className="bg-red-500 px-3 py-1 rounded"
                        >
                            <Text className="text-white font-rubik-medium text-sm">Ban</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    const renderJoinRequestItem = ({ item: request }: { item: any }) => {
        const userName = `${request.user.firstName} ${request.user.lastName}`;

        return (
            <View className="flex-row items-center justify-between p-3 border-b" style={{ borderBottomColor: colors.border }}>
                <View className="flex-1">
                    <Text className="font-rubik-medium" style={{ color: colors.text }}>
                        {userName}
                    </Text>
                    <Text className="font-rubik text-sm" style={{ color: colors.textSecondary }}>
                        Requested to join
                    </Text>
                </View>

                <View className="flex-row gap-2">
                    <TouchableOpacity
                        onPress={() => handleApproveRequest(request.$id, userName)}
                        className="bg-green-500 px-3 py-1 rounded"
                    >
                        <Text className="text-white font-rubik-medium text-sm">Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handleRejectRequest(request.$id, userName)}
                        className="bg-red-500 px-3 py-1 rounded"
                    >
                        <Text className="text-white font-rubik-medium text-sm">Reject</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const handleCloseModal = () => {
        setAddMemberName('');
        setShowSuggestions(false);
        setFilteredFriends([]);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleCloseModal}
        >
            <View className="flex-1" style={{ backgroundColor: colors.background }}>
                {/* Header */}
                <View className="px-4 py-4 border-b flex-row items-center justify-between"
                    style={{ borderBottomColor: colors.border }}>
                    <TouchableOpacity onPress={handleCloseModal}>
                        <Text className="text-lg font-rubik-medium" style={{ color: colors.primary }}>
                            Cancel
                        </Text>
                    </TouchableOpacity>
                    <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>
                        Group Settings
                    </Text>
                    <View style={{ width: 60 }} />
                </View>

                {/* Tab Navigation */}
                <View className="flex-row border-b" style={{ borderBottomColor: colors.border }}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('members')}
                        className={`flex-1 py-3 ${activeTab === 'members' ? 'border-b-2' : ''}`}
                        style={{ borderBottomColor: activeTab === 'members' ? colors.primary : 'transparent' }}
                    >
                        <Text className={`text-center font-rubik-medium ${activeTab === 'members' ? 'font-rubik-semibold' : ''}`}
                            style={{ color: activeTab === 'members' ? colors.primary : colors.text }}>
                            Members ({members.length})
                        </Text>
                    </TouchableOpacity>

                    {group.isPrivate && canManageMembers && (
                        <TouchableOpacity
                            onPress={() => setActiveTab('requests')}
                            className={`flex-1 py-3 ${activeTab === 'requests' ? 'border-b-2' : ''}`}
                            style={{ borderBottomColor: activeTab === 'requests' ? colors.primary : 'transparent' }}
                        >
                            <Text className={`text-center font-rubik-medium ${activeTab === 'requests' ? 'font-rubik-semibold' : ''}`}
                                style={{ color: activeTab === 'requests' ? colors.primary : colors.text }}>
                                Requests ({joinRequests.length})
                            </Text>
                        </TouchableOpacity>
                    )}

                    {canManageGroup && (
                        <TouchableOpacity
                            onPress={() => setActiveTab('settings')}
                            className={`flex-1 py-3 ${activeTab === 'settings' ? 'border-b-2' : ''}`}
                            style={{ borderBottomColor: activeTab === 'settings' ? colors.primary : 'transparent' }}
                        >
                            <Text className={`text-center font-rubik-medium ${activeTab === 'settings' ? 'font-rubik-semibold' : ''}`}
                                style={{ color: activeTab === 'settings' ? colors.primary : colors.text }}>
                                Settings
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Tab Content */}
                <View className="flex-1">
                    {activeTab === 'members' && (
                        <View className="flex-1">
                            {/* Add Member Section */}
                            {canManageMembers && (
                                <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
                                    <View className="relative">
                                        <TextInput
                                            placeholder={friends.length > 0 ? "Enter name (friends will be suggested)" : "Enter user's name to add"}
                                            value={addMemberName}
                                            onChangeText={handleMemberNameChange}
                                            className="border rounded-lg px-4 py-3 mb-3 font-rubik"
                                            style={{
                                                borderColor: colors.border,
                                                backgroundColor: colors.card,
                                                color: colors.text
                                            }}
                                            placeholderTextColor={colors.textSecondary}
                                            autoCapitalize="words"
                                        />

                                        {/* Friend Suggestions Dropdown */}
                                        {showSuggestions && (
                                            <View
                                                className="absolute top-14 left-0 right-0 z-10 border rounded-lg shadow-md"
                                                style={{
                                                    backgroundColor: colors.card,
                                                    borderColor: colors.border,
                                                    maxHeight: 200
                                                }}
                                            >
                                                <ScrollView>
                                                    {filteredFriends.map((friend, index) => (
                                                        <TouchableOpacity
                                                            key={friend.$id}
                                                            onPress={() => selectFriendSuggestion(friend)}
                                                            className="p-3 border-b"
                                                            style={{
                                                                borderBottomColor: colors.border,
                                                                borderBottomWidth: index === filteredFriends.length - 1 ? 0 : 1
                                                            }}
                                                        >
                                                            <Text
                                                                className="font-rubik"
                                                                style={{ color: colors.text }}
                                                            >
                                                                {friend.firstName} {friend.lastName}
                                                            </Text>
                                                            <Text
                                                                className="font-rubik text-sm"
                                                                style={{ color: colors.textSecondary }}
                                                            >
                                                                {friend.email}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>
                                    <TouchableOpacity
                                        onPress={handleAddMember}
                                        disabled={loading}
                                        className="py-3 rounded-lg"
                                        style={{ backgroundColor: colors.primary }}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <Text className="text-center text-white font-rubik-medium">
                                                Add Member
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Members List */}
                            <FlatList
                                data={members}
                                keyExtractor={(item) => item.$id}
                                renderItem={renderMemberItem}
                                ListEmptyComponent={
                                    <View className="p-8 items-center">
                                        <Text className="font-rubik" style={{ color: colors.textSecondary }}>
                                            No members found
                                        </Text>
                                    </View>
                                }
                            />
                        </View>
                    )}

                    {activeTab === 'requests' && group.isPrivate && canManageMembers && (
                        <FlatList
                            data={joinRequests}
                            keyExtractor={(item) => item.$id}
                            renderItem={renderJoinRequestItem}
                            ListEmptyComponent={
                                <View className="p-8 items-center">
                                    <Text className="font-rubik" style={{ color: colors.textSecondary }}>
                                        No pending requests
                                    </Text>
                                </View>
                            }
                        />
                    )}

                    {activeTab === 'settings' && canManageGroup && (
                        <ScrollView className="flex-1 p-4">
                            {/* Group Info */}
                            <View className="mb-6">
                                <Text className="text-lg font-rubik-semibold mb-2" style={{ color: colors.text }}>
                                    {group.title}
                                </Text>
                                <Text className="font-rubik text-sm mb-4" style={{ color: colors.textSecondary }}>
                                    {members.length} members • {group.isPrivate ? 'Private' : 'Public'} group
                                </Text>

                                {/* Description Editor */}
                                <Text className="font-rubik-medium mb-2" style={{ color: colors.text }}>
                                    Description
                                </Text>
                                <TextInput
                                    value={newDescription}
                                    onChangeText={setNewDescription}
                                    placeholder="Enter group description"
                                    multiline
                                    numberOfLines={3}
                                    className="border rounded-lg px-4 py-3 mb-3 font-rubik"
                                    style={{
                                        borderColor: colors.border,
                                        backgroundColor: colors.card,
                                        color: colors.text,
                                        textAlignVertical: 'top'
                                    }}
                                    placeholderTextColor={colors.textSecondary}
                                />

                                {newDescription !== group.description && (
                                    <TouchableOpacity
                                        onPress={handleUpdateDescription}
                                        disabled={updatingDescription}
                                        className="py-3 rounded-lg mb-6"
                                        style={{ backgroundColor: colors.primary }}
                                    >
                                        {updatingDescription ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <Text className="text-center text-white font-rubik-medium">
                                                Update Description
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Danger Zone */}
                            {canDeleteGroup && (
                                <View className="border-t pt-6" style={{ borderTopColor: colors.border }}>
                                    <Text className="text-lg font-rubik-semibold mb-4" style={{ color: colors.text }}>
                                        Danger Zone
                                    </Text>

                                    <TouchableOpacity
                                        onPress={handleDeleteGroup}
                                        className="py-3 px-4 rounded-lg border"
                                        style={{ backgroundColor: '#ef4444', borderColor: '#dc2626' }}
                                    >
                                        <Text className="text-center text-white font-rubik-medium">
                                            Delete Group
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default GroupSettingsModal;
