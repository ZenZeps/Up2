import { Background } from '@/components/ui/Background';
import { blockUser, cancelFriendRequest, getPendingFriendRequests, getUserFriends, sendFriendRequest, unfriendUser } from '@/lib/api/friendship';
import { getUserGroups } from '@/lib/api/group';
import { getProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { cacheManager } from '@/lib/debug/cacheManager';
import { useGlobalContext } from '@/lib/global-provider';
import { sendFriendRequestNotification } from '@/lib/notifications/notificationUtils';
import { Group } from '@/lib/types/Groups';
import { UserProfile as UserProfileType } from '@/lib/types/Users';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';

const UserProfile = () => {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { user: currentUser } = useGlobalContext();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const userId = Array.isArray(id) ? id[0] : id;

    // Track where user came from for better navigation
    const [previousRoute, setPreviousRoute] = useState<string | null>(null);

    const [userProfile, setUserProfile] = useState<UserProfileType | null>(null);
    const [friends, setFriends] = useState<any[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        friends: 0,
        groups: 0,
    });
    const [friendshipState, setFriendshipState] = useState<'none' | 'requested' | 'friends'>('none');

    // Create a reusable loadUserData function
    const loadUserData = useCallback(async () => {
        if (!userId) return;

        try {
            setLoading(true);

            // Load user profile
            const profile = await getUserProfile(userId);
            if (!profile) {
                router.back();
                return;
            }
            setUserProfile(profile);

            // Load groups first
            const userGroups = await getUserGroups(userId);

            // Load friends using new friendship system
            const friendIds = await getUserFriends(userId);
            const userFriends = friendIds && friendIds.length > 0 ? await getUsersByIds(friendIds) : [];

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
    }, [userId, router]);

    // Load data on mount
    useEffect(() => {
        loadUserData();
    }, [loadUserData]);

    // Refresh data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadUserData();
        }, [loadUserData])
    );

    // Load friendship state between current user and this profile
    useEffect(() => {
        const loadFriendship = async () => {
            try {
                if (!currentUser?.$id || !userId) return;

                // Check accepted friends
                const friendsIds = await getUserFriends(currentUser.$id);
                if (friendsIds.includes(userId)) {
                    setFriendshipState('friends');
                    return;
                }

                // Check pending requests (sent or received)
                const pending = await getPendingFriendRequests(currentUser.$id);
                const relatedPending = [...pending.sent, ...pending.received].some((f: any) => {
                    return f.userId1 === userId || f.userId2 === userId;
                });

                if (relatedPending) {
                    setFriendshipState('requested');
                    return;
                }

                setFriendshipState('none');
            } catch (error) {
                console.error('Error loading friendship state:', error);
            }
        };

        loadFriendship();
    }, [currentUser?.$id, userId]);

    const handleViewCalendar = () => {
        try {
            console.log('Navigating to calendar for user:', userId);
            // Navigate to user's calendar page
            router.push(`/UserCalendar/${userId}` as any);
        } catch (error) {
            console.error('Error navigating to calendar:', error);
        }
    };

    const handleSendFriendRequest = async () => {
        if (!currentUser?.$id) return;
        try {
            const res = await sendFriendRequest(currentUser.$id, userId as string);
            if (res?.success) {
                setFriendshipState('requested');
                try {
                    const senderName = currentUser.name || `${firstName} ${lastName}`;
                    await sendFriendRequestNotification(userId as string, senderName, currentUser.$id);
                } catch (notifErr) {
                    console.warn('Failed to send friend request notification:', notifErr);
                }
            }
        } catch (error) {
            console.error('Error sending friend request:', error);
        }
    };

    const handleCancelFriendRequest = async () => {
        if (!currentUser?.$id) return;
        try {
            const res = await cancelFriendRequest(currentUser.$id, userId as string);
            if (res?.success) {
                setFriendshipState('none');
            }
        } catch (error) {
            console.error('Error cancelling friend request:', error);
        }
    };

    const handleUnfriend = async () => {
        if (!currentUser?.$id) return;
        try {
            const res = await unfriendUser(currentUser.$id, userId as string);
            if (res?.success) {
                setFriendshipState('none');
            }
        } catch (error) {
            console.error('Error unfriending user:', error);
        }
    };

    const handleBlockUser = async () => {
        if (!currentUser?.$id) return;
        try {
            const res = await blockUser(currentUser.$id, userId as string);
            if (res?.success) {
                // Clear relevant caches to ensure UI updates
                cacheManager.clearPattern(new RegExp(`^user-friends-${currentUser.$id}`));
                cacheManager.clearPattern(new RegExp(`^user-${userId}`));
                cacheManager.clearPattern(new RegExp(`^pending-friend-requests-`));

                // Navigate back safely, or go to main tabs if no history
                if (router.canGoBack()) {
                    router.back();
                } else {
                    router.replace('/(root)/(tabs)/Profile');
                }
            }
        } catch (error) {
            console.error('Error blocking user:', error);
        }
    };

    // Custom back handler that respects navigation history
    const handleBack = () => {
        router.back();
    };
    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!userProfile) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <Text style={[styles.loadingText, { color: colors.text }]}>User not found</Text>
                </View>
            </SafeAreaView>
        );
    } const { firstName = '', lastName = '' } = userProfile || {};

    return (
        <Background>
            <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
                <ScrollView
                    style={styles.scrollContainer}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: 70 + insets.bottom }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Simple Profile Header like main Profile page */}
                    <View style={[styles.profileHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                        {/* Header Actions */}
                        <View style={styles.headerActions}>
                            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                                <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                            </TouchableOpacity>
                            <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>

                            {/* Action buttons moved to top right */}
                            {currentUser && currentUser.$id !== userId && (
                                <View style={styles.topRightActions}>
                                    {friendshipState === 'friends' && (
                                        <>
                                            <TouchableOpacity
                                                style={[styles.topRightButton, { backgroundColor: colors.error }]}
                                                onPress={handleUnfriend}
                                            >
                                                <MaterialIcons name="person-remove" size={18} color="white" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.topRightButton, { backgroundColor: '#dc3545', marginLeft: 8 }]}
                                                onPress={handleBlockUser}
                                            >
                                                <MaterialIcons name="block" size={18} color="white" />
                                            </TouchableOpacity>
                                        </>
                                    )}
                                    {friendshipState !== 'friends' && (
                                        <TouchableOpacity
                                            style={[styles.topRightButton, { backgroundColor: '#dc3545' }]}
                                            onPress={handleBlockUser}
                                        >
                                            <MaterialIcons name="block" size={18} color="white" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                            {(!currentUser || currentUser.$id === userId) && <View style={styles.headerSpacer} />}
                        </View>

                        {/* Profile Content */}
                        <View style={styles.profileContent}>
                            <View style={styles.avatarContainer}>
                                {profilePhotoUrl ? (
                                    <Image source={{ uri: profilePhotoUrl }} style={[styles.profileAvatar, { borderColor: colors.border }]} />
                                ) : (
                                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary, borderColor: colors.border }]}>
                                        <Text style={styles.avatarText}>{userDisplayUtils.getInitials({ firstName, lastName })}</Text>
                                    </View>
                                )}
                            </View>

                            <Text style={[styles.profileName, { color: colors.text }]}>{userDisplayUtils.getFullName({ firstName, lastName })}</Text>
                            <Text style={[styles.profileTitle, { color: colors.textSecondary }]}>
                                {userProfile?.about ? userProfile.about.slice(0, 80) + (userProfile.about.length > 80 ? '...' : '') : 'No bio yet'}
                            </Text>

                            {/* Simple Stats Row */}
                            <View style={styles.statsContainer}>
                                <TouchableOpacity style={styles.statItem}>
                                    <Text style={[styles.statNumber, { color: colors.text }]}>{stats.friends}</Text>
                                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Friends</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.statItem}>
                                    <Text style={[styles.statNumber, { color: colors.text }]}>{stats.groups}</Text>
                                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Groups</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Action Buttons - simplified, removed duplicate remove/block buttons */}
                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={[styles.modernButton, styles.primaryButton, { backgroundColor: colors.primary }]}
                                    onPress={handleViewCalendar}
                                >
                                    <MaterialIcons name="calendar-today" size={18} color={colors.buttonText} />
                                    <Text style={[styles.modernButtonText, { color: colors.buttonText }]}>Calendar</Text>
                                </TouchableOpacity>

                                {currentUser && currentUser.$id !== userId && (
                                    <>
                                        {friendshipState === 'none' && (
                                            <TouchableOpacity
                                                style={[styles.modernButton, styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                                                onPress={handleSendFriendRequest}
                                            >
                                                <MaterialIcons name="person-add" size={18} color={colors.primary} />
                                                <Text style={[styles.modernButtonText, { color: colors.primary }]}>Add Friend</Text>
                                            </TouchableOpacity>
                                        )}
                                        {friendshipState === 'requested' && (
                                            <TouchableOpacity
                                                style={[styles.modernButton, styles.warningButton]}
                                                onPress={handleCancelFriendRequest}
                                            >
                                                <MaterialIcons name="schedule" size={18} color="white" />
                                                <Text style={[styles.modernButtonText, { color: 'white' }]}>Pending</Text>
                                            </TouchableOpacity>
                                        )}

                                    </>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Bio Section (combine about + personal details) */}
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardTitleContainer}>
                                <MaterialIcons name="info" size={20} color={colors.primary} />
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Bio</Text>
                            </View>
                        </View>

                        <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
                            <View style={styles.detailsContainer}>
                                <View style={styles.detailRow}>
                                    <MaterialIcons name="flag" size={18} color={colors.textSecondary} />
                                    <View style={styles.detailContent}>
                                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Nationality</Text>
                                        <Text style={[styles.detailValue, { color: colors.text }]}>{userProfile?.nationality || 'Not specified'}</Text>
                                    </View>
                                </View>

                                <View style={styles.detailRow}>
                                    <MaterialIcons name="cake" size={18} color={colors.textSecondary} />
                                    <View style={styles.detailContent}>
                                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Age</Text>
                                        <Text style={[styles.detailValue, { color: colors.text }]}>{userProfile?.age ? `${userProfile.age} years old` : 'Not specified'}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Friends Section */}
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardTitleContainer}>
                                <MaterialIcons name="people" size={20} color={colors.primary} />
                                <Text style={[styles.cardTitle, { color: colors.text }]}>
                                    Friends ({stats.friends})
                                </Text>
                            </View>
                        </View>

                        <View style={styles.horizontalList}>
                            <FlatList
                                data={friends}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={(item) => item.$id}
                                contentContainerStyle={styles.friendsList}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.friendItem}
                                        onPress={() => router.push(`/UserProfile/${item.$id}` as any)}
                                    >
                                        <UserAvatar
                                            photoUrl={item.photoId ? getProfilePhotoUrl(item.photoId) : null}
                                            firstName={item.firstName}
                                            lastName={item.lastName}
                                            size={56}
                                        />
                                        <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
                                            {userDisplayUtils.getFirstName(item)}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <MaterialIcons name="person-add" size={32} color={colors.textSecondary} />
                                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                            No friends yet
                                        </Text>
                                    </View>
                                }
                            />
                        </View>
                    </View>

                    {/* Groups Section */}
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardTitleContainer}>
                                <MaterialIcons name="group" size={20} color={colors.primary} />
                                <Text style={[styles.cardTitle, { color: colors.text }]}>
                                    Groups ({stats.groups})
                                </Text>
                            </View>
                        </View>

                        <View style={styles.horizontalList}>
                            <FlatList
                                data={groups}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={(item) => item.$id}
                                contentContainerStyle={styles.groupsList}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.groupItem}
                                        onPress={() => router.push(`/Group/${item.$id}`)}
                                    >
                                        <View style={[styles.groupAvatar, { backgroundColor: colors.primary }]}>
                                            <Text style={styles.groupAvatarText}>
                                                {item.title.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>
                                            {item.title}
                                        </Text>
                                        <Text style={[styles.groupMembers, { color: colors.textSecondary }]}>
                                            {item.memberCount ?? (Array.isArray(item.users) ? item.users.length : 0)} members
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <MaterialIcons name="group-add" size={32} color={colors.textSecondary} />
                                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                            No groups yet
                                        </Text>
                                    </View>
                                }
                            />
                        </View>
                    </View>

                    {/* Calendar Action Section removed (moved above Bio) */}
                </ScrollView>
            </SafeAreaView>
        </Background>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        fontSize: 16,
    },
    scrollContainer: {
        flex: 1,
    },
    headerSpacer: {
        width: 24,
    },
    topRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    topRightButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    profileHeader: {
        borderBottomWidth: 1,
        paddingBottom: 20,
        marginBottom: 20,
    },
    headerActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
    },
    backButton: {
        padding: 8,
    },
    profileContent: {
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    profileAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '700',
        color: 'white',
    },
    profileName: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    profileTitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 22,
    },
    statsContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 40,
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
        flexWrap: 'wrap',
    },
    modernButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 30,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        minWidth: 120,
        justifyContent: 'center',
    },
    primaryButton: {
        // backgroundColor set dynamically
    },
    secondaryButton: {
        borderWidth: 2,
        // backgroundColor and borderColor set dynamically
    },
    warningButton: {
        backgroundColor: '#f59e0b',
    },
    dangerButton: {
        backgroundColor: '#ef4444',
    },
    blockButton: {
        borderWidth: 1,
        borderColor: '#dc3545',
        backgroundColor: 'transparent',
    },
    blockButtonContainer: {
        marginTop: 12,
        alignItems: 'center',
    },
    modernButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
    calendarButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
        gap: 8,
    },
    calendarButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    friendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
        borderWidth: 1,
        gap: 8,
    },
    friendButtonText: {
        fontSize: 14,
        fontWeight: '600',
        paddingVertical: 14,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 12,
        textAlign: 'center',
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
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    cardTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 8,
    },
    contentContainer: {
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
    },
    detailsContainer: {
        gap: 16,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    detailContent: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '400',
    },
    horizontalList: {
        height: 120,
    },
    friendsList: {
        paddingHorizontal: 4,
    },
    friendItem: {
        alignItems: 'center',
        marginHorizontal: 8,
        width: 64,
    },
    friendName: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 8,
        textAlign: 'center',
    },
    groupsList: {
        paddingHorizontal: 4,
    },
    groupItem: {
        alignItems: 'center',
        marginHorizontal: 8,
        width: 80,
    },
    groupAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    groupAvatarText: {
        fontSize: 20,
        fontWeight: '700',
        color: 'white',
    },
    groupName: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 8,
        textAlign: 'center',
    },
    groupMembers: {
        fontSize: 10,
        textAlign: 'center',
        marginTop: 2,
    },
    emptyTextSecondary: {
        fontSize: 16,
        marginTop: 8,
        textAlign: 'center',
    },
});

export default UserProfile;
