import { getUserGroups } from '@/lib/api/group';
import { getProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getFriends, getUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
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

            // Load friends and groups
            const [userFriends, userGroups] = await Promise.all([
                getFriends(userId),
                getUserGroups(userId)
            ]);

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

    const handleMessageUser = () => {
        // Navigate to conversation with this user
        router.push(`/(root)/Messages/${userId}` as any);
    };

    const handleViewCalendar = () => {
        try {
            console.log('Navigating to calendar for user:', userId);
            // Navigate to user's calendar page
            router.push(`/(root)/UserCalendar/${userId}` as any);
        } catch (error) {
            console.error('Error navigating to calendar:', error);
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
            {/* Enhanced Header with Gradient */}
            <View style={styles.header}>
                <LinearGradient
                    colors={['#000000', '#1a1a1a', '#2d2d2d']}
                    start={[0, 0]}
                    end={[1, 1]}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerContent}>
                        {/* Back Button */}
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={20} color="white" />
                        </TouchableOpacity>

                        {/* Profile Section */}
                        <View style={styles.profileSection}>
                            <View style={styles.avatarContainer}>
                                {profilePhotoUrl ? (
                                    <Image
                                        source={{ uri: profilePhotoUrl }}
                                        style={styles.avatar}
                                    />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <Text style={styles.avatarText}>
                                            {userDisplayUtils.getInitials({ firstName, lastName })}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.nameSection}>
                                <Text style={styles.userName}>
                                    {userDisplayUtils.getFullName({ firstName, lastName })}
                                </Text>
                                <Text style={styles.userSubtitle}>
                                    {userProfile.about ? userProfile.about.slice(0, 50) + (userProfile.about.length > 50 ? '...' : '') : 'No bio yet'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Stats Section */}
                    <View style={styles.statsSection}>
                        <TouchableOpacity style={styles.statItem}>
                            <Text style={styles.statNumber}>{stats.friends}</Text>
                            <Text style={styles.statLabel}>Friends</Text>
                        </TouchableOpacity>
                        <View style={styles.statDivider} />
                        <TouchableOpacity style={styles.statItem}>
                            <Text style={styles.statNumber}>{stats.groups}</Text>
                            <Text style={styles.statLabel}>Groups</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 70 + insets.bottom }]}
                showsVerticalScrollIndicator={false}
            >
                {/* About Section */}
                {userProfile.about && (
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardTitleContainer}>
                                <MaterialIcons name="info" size={20} color={colors.primary} />
                                <Text style={[styles.cardTitle, { color: colors.text }]}>About</Text>
                            </View>
                        </View>
                        <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
                            <Text style={[styles.contentText, { color: colors.text }]}>
                                {userProfile.about}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Personal Details Section */}
                {(userProfile.nationality || userProfile.age) && (
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardTitleContainer}>
                                <MaterialIcons name="person" size={20} color={colors.primary} />
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Personal Details</Text>
                            </View>
                        </View>
                        <View style={styles.detailsContainer}>
                            {userProfile.nationality && (
                                <View style={styles.detailRow}>
                                    <MaterialIcons name="flag" size={18} color={colors.textSecondary} />
                                    <View style={styles.detailContent}>
                                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Nationality</Text>
                                        <Text style={[styles.detailValue, { color: colors.text }]}>
                                            {userProfile.nationality}
                                        </Text>
                                    </View>
                                </View>
                            )}
                            {userProfile.age && (
                                <View style={styles.detailRow}>
                                    <MaterialIcons name="cake" size={18} color={colors.textSecondary} />
                                    <View style={styles.detailContent}>
                                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Age</Text>
                                        <Text style={[styles.detailValue, { color: colors.text }]}>
                                            {userProfile.age} years old
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                )}

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
                                    onPress={() => router.push(`/(root)/UserProfile/${item.$id}` as any)}
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
                                        {item.users?.length || 0} members
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

                {/* Calendar Action Section */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                        onPress={handleViewCalendar}
                        style={[styles.calendarButton, { backgroundColor: colors.primary }]}
                    >
                        <MaterialIcons name="calendar-today" size={20} color="white" />
                        <Text style={styles.calendarButtonText}>View Calendar</Text>
                    </TouchableOpacity>
                </View>
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
    header: {
        position: 'relative',
    },
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
    backButton: {
        padding: 4,
        marginRight: 12,
    },
    profileSection: {
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
    nameSection: {
        flex: 1,
    },
    userName: {
        fontSize: 20,
        fontWeight: '700',
        color: 'white',
        marginBottom: 4,
    },
    userSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '400',
    },
    statsSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 18,
        fontWeight: '700',
        color: 'white',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '500',
    },
    statDivider: {
        width: 1,
        height: 20,
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
});

export default UserProfile;
