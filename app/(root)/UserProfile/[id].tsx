import { cancelFriendRequest, getPendingFriendRequests, getUserFriends, sendFriendRequest, unfriendUser } from '@/lib/api/friendship';
import { getUserGroups } from '@/lib/api/group';
import { getProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { sendFriendRequestNotification } from '@/lib/notifications/notificationUtils';
import { Group } from '@/lib/types/Groups';
import { UserProfile as UserProfileType } from '@/lib/types/Users';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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

    const handleMessageUser = () => {
        // Navigate to conversation with this user
        router.push(`/Messages/${userId}` as any);
    };

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
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 70 + insets.bottom }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Modern Header (centered, scrolls with page) */}
                <View style={styles.header}>
                    <LinearGradient
                        colors={['#FF6B6B', '#FFD166']}
                        start={[0, 0]}
                        end={[1, 1]}
                        style={styles.coverGradient}
                    >
                        <View style={styles.coverContent}>
                            <View style={styles.leftArea}>
                                <View style={styles.avatarWrapper}>
                                    {profilePhotoUrl ? (
                                        <Image source={{ uri: profilePhotoUrl }} style={[styles.avatarLarge, { borderColor: colors.card }]} />
                                    ) : (
                                        <View style={[styles.avatarPlaceholderLarge, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colors.card }]}>
                                            <Text style={[styles.avatarTextLarge, { color: colors.text }]}>{userDisplayUtils.getInitials({ firstName, lastName })}</Text>
                                        </View>
                                    )}
                                </View>

                                <Text style={[styles.userNameLarge, { color: colors.text, marginTop: 12 }]}>{userDisplayUtils.getFullName({ firstName, lastName })}</Text>
                                <Text style={[styles.userSubtitleSmall, { color: colors.textSecondary, marginTop: 6 }]}>{userProfile?.about ? userProfile.about.slice(0, 60) + (userProfile.about.length > 60 ? '...' : '') : 'No bio yet'}</Text>

                                <View style={[styles.statsRow, { marginTop: 12 }]}>
                                    <View style={[styles.statCard, { backgroundColor: 'transparent' }]}>
                                        <Text style={[styles.statNumberLarge, { color: colors.text }]}>{stats.friends}</Text>
                                        <Text style={[styles.statLabelSmall, { color: colors.textSecondary }]}>Friends</Text>
                                    </View>
                                    <View style={[styles.statCard, { backgroundColor: 'transparent' }]}>
                                        <Text style={[styles.statNumberLarge, { color: colors.text }]}>{stats.groups}</Text>
                                        <Text style={[styles.statLabelSmall, { color: colors.textSecondary }]}>Groups</Text>
                                    </View>
                                </View>
                            </View>

                            {/* rightArea removed - controls moved to centered action row below */}
                        </View>
                    </LinearGradient>
                </View>

                {/* Action row: Calendar + Friend controls (inline, no card) */}
                <View style={[styles.actionRowContainer, { marginTop: 12, justifyContent: 'center' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={handleViewCalendar} style={[styles.actionButtonEqual, { backgroundColor: colors.primary }]}>
                            <MaterialIcons name="calendar-today" size={18} color={colors.buttonText} />
                            <Text style={[styles.actionButtonText, { color: colors.buttonText }]}>Calendar</Text>
                        </TouchableOpacity>

                        {currentUser && currentUser.$id !== userId && (
                            <>
                                {friendshipState === 'none' && (
                                    <TouchableOpacity style={[styles.actionButtonEqual, { backgroundColor: colors.primary }]} onPress={handleSendFriendRequest}>
                                        <MaterialIcons name="person-add" size={18} color={colors.buttonText} />
                                        <Text style={[styles.actionButtonText, { color: colors.buttonText }]}>Add</Text>
                                    </TouchableOpacity>
                                )}
                                {friendshipState === 'requested' && (
                                    <TouchableOpacity style={[styles.actionButtonEqual, { backgroundColor: '#f59e0b' }]} onPress={handleCancelFriendRequest}>
                                        <MaterialIcons name="hourglass-empty" size={18} color={colors.buttonText} />
                                        <Text style={[styles.actionButtonText, { color: colors.buttonText }]}>Cancel</Text>
                                    </TouchableOpacity>
                                )}
                                {friendshipState === 'friends' && (
                                    <TouchableOpacity style={[styles.actionButtonEqual, { backgroundColor: '#ef4444' }]} onPress={handleUnfriend}>
                                        <MaterialIcons name="person" size={18} color="white" />
                                        <Text style={styles.actionButtonText}>Remove</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
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
                        <View style={styles.aboutRow}>
                            <View style={styles.aboutIconWrap}>
                                <MaterialIcons name="favorite" size={18} color={colors.primary} />
                            </View>
                            <View style={styles.aboutTextWrap}>
                                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>About</Text>
                                <Text style={[styles.detailValue, { color: colors.text, marginTop: 6 }]}>{userProfile?.about || 'No about information set'}</Text>
                            </View>
                        </View>

                        <View style={[styles.detailsContainer, { marginTop: 12 }]}>
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
    /* Compact header and small-avatar styles (kept for legacy layouts) */
    headerGradient: {
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flex: 1,
    },
    leftProfileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarContainer: {
        marginRight: 16,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 3,
        borderColor: 'white',
    },
    avatarPlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'white',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: '600',
        color: 'white',
    },
    settingsButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    actionButtonEqual: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 120,
        justifyContent: 'center',
    },
    aboutRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 6,
    },
    aboutIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    aboutTextWrap: {
        flex: 1,
    },
    /* Modern profile header styles (aligned with main Profile) */
    coverGradient: {
        paddingVertical: 18,
        paddingHorizontal: 0,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
    },
    coverContent: {
        flexDirection: 'column',
        alignItems: 'center',
        paddingVertical: 12,
    },
    leftArea: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        width: '100%',
    },
    rightArea: {
        position: 'absolute',
        right: 16,
        top: 16,
    },
    header: {
        position: 'relative',
        overflow: 'hidden',
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        marginHorizontal: -16, // cancel ScrollView padding so gradient spans full width
        paddingTop: 0,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 8,
    },
    avatarLarge: {
        width: 132,
        height: 132,
        borderRadius: 66,
        borderWidth: 3,
        borderColor: 'white',
    },
    avatarPlaceholderLarge: {
        width: 132,
        height: 132,
        borderRadius: 66,
        backgroundColor: 'rgba(0,0,0,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarTextLarge: {
        fontSize: 36,
        fontWeight: '700',
        color: 'white',
    },
    userNameLarge: {
        fontSize: 20,
        fontWeight: '800',
        color: 'white',
        textAlign: 'center',
    },
    userSubtitleSmall: {
        marginTop: 6,
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
    },
    statsRow: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statCard: {
        minWidth: 86,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginHorizontal: 8,
    },
    statNumberLarge: {
        fontSize: 16,
        fontWeight: '800',
        color: 'white',
    },
    statLabelSmall: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.85)'
    },
    nameSection: {
        flex: 1,
    },
    userName: {
        fontSize: 20,
        fontWeight: '700',
        color: 'white',
        marginBottom: 4,
    },
    rightStatsSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingLeft: 16,
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: 'white',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '500',
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
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
    contentText: {
        fontSize: 16,
        lineHeight: 24,
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
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    emptyText: {
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
    calendarButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 8,
    },
    calendarButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        gap: 8,
    },
    createButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    actionRowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 0,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    actionButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
});

export default UserProfile;
