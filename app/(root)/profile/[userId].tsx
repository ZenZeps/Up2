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
    const { userId } = useLocalSearchParams();
    const { user: currentUser } = useGlobalContext();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const userIdString = Array.isArray(userId) ? userId[0] : userId;

    // Debug logging
    console.log('UserProfile: Route params:', { userId, userIdString });

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

    // Create a reusable loadUserData function with smart caching
    const loadUserData = useCallback(async (forceRefresh: boolean = false) => {
        console.log('UserProfile: loadUserData called with userIdString:', userIdString, 'forceRefresh:', forceRefresh);
        if (!userIdString) {
            console.log('UserProfile: No userIdString, returning early');
            return;
        }

        // Check cache first if not forcing refresh
        if (!forceRefresh) {
            const cacheKey = `user-profile-data-${userIdString}`;
            const cachedData = cacheManager.getEntry<{
                profile: UserProfileType;
                friends: any[];
                groups: Group[];
                profilePhotoUrl: string | null;
                stats: { friends: number; groups: number };
            }>(cacheKey);

            if (cachedData) {
                console.log('UserProfile: Using cached profile data for:', userIdString);
                setUserProfile(cachedData.data.profile);
                setFriends(cachedData.data.friends);
                setGroups(cachedData.data.groups);
                setProfilePhotoUrl(cachedData.data.profilePhotoUrl);
                setStats(cachedData.data.stats);
                setLoading(false);
                return;
            }
        }

        try {
            setLoading(true);
            console.log('UserProfile: Loading user profile from API for:', userIdString);

            // Load user profile (getUserProfile already has caching with 10-minute TTL)
            const profile = await getUserProfile(userIdString);
            console.log('UserProfile: Profile loaded:', profile ? 'success' : 'null');
            if (!profile) {
                console.log('UserProfile: No profile found, going back');
                router.back();
                return;
            }
            setUserProfile(profile);

            // Load groups and friends in parallel for better performance
            const [userGroups, friendIds] = await Promise.all([
                getUserGroups(userIdString),
                getUserFriends(userIdString)
            ]);

            const userFriends = friendIds && friendIds.length > 0 ? await getUsersByIds(friendIds) : [];

            setFriends(userFriends || []);
            setGroups(userGroups || []);
            const statsData = {
                friends: userFriends?.length || 0,
                groups: userGroups?.length || 0,
            };
            setStats(statsData);

            // Load profile photo if available
            let photoUrl: string | null = null;
            if (profile?.photoId) {
                photoUrl = await getProfilePhotoUrl(profile.photoId);
                setProfilePhotoUrl(photoUrl);
            }

            // Cache the complete profile data for 5 minutes to reduce redundant calls
            const cacheKey = `user-profile-data-${userIdString}`;
            cacheManager.set(cacheKey, {
                profile,
                friends: userFriends || [],
                groups: userGroups || [],
                profilePhotoUrl: photoUrl,
                stats: statsData
            }, 5 * 60 * 1000); // 5 minute cache

            console.log('UserProfile: Profile data loaded and cached for:', userIdString);
        } catch (error) {
            console.error('Error loading user profile:', error);
        } finally {
            setLoading(false);
        }
    }, [userIdString, router]);

    // Load data on mount only
    useEffect(() => {
        loadUserData(false); // Use cache if available
    }, [loadUserData]);

    // Only refresh data when screen comes into focus if cache is stale or user navigated back
    useFocusEffect(
        useCallback(() => {
            // Check if we have fresh data (loaded within last 2 minutes)
            const cacheKey = `user-profile-data-${userIdString}`;
            const cachedData = cacheManager.getEntry(cacheKey);

            if (!cachedData || (Date.now() - cachedData.timestamp) > 2 * 60 * 1000) {
                console.log('UserProfile: Cache stale or missing, refreshing on focus');
                loadUserData(false); // Still use cache-first approach
            } else {
                console.log('UserProfile: Fresh cache available, skipping focus refresh');
            }
        }, [loadUserData, userIdString])
    );

    // Load friendship state between current user and this profile
    useEffect(() => {
        const loadFriendship = async () => {
            try {
                if (!currentUser?.$id || !userIdString) return;

                // Check accepted friends
                const friendsIds = await getUserFriends(currentUser.$id);
                if (friendsIds.includes(userIdString)) {
                    setFriendshipState('friends');
                    return;
                }

                // Check pending requests (sent or received)
                const pending = await getPendingFriendRequests(currentUser.$id);
                const relatedPending = [...pending.sent, ...pending.received].some((f: any) => {
                    return f.userId1 === userIdString || f.userId2 === userIdString;
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
    }, [currentUser?.$id, userIdString]);

    const handleViewCalendar = () => {
        try {
            console.log('Navigating to calendar for user:', userIdString);
            // Navigate to user's calendar page
            router.push(`/(root)/calendar/user/${userIdString}` as any);
        } catch (error) {
            console.error('Error navigating to calendar:', error);
        }
    };

    const handleSendFriendRequest = async () => {
        if (!currentUser?.$id) return;
        try {
            const res = await sendFriendRequest(currentUser.$id, userIdString as string);
            if (res?.success) {
                setFriendshipState('requested');
                try {
                    const senderName = currentUser.name || `${firstName} ${lastName}`;
                    await sendFriendRequestNotification(userIdString as string, senderName, currentUser.$id);
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
            const res = await cancelFriendRequest(currentUser.$id, userIdString as string);
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
            const res = await unfriendUser(currentUser.$id, userIdString as string);
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
            const res = await blockUser(currentUser.$id, userIdString as string);
            if (res?.success) {
                // Clear relevant caches to ensure UI updates
                cacheManager.clearPattern(new RegExp(`^user-friends-${currentUser.$id}`));
                cacheManager.clearPattern(new RegExp(`^user-${userIdString}`));
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

                            {/* Action buttons moved to top right */}
                            {currentUser && currentUser.$id !== userIdString && (
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

                                {currentUser && currentUser.$id !== userIdString && (
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
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
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
                                        onPress={() => router.push(`/(root)/profile/${item.$id}` as any)}
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
                                        onPress={() => router.push(`/(root)/groups/${item.$id}`)}
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
        paddingVertical: 8,
    },
    profileHeader: {
        borderBottomWidth: 1,
        paddingBottom: 16,
        marginBottom: 12,
    },
    headerActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
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
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 2,
    },
    avatarPlaceholder: {
        width: 140,
        height: 140,
        borderRadius: 70,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    avatarText: {
        fontSize: 42,
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
        marginBottom: 12,
        padding: 16,
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
        marginBottom: 8,
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
        padding: 12,
        borderRadius: 12,
        marginTop: 0,
    },
    detailsContainer: {
        gap: 12,
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
