import { Background } from '@/components/ui/Background';
import { getUserAttendingEvents } from '@/lib/api/event';
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
    Alert,
    Animated,
    FlatList,
    Image,
    Modal,
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

    // Consolidated state for better performance
    const [profileData, setProfileData] = useState<{
        userProfile: UserProfileType | null;
        friends: any[];
        groups: Group[];
        profilePhotoUrl: string | null;
        stats: { friends: number; groups: number };
        loading: boolean;
        userEvents: any[];
    }>(() => ({
        userProfile: null,
        friends: [],
        groups: [],
        profilePhotoUrl: null,
        userEvents: [],
        stats: { friends: 0, groups: 0 },
        loading: true
    }));

    const [friendshipState, setFriendshipState] = useState<'none' | 'requested' | 'friends'>('none');
    const [showFriendsModal, setShowFriendsModal] = useState(false);
    const [showGroupsModal, setShowGroupsModal] = useState(false);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [loadingEvents, setLoadingEvents] = useState(true);

    // Simplified animations for better performance
    const headerOpacity = useState(new Animated.Value(1))[0];

    // Memoized destructuring for performance  
    const { userProfile, friends, groups, profilePhotoUrl, stats, loading, userEvents } = profileData;

    // Optimized loadUserData function with consolidated state updates
    const loadUserData = useCallback(async (forceRefresh: boolean = false) => {
        if (!userIdString) return;

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
                setProfileData({
                    userProfile: cachedData.data.profile,
                    friends: cachedData.data.friends,
                    groups: cachedData.data.groups,
                    profilePhotoUrl: cachedData.data.profilePhotoUrl,
                    stats: cachedData.data.stats,
                    userEvents: [],
                    loading: false
                });
                return;
            }
        }

        try {
            setProfileData(prev => ({ ...prev, loading: true }));
            setLoadingEvents(true);

            // Load user profile (getUserProfile already has caching with 10-minute TTL)
            const profile = await getUserProfile(userIdString);
            if (!profile) {
                router.back();
                return;
            }

            // Load essential data first, then events in background
            const [userGroups, friendIds, photoUrl] = await Promise.all([
                getUserGroups(userIdString),
                getUserFriends(userIdString),
                profile?.photoId ? getProfilePhotoUrl(profile.photoId) : Promise.resolve(null)
            ]);

            // Load events in background for better performance with retry logic
            const userEventsPromise = (async () => {
                try {
                    const events = await getUserAttendingEvents(userIdString);
                    return events || [];
                } catch (err) {
                    console.warn('Failed to load user events (first attempt):', err);
                    // Retry once after a brief delay
                    try {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const retryEvents = await getUserAttendingEvents(userIdString);
                        return retryEvents || [];
                    } catch (retryErr) {
                        console.error('Failed to load user events (retry failed):', retryErr);
                        return [];
                    }
                }
            })();

            // Get friend count only for stats - don't load actual friend data for better performance
            const statsData = {
                friends: friendIds?.length || 0,
                groups: userGroups?.length || 0,
            };

            // Set initial data quickly
            const initialData = {
                userProfile: profile,
                friends: [], // Load friends data only when modal is opened
                groups: userGroups || [],
                profilePhotoUrl: photoUrl,
                stats: statsData,
                userEvents: [], // Will be loaded shortly
                loading: false
            };

            setProfileData(initialData);

            // Load events in background and update state
            setLoadingEvents(true);
            const userEvents = await userEventsPromise;

            // Filter events to get upcoming 5 events
            const now = new Date();
            const upcomingEvents = (userEvents || [])
                .filter(event => {
                    try {
                        if (!event.startTime) return false;
                        const eventDate = new Date(event.startTime);
                        return eventDate >= now && !isNaN(eventDate.getTime());
                    } catch {
                        return false;
                    }
                })
                .sort((a, b) => {
                    try {
                        const aTime = new Date(a.startTime).getTime();
                        const bTime = new Date(b.startTime).getTime();
                        return aTime - bTime;
                    } catch {
                        return 0;
                    }
                })
                .slice(0, 5);

            // Update state with events (always update to show empty state if no events)
            setProfileData(prev => ({
                ...prev,
                userEvents: upcomingEvents
            }));
            setLoadingEvents(false);

            // Cache the complete profile data for 10 minutes to reduce redundant calls
            const cacheKey = `user-profile-data-${userIdString}`;
            cacheManager.set(cacheKey, {
                profile,
                friends: [],
                groups: userGroups || [],
                profilePhotoUrl: photoUrl,
                stats: statsData
            }, 10 * 60 * 1000);
        } catch (error) {
            console.error('Error loading user profile:', error);
            setProfileData(prev => ({
                ...prev,
                loading: false,
                userEvents: [] // Ensure events are empty on error
            }));
            setLoadingEvents(false);
        }
    }, [userIdString, router]);

    // Load data on mount only
    useEffect(() => {
        loadUserData(false);
    }, [loadUserData]);

    // Simple header animation only
    useEffect(() => {
        if (!loading && userProfile) {
            headerOpacity.setValue(1);
        }
    }, [loading, userProfile, headerOpacity]);

    // Enhanced focus effect - reload if no data or no events
    useFocusEffect(
        useCallback(() => {
            if (!userProfile) {
                loadUserData(false);
            } else if (userEvents.length === 0) {
                // If profile loaded but no events, try loading events again
                const retryLoadEvents = async () => {
                    try {
                        setLoadingEvents(true);
                        const events = await getUserAttendingEvents(userIdString);

                        const now = new Date();
                        const upcomingEvents = (events || [])
                            .filter(event => {
                                try {
                                    if (!event.startTime) return false;
                                    const eventDate = new Date(event.startTime);
                                    return eventDate >= now && !isNaN(eventDate.getTime());
                                } catch {
                                    return false;
                                }
                            })
                            .sort((a, b) => {
                                try {
                                    const aTime = new Date(a.startTime).getTime();
                                    const bTime = new Date(b.startTime).getTime();
                                    return aTime - bTime;
                                } catch {
                                    return 0;
                                }
                            })
                            .slice(0, 5);

                        setProfileData(prev => ({
                            ...prev,
                            userEvents: upcomingEvents
                        }));
                    } catch (error) {
                        console.warn('Failed to retry loading events on focus:', error);
                    } finally {
                        setLoadingEvents(false);
                    }
                };
                retryLoadEvents();
            }
        }, [loadUserData, userProfile, userEvents.length, userIdString])
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

    // Lazy load friends data when modal is opened
    const loadFriendsData = useCallback(async () => {
        if (!userIdString || friends.length > 0 || loadingFriends) return;

        try {
            setLoadingFriends(true);
            const friendIds = await getUserFriends(userIdString);
            if (friendIds?.length > 0) {
                const userFriends = await getUsersByIds(friendIds);
                setProfileData(prev => ({
                    ...prev,
                    friends: userFriends || []
                }));
            }
        } catch (error) {
            console.error('Error loading friends:', error);
        } finally {
            setLoadingFriends(false);
        }
    }, [userIdString, friends.length, loadingFriends]);

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
        // Check if we can go back in navigation history
        if (router.canGoBack()) {
            router.back();
        } else {
            // Fallback to feed if no history (e.g., direct link access)
            router.push('/(root)/(tabs)/Feed');
        }
    };

    // Hook-based handlers (must be before early returns to follow Rules of Hooks)
    const handleShowFriends = useCallback(() => {
        if (!userProfile) return;
        setShowFriendsModal(true);
        loadFriendsData(); // Load friends data when modal opens
    }, [userProfile, loadFriendsData]);

    const handleShowGroups = useCallback(() => {
        if (!userProfile) return;
        setShowGroupsModal(true);
    }, [userProfile]);



    const handleShowPopularity = useCallback(() => {
        if (!userProfile) return;
        const { firstName = '', lastName = '' } = userProfile;
        const popularityScore = userProfile.popularityScore || 0;
        let popularityLevel = 'New';
        if (popularityScore >= 100) popularityLevel = 'Popular';
        else if (popularityScore >= 50) popularityLevel = 'Active';
        else if (popularityScore >= 20) popularityLevel = 'Growing';

        Alert.alert(
            'Popularity Score',
            `${userDisplayUtils.getFirstName({ firstName, lastName })} has a popularity score of ${popularityScore}\n\nLevel: ${popularityLevel}\n\nPopularity is based on activity, events, and community engagement.`
        );
    }, [userProfile]);

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
    }

    const { firstName = '', lastName = '' } = userProfile || {};

    return (
        <Background>
            <View style={[styles.container, { backgroundColor: 'transparent' }]}>
                <ScrollView
                    style={styles.scrollContainer}
                    contentContainerStyle={{ flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Beautiful Header with Cover Image */}
                    <Animated.View style={[styles.headerContainer, { opacity: headerOpacity }]}>
                        {/* Cover Image/Background */}
                        <View style={[styles.coverImage, { backgroundColor: 'white' }]}>
                            {/* Header Controls */}
                            <View style={styles.headerControls}>
                                <TouchableOpacity style={styles.headerButtonWhite} onPress={handleBack}>
                                    <MaterialIcons name="arrow-back" size={24} color="black" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Profile Content */}
                    <View style={styles.newProfileContent}>
                        {/* Profile Avatar */}
                        <View style={styles.newAvatarSection}>
                            <View style={[styles.newAvatarContainer, { borderColor: colors.background }]}>
                                {profilePhotoUrl ? (
                                    <Image source={{ uri: profilePhotoUrl }} style={styles.newAvatar} />
                                ) : (
                                    <View style={[styles.newAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                                        <Text style={styles.newAvatarText}>{userDisplayUtils.getInitials({ firstName, lastName })}</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Profile Info */}
                        <View style={styles.newProfileInfo}>
                            <Text style={[styles.newProfileName, { color: colors.text }]}>
                                {userDisplayUtils.getFullName({ firstName, lastName })}
                            </Text>

                            {/* Personal Info Row */}
                            <View style={styles.personalInfoRow}>
                                {userProfile?.age && (
                                    <View style={styles.infoItem}>
                                        <MaterialIcons name="cake" size={16} color={colors.textSecondary} />
                                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                            {userProfile.age} years old
                                        </Text>
                                    </View>
                                )}
                                {userProfile?.nationality && (
                                    <View style={styles.infoItem}>
                                        <MaterialIcons name="place" size={16} color={colors.textSecondary} />
                                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                            {userProfile.nationality}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Bio Section - Always show with default if empty */}
                            <Text style={[styles.newBio, { color: colors.text }]}>
                                {userProfile?.about || `${userDisplayUtils.getFirstName({ firstName, lastName })} is exploring the world and meeting new people through Up2!`}
                            </Text>

                            {/* Preferences/Interests */}
                            {userProfile?.preferences && userProfile.preferences.length > 0 && (
                                <View style={styles.interestsContainer}>
                                    <Text style={[styles.interestsTitle, { color: colors.text }]}>Interests</Text>
                                    <View style={styles.interestsTags}>
                                        {userProfile.preferences.slice(0, 5).map((preference, index) => (
                                            <View key={index} style={[styles.interestTag, { backgroundColor: colors.primary + '20' }]}>
                                                <Text style={[styles.interestTagText, { color: colors.primary }]}>
                                                    {preference}
                                                </Text>
                                            </View>
                                        ))}
                                        {userProfile.preferences.length > 5 && (
                                            <View style={[styles.interestTag, { backgroundColor: colors.border }]}>
                                                <Text style={[styles.interestTagText, { color: colors.textSecondary }]}>
                                                    +{userProfile.preferences.length - 5} more
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Stats */}
                        <View style={[styles.newStatsContainer, { backgroundColor: colors.card }]}>
                            <TouchableOpacity
                                style={styles.newStatItem}
                                onPress={handleShowFriends}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.newStatNumber, { color: colors.text }]}>{stats.friends}</Text>
                                <Text style={[styles.newStatLabel, { color: colors.textSecondary }]}>Friends</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.newStatItem}
                                onPress={handleShowGroups}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.newStatNumber, { color: colors.text }]}>{stats.groups}</Text>
                                <Text style={[styles.newStatLabel, { color: colors.textSecondary }]}>Groups</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.newStatItem}
                                onPress={handleShowPopularity}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.newStatNumber, { color: colors.text }]}>{userProfile?.popularityScore || 0}</Text>
                                <Text style={[styles.newStatLabel, { color: colors.textSecondary }]}>Popularity</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Action Buttons */}
                        {currentUser && currentUser.$id !== userIdString && (
                            <View style={styles.newActionButtonsContainer}>
                                {friendshipState === 'none' && (
                                    <>
                                        <TouchableOpacity
                                            style={[styles.newPrimaryButton, { backgroundColor: colors.primary }]}
                                            onPress={handleSendFriendRequest}
                                        >
                                            <MaterialIcons name="person-add" size={20} color="white" />
                                            <Text style={styles.newPrimaryButtonText}>Follow</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.newSecondaryButton, { borderColor: '#ff4444', backgroundColor: '#ffebee' }]}
                                            onPress={handleBlockUser}
                                        >
                                            <MaterialIcons name="block" size={20} color="#ff4444" />
                                            <Text style={[styles.newSecondaryButtonText, { color: '#ff4444' }]}>Block</Text>
                                        </TouchableOpacity>
                                    </>
                                )}

                                {friendshipState === 'requested' && (
                                    <>
                                        <TouchableOpacity
                                            style={[styles.newSecondaryButton, { borderColor: colors.border }]}
                                            onPress={handleCancelFriendRequest}
                                        >
                                            <MaterialIcons name="schedule" size={20} color={colors.textSecondary} />
                                            <Text style={[styles.newSecondaryButtonText, { color: colors.textSecondary }]}>Pending</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.newSecondaryButton, { borderColor: '#ff4444', backgroundColor: '#ffebee' }]}
                                            onPress={handleBlockUser}
                                        >
                                            <MaterialIcons name="block" size={20} color="#ff4444" />
                                            <Text style={[styles.newSecondaryButtonText, { color: '#ff4444' }]}>Block</Text>
                                        </TouchableOpacity>
                                    </>
                                )}

                                {friendshipState === 'friends' && (
                                    <>
                                        <TouchableOpacity
                                            style={[styles.newSecondaryButton, { borderColor: colors.border }]}
                                            onPress={handleUnfriend}
                                        >
                                            <MaterialIcons name="person-remove" size={20} color={colors.textSecondary} />
                                            <Text style={[styles.newSecondaryButtonText, { color: colors.textSecondary }]}>Unfollow</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.newSecondaryButton, { borderColor: '#ff4444', backgroundColor: '#ffebee' }]}
                                            onPress={handleBlockUser}
                                        >
                                            <MaterialIcons name="block" size={20} color="#ff4444" />
                                            <Text style={[styles.newSecondaryButtonText, { color: '#ff4444' }]}>Block</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Upcoming Events Section */}
                    <View style={styles.newActivitiesSection}>
                        <View style={styles.newSectionHeader}>
                            <Text style={[styles.newSectionTitle, { color: colors.text }]}>Upcoming Events</Text>
                            <TouchableOpacity
                                style={[styles.newCalendarButton, { backgroundColor: colors.primary }]}
                                onPress={() => router.push(`/(root)/calendar/user/${userIdString}`)}
                            >
                                <MaterialIcons name="calendar-today" size={16} color="white" />
                                <Text style={styles.newCalendarButtonText}>View Calendar</Text>
                            </TouchableOpacity>
                        </View>

                        {loadingEvents ? (
                            <View style={styles.newEmptyEventsContainer}>
                                <MaterialIcons name="schedule" size={48} color={colors.textSecondary} />
                                <Text style={[styles.newEmptyEventsText, { color: colors.text }]}>
                                    Loading Events...
                                </Text>
                            </View>
                        ) : userEvents && userEvents.length > 0 ? (
                            userEvents.map((event, index) => (
                                <TouchableOpacity
                                    key={event.$id || index}
                                    style={[styles.newActivityCard, { backgroundColor: colors.card }]}
                                    onPress={() => router.push(`/(root)/events/${event.$id}`)}
                                >
                                    <View style={styles.newActivityHeader}>
                                        <MaterialIcons name="event" size={24} color={colors.primary} />
                                        <View style={styles.newActivityInfo}>
                                            <Text style={[styles.newActivityTitle, { color: colors.text }]} numberOfLines={1}>
                                                {event.title}
                                            </Text>
                                            <Text style={[styles.newActivityDate, { color: colors.textSecondary }]}>
                                                {new Date(event.startTime).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </Text>
                                            {event.location && (
                                                <Text style={[styles.newEventLocation, { color: colors.textSecondary }]} numberOfLines={1}>
                                                    <Text>📍 </Text>{event.location}
                                                </Text>
                                            )}
                                        </View>
                                        <MaterialIcons name="arrow-forward-ios" size={16} color={colors.textSecondary} />
                                    </View>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={styles.newEmptyEventsContainer}>
                                <MaterialIcons name="event" size={48} color={colors.textSecondary} />
                                <Text style={[styles.newEmptyEventsText, { color: colors.text }]}>
                                    No Upcoming Events
                                </Text>
                                <Text style={[styles.newEmptyEventsSubtext, { color: colors.textSecondary }]}>
                                    {userProfile?.firstName || 'This user'} doesn't have any upcoming events
                                </Text>
                            </View>
                        )}
                    </View>
                </ScrollView>

                {/* Friends List Modal */}
                <Modal
                    visible={showFriendsModal}
                    animationType="slide"
                    presentationStyle="pageSheet"
                >
                    <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {userDisplayUtils.getFirstName({ firstName, lastName })}'s Friends
                            </Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowFriendsModal(false)}
                            >
                                <MaterialIcons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={friends}
                            keyExtractor={(item) => item.$id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.friendItem, { borderBottomColor: colors.border }]}
                                    onPress={() => {
                                        setShowFriendsModal(false);
                                        router.push(`/(root)/profile/${item.$id}`);
                                    }}
                                >
                                    <UserAvatar
                                        firstName={item.firstName}
                                        lastName={item.lastName}
                                        photoUrl={null} // Individual photo loading handled by UserAvatar
                                        size={50}
                                    />
                                    <View style={styles.friendInfo}>
                                        <Text style={[styles.friendName, { color: colors.text }]}>
                                            {userDisplayUtils.getFullName(item)}
                                        </Text>
                                        {item.nationality && (
                                            <Text style={[styles.friendLocation, { color: colors.textSecondary }]}>
                                                <Text>📍 </Text>{item.nationality}
                                            </Text>
                                        )}
                                    </View>
                                    <MaterialIcons name="arrow-forward-ios" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyListContainer}>
                                    <MaterialIcons name="people" size={64} color={colors.textSecondary} />
                                    <Text style={[styles.emptyListTitle, { color: colors.text }]}>
                                        No Friends
                                    </Text>
                                    <Text style={[styles.emptyListSubtitle, { color: colors.textSecondary }]}>
                                        {userDisplayUtils.getFirstName({ firstName, lastName })} hasn't added any friends yet
                                    </Text>
                                </View>
                            }
                        />
                    </View>
                </Modal>

                {/* Groups List Modal */}
                <Modal
                    visible={showGroupsModal}
                    animationType="slide"
                    presentationStyle="pageSheet"
                >
                    <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {userDisplayUtils.getFirstName({ firstName, lastName })}'s Groups
                            </Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowGroupsModal(false)}
                            >
                                <MaterialIcons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={groups}
                            keyExtractor={(item) => item.$id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.friendItem, { borderBottomColor: colors.border }]}
                                    onPress={() => {
                                        setShowGroupsModal(false);
                                        router.push(`/(root)/groups/${item.$id}`);
                                    }}
                                >
                                    <View style={[styles.groupIcon, { backgroundColor: colors.primary }]}>
                                        <MaterialIcons name="group" size={24} color="white" />
                                    </View>
                                    <View style={styles.friendInfo}>
                                        <Text style={[styles.friendName, { color: colors.text }]}>
                                            {item.title}
                                        </Text>
                                        <Text style={[styles.friendLocation, { color: colors.textSecondary }]}>
                                            {item.memberCount || 0} members
                                        </Text>
                                    </View>
                                    <MaterialIcons name="arrow-forward-ios" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyListContainer}>
                                    <MaterialIcons name="group" size={64} color={colors.textSecondary} />
                                    <Text style={[styles.emptyListTitle, { color: colors.text }]}>
                                        No Groups
                                    </Text>
                                    <Text style={[styles.emptyListSubtitle, { color: colors.textSecondary }]}>
                                        {userDisplayUtils.getFirstName({ firstName, lastName })} hasn't joined any groups yet
                                    </Text>
                                </View>
                            }
                        />
                    </View>
                </Modal>
            </View>
        </Background>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 0,
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


    // === MODERN CLEAN PROFILE STYLES ===

    // Header Styles
    headerContainer: {
        position: 'relative',
    },
    coverImage: {
        height: 120,
        position: 'relative',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        backgroundColor: 'white',
    },

    headerControls: {
        position: 'absolute',
        top: 25,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingHorizontal: 20,
        zIndex: 10,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerButtonWhite: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerRightControls: {
        flexDirection: 'row',
        gap: 12,
    },

    // Profile Content
    newProfileContent: {
        marginTop: -50,
        paddingHorizontal: 20,
        zIndex: 5,
    },
    newAvatarSection: {
        alignItems: 'center',
        marginBottom: 20,
    },
    newAvatarContainer: {
        position: 'relative',
        borderWidth: 4,
        borderRadius: 80,
        padding: 4,
    },
    newAvatar: {
        width: 160,
        height: 160,
        borderRadius: 80,
    },
    newAvatarPlaceholder: {
        width: 160,
        height: 160,
        borderRadius: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    newAvatarText: {
        fontSize: 48,
        fontWeight: '700',
        color: 'white',
    },

    // Profile Info
    newProfileInfo: {
        alignItems: 'center',
        marginBottom: 24,
    },
    newProfileName: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 4,
        textAlign: 'center',
    },
    newLocation: {
        fontSize: 16,
        marginBottom: 12,
        textAlign: 'center',
    },
    newBio: {
        fontSize: 16,
        lineHeight: 22,
        textAlign: 'center',
        paddingHorizontal: 20,
    },

    // Stats Container
    newStatsContainer: {
        flexDirection: 'row',
        marginBottom: 24,
        borderRadius: 12,
        paddingVertical: 20,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    newStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    newStatNumber: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4,
    },
    newStatLabel: {
        fontSize: 14,
        fontWeight: '500',
    },

    // Action Buttons
    newActionButtonsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 32,
    },
    newPrimaryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    newPrimaryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    newSecondaryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        gap: 8,
    },
    newSecondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },



    // Events/Agenda Styles
    eventsCard: {
        marginHorizontal: 16,
        marginBottom: 20,
        padding: 20,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    eventsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    eventsHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    eventsTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    viewAllButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    viewAllText: {
        fontSize: 14,
        fontWeight: '600',
    },
    eventsContent: {
        gap: 16,
    },
    eventsList: {
        gap: 16,
    },
    eventItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderLeftWidth: 4,
        gap: 16,
    },
    eventDate: {
        alignItems: 'center',
        width: 50,
    },
    eventDay: {
        fontSize: 20,
        fontWeight: '700',
    },
    eventMonth: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    eventDetails: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    eventTime: {
        fontSize: 14,
    },
    emptyEventsContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyEventsText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        textAlign: 'center',
    },
    emptyEventsSubtext: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
    },

    // Activities Section
    activitiesSection: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    activitiesList: {
        gap: 16,
    },
    activityItem: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    activityImageContainer: {
        position: 'relative',
        marginRight: 16,
    },
    activityImagePlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activityStatus: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: 'white',
    },
    activityInfo: {
        flex: 1,
    },
    activityTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    activityLocation: {
        fontSize: 14,
        marginBottom: 2,
    },
    activityDate: {
        fontSize: 12,
    },

    // New Activity Section Styles
    newActivitiesSection: {
        padding: 20,
    },
    newSectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    newActivityCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    newActivityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    newActivityInfo: {
        flex: 1,
    },
    newActivityTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    newActivityDate: {
        fontSize: 14,
    },
    newActivityMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    newActivityLikes: {
        fontSize: 12,
        marginLeft: 4,
    },

    // New Styles for Events Section
    newSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    newCalendarButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    newCalendarButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    newEventLocation: {
        fontSize: 12,
        marginTop: 2,
    },
    newEmptyEventsContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    newEmptyEventsText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 12,
    },
    newEmptyEventsSubtext: {
        fontSize: 14,
        marginTop: 4,
        textAlign: 'center',
    },

    // Personal Info Styles
    personalInfoRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 8,
        marginBottom: 12,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    infoText: {
        fontSize: 14,
    },
    interestsContainer: {
        marginTop: 16,
    },
    interestsTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    interestsTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    interestTag: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    interestTagText: {
        fontSize: 12,
        fontWeight: '500',
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
        paddingTop: 0,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        paddingTop: 60,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
    },
    modalCloseButton: {
        padding: 8,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    friendInfo: {
        flex: 1,
        marginLeft: 12,
    },
    friendName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    friendLocation: {
        fontSize: 14,
    },
    groupIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyListContainer: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyListTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 16,
        textAlign: 'center',
    },
    emptyListSubtitle: {
        fontSize: 16,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 22,
    },

    // Loading Events Styles
    loadingEventsContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    loadingEventsText: {
        fontSize: 14,
        fontStyle: 'italic',
    },
});

export default UserProfile;
