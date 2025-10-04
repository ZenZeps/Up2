import { getUserFriends } from '@/lib/api/friendship';
import { sendGroupInvite } from '@/lib/api/group';
import { getUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { UserProfile } from '@/lib/types/Users';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserAvatar from '../UserAvatar';

interface GroupInviteFriendsModalProps {
    visible: boolean;
    onClose: () => void;
    groupId: string;
    currentUserId: string;
    existingMemberIds: string[];
    onInviteSuccess: () => void;
}

const GroupInviteFriendsModal: React.FC<GroupInviteFriendsModalProps> = ({
    visible,
    onClose,
    groupId,
    currentUserId,
    existingMemberIds = [],
    onInviteSuccess,
}) => {
    const { colors } = useTheme();
    const [friends, setFriends] = useState<UserProfile[]>([]);
    const [filteredFriends, setFilteredFriends] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviting, setInviting] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

    useEffect(() => {
        if (visible && currentUserId) {
            loadFriends();
        }
    }, [visible, currentUserId]);

    useEffect(() => {
        filterFriends();
    }, [friends, searchQuery, existingMemberIds]);

    const loadFriends = async () => {
        try {
            setLoading(true);
            const friendIds = await getUserFriends(currentUserId);

            if (friendIds && friendIds.length > 0) {
                // Load friend profiles
                const friendProfiles = await Promise.all(
                    friendIds.map(async (friendId: string) => {
                        try {
                            return await getUserProfile(friendId);
                        } catch (error) {
                            console.warn(`Failed to load friend profile: ${friendId}`, error);
                            return null;
                        }
                    })
                );

                const validFriends = friendProfiles.filter((friend): friend is UserProfile =>
                    friend !== null
                );

                setFriends(validFriends);
            } else {
                setFriends([]);
            }
        } catch (error) {
            console.error('Error loading friends:', error);
            Alert.alert('Error', 'Failed to load your friends list.');
        } finally {
            setLoading(false);
        }
    };

    const filterFriends = () => {
        let filtered = friends.filter(friend =>
            !existingMemberIds.includes(friend.$id)
        );

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(friend => {
                const fullName = userDisplayUtils.getFullName(friend).toLowerCase();
                const firstName = friend.firstName?.toLowerCase() || '';
                const lastName = friend.lastName?.toLowerCase() || '';

                return fullName.includes(query) ||
                    firstName.includes(query) ||
                    lastName.includes(query);
            });
        }

        setFilteredFriends(filtered);
    };

    const toggleFriendSelection = (friendId: string) => {
        setSelectedFriends(prev => {
            if (prev.includes(friendId)) {
                return prev.filter(id => id !== friendId);
            } else {
                return [...prev, friendId];
            }
        });
    };

    const inviteSelectedFriends = async () => {
        if (selectedFriends.length === 0) {
            Alert.alert('No Friends Selected', 'Please select at least one friend to invite.');
            return;
        }

        try {
            setInviting(selectedFriends);

            const promises = selectedFriends.map(friendId =>
                sendGroupInvite(groupId, friendId, currentUserId)
            );

            const results = await Promise.allSettled(promises);

            const successful = results.filter(result => result.status === 'fulfilled').length;
            const failed = results.length - successful;

            if (successful > 0) {
                const message = failed > 0
                    ? `Successfully invited ${successful} friends. ${failed} invitations failed.`
                    : `Successfully invited ${successful} friend${successful > 1 ? 's' : ''}!`;

                Alert.alert('Invitations Sent', message);
                onInviteSuccess();
                onClose();
            } else {
                Alert.alert('Invitation Failed', 'Failed to send invitations. Please try again.');
            }
        } catch (error) {
            console.error('Error inviting friends:', error);
            Alert.alert('Error', 'Failed to send invitations. Please try again.');
        } finally {
            setInviting([]);
            setSelectedFriends([]);
        }
    };

    const renderFriendItem = ({ item }: { item: UserProfile }) => {
        const isSelected = selectedFriends.includes(item.$id);
        const isInviting = inviting.includes(item.$id);

        return (
            <TouchableOpacity
                style={[
                    styles.friendItem,
                    {
                        backgroundColor: colors.card,
                        borderColor: isSelected ? colors.primary : colors.border
                    }
                ]}
                onPress={() => toggleFriendSelection(item.$id)}
                disabled={isInviting}
            >
                <UserAvatar
                    photoUrl={item.photoId ? `photo-${item.photoId}` : undefined}
                    name={userDisplayUtils.getFullName(item)}
                    size={48}
                />

                <View style={styles.friendInfo}>
                    <Text style={[styles.friendName, { color: colors.text }]}>
                        {userDisplayUtils.getFullName(item)}
                    </Text>
                </View>

                <View style={styles.selectionIndicator}>
                    {isInviting ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <MaterialIcons
                            name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                            size={24}
                            color={isSelected ? colors.primary : colors.textSecondary}
                        />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <TouchableOpacity style={styles.backButton} onPress={onClose}>
                        <MaterialIcons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>
                        Invite Friends
                    </Text>
                    <TouchableOpacity
                        style={[
                            styles.inviteButton,
                            {
                                backgroundColor: selectedFriends.length > 0 ? colors.primary : colors.border,
                                opacity: selectedFriends.length > 0 ? 1 : 0.5
                            }
                        ]}
                        onPress={inviteSelectedFriends}
                        disabled={selectedFriends.length === 0 || inviting.length > 0}
                    >
                        <Text style={[styles.inviteButtonText, { color: colors.buttonText }]}>
                            Invite ({selectedFriends.length})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
                    <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <MaterialIcons name="search" size={20} color={colors.textSecondary} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholder="Search friends..."
                            placeholderTextColor={colors.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                {/* Friends List */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                            Loading your friends...
                        </Text>
                    </View>
                ) : filteredFriends.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="group-add" size={64} color={colors.textSecondary} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>
                            {friends.length === 0 ? 'No Friends Yet' : 'No Friends to Invite'}
                        </Text>
                        <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
                            {friends.length === 0
                                ? 'Add some friends to start inviting them to groups!'
                                : searchQuery
                                    ? 'No friends match your search.'
                                    : 'All your friends are already in this group.'
                            }
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredFriends}
                        keyExtractor={item => item.$id}
                        renderItem={renderFriendItem}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </SafeAreaView>
        </Modal>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
        width: 40,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 10,
    },
    inviteButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        minWidth: 80,
    },
    inviteButtonText: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
    },
    listContainer: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 2,
    },
    friendInfo: {
        flex: 1,
        marginLeft: 12,
    },
    friendName: {
        fontSize: 16,
        fontWeight: '600',
    },
    selectionIndicator: {
        marginLeft: 12,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyDescription: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
});

export default GroupInviteFriendsModal;