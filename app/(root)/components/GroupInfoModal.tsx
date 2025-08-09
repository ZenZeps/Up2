import { leaveGroup, sendGroupInvite } from '@/lib/api/group';
import { getUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { Group } from '@/lib/types/Groups';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
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

        if (!user?.$id) {
            Alert.alert('Error', 'User not authenticated');
            return;
        }

        try {
            setLoading(true);

            // Get current user's profile to access their friends list
            const currentUserProfile = await getUserProfile(user.$id);
            if (!currentUserProfile || !currentUserProfile.friends || currentUserProfile.friends.length === 0) {
                Alert.alert('No Friends', 'You need to add friends before inviting them to groups.');
                return;
            }

            // Search through the user's friends by name
            const friendsProfiles = await Promise.all(
                currentUserProfile.friends.map(friendId => getUserProfile(friendId))
            );

            const matchingFriends = friendsProfiles.filter(friendProfile => {
                if (!friendProfile) return false;
                const fullName = `${friendProfile.firstName || ''} ${friendProfile.lastName || ''}`.toLowerCase();
                const searchTerm = inviteName.toLowerCase().trim();
                return fullName.includes(searchTerm);
            });

            if (matchingFriends.length === 0) {
                Alert.alert('Friend Not Found', 'No friends found with this name. Make sure they are in your friends list.');
                return;
            }

            // If multiple friends found, show selection
            if (matchingFriends.length > 1) {
                Alert.alert(
                    'Multiple Friends Found',
                    'Multiple friends found with this name. Please be more specific.',
                    [{ text: 'OK' }]
                );
                return;
            }

            const friendToInvite = matchingFriends[0];

            // Ensure we have a valid friend profile
            if (!friendToInvite) {
                Alert.alert('Error', 'Unable to get friend profile information');
                return;
            }

            // Check if friend is already in the group
            if (group.users?.includes(friendToInvite.$id)) {
                Alert.alert('Info', 'This friend is already a member of the group');
                return;
            }

            // Send group invite instead of directly adding
            const success = await sendGroupInvite(group.$id, user.$id, friendToInvite.$id);
            if (success) {
                Alert.alert('Success', `Group invite sent to ${friendToInvite.firstName} ${friendToInvite.lastName}!`);
                setInviteName('');
            } else {
                Alert.alert('Error', 'Failed to send group invite. They may already have a pending invite.');
            }
        } catch (error) {
            console.error('Invite friend error:', error);
            Alert.alert('Error', 'Failed to send group invite');
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
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Black Header with stylish design */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <View style={styles.headerLeft}>
                            <View style={styles.groupIconContainer}>
                                <MaterialIcons name="group" size={24} color="white" />
                            </View>
                            <Text style={styles.headerTitle}>Group Info</Text>
                        </View>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <MaterialIcons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                    {/* Group Hero Section */}
                    <View style={[styles.heroSection, { backgroundColor: colors.card }]}>
                        <View style={styles.groupAvatarContainer}>
                            <View style={[styles.groupAvatar, { backgroundColor: colors.primary }]}>
                                <Text style={styles.groupAvatarText}>
                                    {group.title.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        </View>

                        <Text style={[styles.groupTitle, { color: colors.text }]}>
                            {group.title}
                        </Text>

                        <View style={styles.membersBadge}>
                            <MaterialIcons name="people" size={16} color={colors.primary} />
                            <Text style={[styles.membersCount, { color: colors.primary }]}>
                                {group.users?.length || 0} members
                            </Text>
                        </View>
                    </View>

                    {/* Group Description Card */}
                    {group.description && (
                        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.cardHeader}>
                                <MaterialIcons name="description" size={20} color={colors.primary} />
                                <Text style={[styles.cardTitle, { color: colors.text }]}>
                                    About
                                </Text>
                            </View>
                            <Text style={[styles.description, { color: colors.textSecondary }]}>
                                {group.description}
                            </Text>
                        </View>
                    )}

                    {/* Group Details Card */}
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.cardHeader}>
                            <MaterialIcons name="info" size={20} color={colors.primary} />
                            <Text style={[styles.cardTitle, { color: colors.text }]}>
                                Details
                            </Text>
                        </View>

                        <View style={styles.detailRow}>
                            <MaterialIcons name="event" size={18} color={colors.textSecondary} />
                            <View style={styles.detailContent}>
                                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Created</Text>
                                <Text style={[styles.detailValue, { color: colors.text }]}>
                                    {group.$createdAt ? new Date(group.$createdAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    }) : 'Unknown'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.detailRow}>
                            <MaterialIcons name={group.isPrivate ? "lock" : "public"} size={18} color={colors.textSecondary} />
                            <View style={styles.detailContent}>
                                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Privacy</Text>
                                <Text style={[styles.detailValue, { color: colors.text }]}>
                                    {group.isPrivate ? 'Private Group' : 'Public Group'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Invite Friends Card */}
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.cardHeader}>
                            <MaterialIcons name="person-add" size={20} color={colors.primary} />
                            <Text style={[styles.cardTitle, { color: colors.text }]}>
                                Invite Friends
                            </Text>
                        </View>

                        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                            Search for friends by name to invite them to this group
                        </Text>

                        <View style={styles.inviteContainer}>
                            <View style={[styles.inviteInputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <MaterialIcons name="search" size={20} color={colors.textSecondary} />
                                <TextInput
                                    style={[styles.inviteInput, { color: colors.text }]}
                                    placeholder="Enter friend's name"
                                    placeholderTextColor={colors.textSecondary}
                                    value={inviteName}
                                    onChangeText={setInviteName}
                                    editable={!loading}
                                />
                            </View>
                            <TouchableOpacity
                                onPress={handleInviteFriend}
                                disabled={loading || !inviteName.trim()}
                                style={[
                                    styles.inviteButton,
                                    { backgroundColor: loading || !inviteName.trim() ? colors.border : colors.primary }
                                ]}
                            >
                                <MaterialIcons
                                    name="send"
                                    size={18}
                                    color={loading || !inviteName.trim() ? colors.textSecondary : 'white'}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionsContainer}>
                        {!isCreator && (
                            <TouchableOpacity
                                onPress={handleLeaveGroup}
                                style={styles.leaveButton}
                            >
                                <MaterialIcons name="exit-to-app" size={20} color="white" />
                                <Text style={styles.leaveButtonText}>
                                    Leave Group
                                </Text>
                            </TouchableOpacity>
                        )}

                        {isCreator && (
                            <TouchableOpacity
                                onPress={() => {
                                    onClose();
                                    // Navigate to full group settings if needed
                                }}
                                style={[styles.settingsButton, { borderColor: colors.border }]}
                            >
                                <MaterialIcons name="settings" size={20} color={colors.text} />
                                <Text style={[styles.settingsButtonText, { color: colors.text }]}>
                                    Manage Group
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </Modal>
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
        justifyContent: 'space-between',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    groupIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: 'white',
    },
    closeButton: {
        padding: 4,
    },
    scrollContainer: {
        flex: 1,
    },
    heroSection: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 24,
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    groupAvatarContainer: {
        marginBottom: 16,
    },
    groupAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    groupAvatarText: {
        fontSize: 24,
        fontWeight: '700',
        color: 'white',
    },
    groupTitle: {
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    membersBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    membersCount: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
    },
    card: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 8,
    },
    cardSubtitle: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    detailContent: {
        flex: 1,
        marginLeft: 12,
    },
    detailLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '400',
    },
    inviteContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inviteInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginRight: 12,
    },
    inviteInput: {
        flex: 1,
        fontSize: 16,
        marginLeft: 8,
    },
    inviteButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionsContainer: {
        paddingHorizontal: 16,
        paddingVertical: 24,
        paddingBottom: 32,
    },
    leaveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EF4444',
        paddingVertical: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    leaveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    settingsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    settingsButtonText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
});

export default GroupInfoModal;
