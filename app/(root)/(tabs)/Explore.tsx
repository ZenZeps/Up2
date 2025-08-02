import { enrichEventsWithGroupNames } from '@/lib/api/event';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getAllUsers, getUserProfile, getUsersByIds, updateUserProfile } from '@/lib/api/user';
import { config, databases, getCurrentUser } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { ID, Query } from 'react-native-appwrite';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';
import { useEvents } from '../context/EventContext';

const Explore = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { events, refetchEvents } = useEvents();

  // State variables
  const [query, setQuery] = useState(''); // Search query
  const [users, setUsers] = useState<any[]>([]); // All users except current
  const [mode, setMode] = useState<'events' | 'users' | 'groups'>('events'); // 'events', 'users', or 'groups' - default to events

  const [loading, setLoading] = useState(true); // Loading state
  const [userId, setUserId] = useState(''); // Current user ID
  const [friends, setFriends] = useState<string[]>([]); // Current user's friends
  const [profile, setProfile] = useState<any>(null); // Current user's profile
  const [currentUserPhotoUrl, setCurrentUserPhotoUrl] = useState<string | null>(null); // Current user's profile photo
  const [userPhotoUrls, setUserPhotoUrls] = useState<Record<string, string | null>>({}); // All users' profile photos
  const [requestedUsers, setRequestedUsers] = useState<string[]>([]); // Users who have sent friend requests
  const [eventsWithCreatorNames, setEventsWithCreatorNames] = useState<any[]>([]);

  // Fetch current user, profile, and all users on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user and their profile
        const currentUser = await getCurrentUser();  // Gets the current user from Appwrite
        if (!currentUser?.$id) {
          console.error('No current user found');
          return;
        }

        setUserId(currentUser.$id); // Function to define the currentUser statd with information form Appwrite
        const userProfile = await getUserProfile(currentUser.$id); // Fetches the user profile for the specified user from Appwrite
        setProfile(userProfile); // Sets the profile state to the found user profile
        setFriends(userProfile?.friends ?? []); // Sets the friends state to the users friend list attribute

        // Get current user's profile photo
        const currentUserPhoto = await getUserProfilePhotoUrl(currentUser.$id);
        setCurrentUserPhotoUrl(currentUserPhoto);

        // Get all users except current user
        const userRes = await getAllUsers();
        const otherUsers = (userRes || []).filter((u: any) => u.$id !== currentUser.$id);
        setUsers(otherUsers);

        // Get profile photos for all users
        const photoUrls: Record<string, string | null> = {};
        for (const user of otherUsers) {
          try {
            const photoUrl = await getUserProfilePhotoUrl(user.$id);
            photoUrls[user.$id] = photoUrl;
          } catch (error) {
            console.error(`Error fetching photo for user ${user.$id}:`, error);
            photoUrls[user.$id] = null;
          }
        }
        setUserPhotoUrls(photoUrls);

        // Get pending friend requests sent by the current user
        const requestsRes = await databases.listDocuments(
          config.databaseID!,
          config.friendRequestsCollectionID,
          [
            Query.equal('from', currentUser.$id),
            Query.equal('status', 'pending'),
          ]
        );
        setRequestedUsers(requestsRes.documents.map((req) => req.to));

      } catch (err) {
        console.error('Explore fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    refetchEvents(); // Fetch latest events on mount
  }, []);

  useEffect(() => {
    const addCreatorNames = async () => {
      // Filter events: only upcoming and accessible events
      const now = new Date();
      const filteredEvents = events.filter(event => {
        // Filter out past events
        if (new Date(event.endTime) <= now) return false;

        // If event is private, only show if user has access
        if (event.isPrivate) {
          return event.creatorId === userId || // User is creator
            (event.inviteeIds && event.inviteeIds.includes(userId)) || // User is invited
            (event.attendees && event.attendees.includes(userId)); // User is attending
        }

        // Show all public events
        return true;
      });

      // Enrich events with group names
      const eventsWithGroupNames = await enrichEventsWithGroupNames(filteredEvents);

      const uniqueCreatorIds = [...new Set(eventsWithGroupNames.map(event => event.creatorId))];
      const creatorProfiles = await getUsersByIds(uniqueCreatorIds);
      const creatorMap = new Map(creatorProfiles.map(profile => [profile.$id, userDisplayUtils.getFullName(profile)]));

      const eventsWithNames = eventsWithGroupNames.map(event => ({
        ...event,
        creatorName: creatorMap.get(event.creatorId) || 'Unknown Creator',
      }));
      setEventsWithCreatorNames(eventsWithNames);
    };

    if (events.length > 0) {
      addCreatorNames();
    }
  }, [events, userId]);

  const openInMaps = (location: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    Linking.openURL(url);
  };

  // Send a friend request to another user
  const handleSendFriendRequest = useCallback(async (toUserId: string) => {
    try {
      const requestId = ID.unique();
      await databases.createDocument(
        config.databaseID!,
        config.friendRequestsCollectionID,
        requestId,
        {
          id: requestId,
          from: userId,
          to: toUserId,
          status: 'pending',
        }
      );
      setRequestedUsers((prev) => [...prev, toUserId]); // Update state
    } catch (err) {
      console.error('Friend request error:', err);
      Alert.alert('Error', 'Failed to send friend request');
    }
  }, [userId]);

  const handleDeleteFriend = async (friendId: string) => {
    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: async () => {
            try {
              // Optimistically update the UI
              setFriends((prev) => prev.filter((id) => id !== friendId));

              // Update current user's friend list
              const updatedUserFriends = friends.filter((id) => id !== friendId);
              if (profile) {
                await updateUserProfile({
                  ...profile,
                  friends: updatedUserFriends
                });
              }

              // Update friend's friend list
              const friendProfile = await getUserProfile(friendId);
              if (friendProfile) {
                const updatedFriendFriends = (friendProfile.friends || []).filter(
                  (id: string) => id !== userId
                );
                await updateUserProfile({
                  ...friendProfile,
                  friends: updatedFriendFriends
                });
              }

            } catch (err) {
              console.error('Delete friend error:', err);
              Alert.alert('Error', 'Failed to remove friend');
              // Revert the UI update if the API call fails
              setFriends((prev) => [...prev, friendId]);
            }
          },
        },
      ]
    );
  };

  const handleCancelFriendRequest = async (toUserId: string) => {
    try {
      // Find the friend request document
      const response = await databases.listDocuments(
        config.databaseID!,
        config.friendRequestsCollectionID,
        [
          Query.equal('from', userId),
          Query.equal('to', toUserId),
        ]
      );

      if (response.documents.length > 0) {
        const requestId = response.documents[0].$id;
        await databases.deleteDocument(
          config.databaseID!,
          config.friendRequestsCollectionID,
          requestId
        );
        setRequestedUsers((prev) => prev.filter((id) => id !== toUserId)); // Update state
      }
    } catch (err) {
      console.error('Cancel friend request error:', err);
      Alert.alert('Error', 'Failed to cancel friend request');
    }
  };

  const filteredUsers = useMemo(() => {
    return users
      .filter((u) =>
        userDisplayUtils.getSearchableText(u).includes(query.toLowerCase())
      )
      .sort((a, b) => {
        const nameA = userDisplayUtils.getFullName(a).toLowerCase();
        const nameB = userDisplayUtils.getFullName(b).toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [query, users]);

  const filteredEvents = useMemo(() => {
    return eventsWithCreatorNames.filter(
      (e) =>
        e.title?.toLowerCase().includes(query.toLowerCase()) ||
        e.location?.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, eventsWithCreatorNames]);

  // Handler for attending an event (not used in UI here, but available)
  const handleAttendEvent = async (event: any) => {
    if (!event.inviteeIds?.includes(userId)) {
      try {
        const updatedInviteeIds = [...(event.inviteeIds || []), userId];
        await databases.updateDocument(
          config.databaseID!,
          config.eventsCollectionID!,
          event.$id || event.id,
          {
            ...event,
            inviteeIds: updatedInviteeIds,
          }
        );
        // Correct: refetch events from the server
        await refetchEvents();
        Alert.alert('Success', 'You are now attending this event!');
      } catch (err) {
        console.error('Attend event error:', err);
        Alert.alert('Error', 'Failed to attend event');
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Enhanced Header with Black Gradient */}
        <View style={styles.header}>
          <LinearGradient
            colors={['#000000', '#1a1a1a', '#2d2d2d']}
            start={[0, 0]}
            end={[1, 1]}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.profileSection}>
                <UserAvatar
                  photoUrl={currentUserPhotoUrl}
                  firstName={profile?.firstName}
                  lastName={profile?.lastName}
                  name={userDisplayUtils.getFullName(profile, 'User')}
                  size={48}
                />
                <View style={styles.welcomeSection}>
                  <Text style={styles.welcomeText}>Welcome back,</Text>
                  <Text style={styles.headerUserName}>{userDisplayUtils.getFullName(profile, 'User')}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 70 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Mode Selection Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleContainer}>
                <MaterialIcons name="explore" size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Explore</Text>
              </View>
            </View>
            <View style={styles.modeToggle}>
              <TouchableOpacity
                onPress={() => setMode('events')}
                style={[
                  styles.modeButton,
                  {
                    backgroundColor: mode === 'events' ? colors.primary : colors.background,
                    borderColor: colors.border,
                  }
                ]}
              >
                <MaterialIcons
                  name="event"
                  size={18}
                  color={mode === 'events' ? 'white' : colors.text}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    { color: mode === 'events' ? 'white' : colors.text }
                  ]}
                >
                  Events
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode('users')}
                style={[
                  styles.modeButton,
                  {
                    backgroundColor: mode === 'users' ? colors.primary : colors.background,
                    borderColor: colors.border,
                  }
                ]}
              >
                <MaterialIcons
                  name="people"
                  size={18}
                  color={mode === 'users' ? 'white' : colors.text}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    { color: mode === 'users' ? 'white' : colors.text }
                  ]}
                >
                  Users
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode('groups')}
                style={[
                  styles.modeButton,
                  {
                    backgroundColor: mode === 'groups' ? colors.primary : colors.background,
                    borderColor: colors.border,
                  }
                ]}
              >
                <MaterialIcons
                  name="group"
                  size={18}
                  color={mode === 'groups' ? 'white' : colors.text}
                />
                <Text
                  style={[
                    styles.modeButtonText,
                    { color: mode === 'groups' ? 'white' : colors.text }
                  ]}
                >
                  Groups
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                placeholder={`Search ${mode}...`}
                value={query}
                onChangeText={setQuery}
                style={[styles.searchInput, { color: colors.text }]}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          {/* Content based on mode */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : mode === 'users' ? (
            query.trim() ? (
              filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const isFriend = friends.includes(user.$id);
                  return (
                    <View key={user.$id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <TouchableOpacity
                        onPress={() => router.push(`/(root)/UserProfile/${user.$id}` as any)}
                        style={styles.userItem}
                      >
                        <View style={styles.userInfo}>
                          <UserAvatar
                            photoUrl={userPhotoUrls[user.$id]}
                            firstName={user.firstName}
                            lastName={user.lastName}
                            name={userDisplayUtils.getFullName(user)}
                            size={56}
                          />
                          <View style={styles.userDetails}>
                            <Text style={[styles.userName, { color: isFriend ? colors.primary : colors.text }]}>
                              {userDisplayUtils.getFullName(user)}
                            </Text>
                            <Text style={[styles.userBio, { color: colors.textSecondary }]} numberOfLines={1}>
                              {user.bio || 'No bio available'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.userActions}>
                          {isFriend ? (
                            <TouchableOpacity
                              onPress={() => handleDeleteFriend(user.$id)}
                              style={[styles.actionButton, { backgroundColor: colors.textSecondary }]}
                            >
                              <MaterialIcons name="person-remove" size={16} color={colors.background} />
                              <Text style={[styles.actionButtonText, { color: colors.background }]}>
                                Remove
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              onPress={() => {
                                if (requestedUsers.includes(user.$id)) {
                                  handleCancelFriendRequest(user.$id);
                                } else {
                                  handleSendFriendRequest(user.$id);
                                }
                              }}
                              style={[
                                styles.actionButton,
                                {
                                  backgroundColor: requestedUsers.includes(user.$id) ? colors.background : colors.primary,
                                  borderWidth: requestedUsers.includes(user.$id) ? 1 : 0,
                                  borderColor: colors.border,
                                }
                              ]}
                            >
                              <MaterialIcons
                                name={requestedUsers.includes(user.$id) ? "hourglass-empty" : "person-add"}
                                size={16}
                                color={requestedUsers.includes(user.$id) ? colors.text : 'white'}
                              />
                              <Text
                                style={[
                                  styles.actionButtonText,
                                  {
                                    color: requestedUsers.includes(user.$id) ? colors.text : 'white'
                                  }
                                ]}
                              >
                                {requestedUsers.includes(user.$id) ? 'Pending' : 'Add'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })
              ) : (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.emptyState}>
                    <MaterialIcons name="person-search" size={48} color={colors.textSecondary} />
                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No users found</Text>
                  </View>
                </View>
              )
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.emptyState}>
                  <MaterialIcons name="people" size={48} color={colors.primary} />
                  <Text style={[styles.eventTitle, { color: colors.text, textAlign: 'center', marginTop: 16 }]}>
                    Find Friends
                  </Text>
                  <Text style={[styles.eventDescription, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>
                    Use the search bar above to discover and connect with other users in your community
                  </Text>
                </View>
              </View>
            )
          ) : mode === 'events' ? (
            filteredEvents.length > 0 ? (
              filteredEvents.map((event) => (
                <View key={event.$id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TouchableOpacity
                    onPress={() => router.push(`/event/${event.$id}`)}
                    style={styles.eventItem}
                  >
                    <Text style={[styles.eventTitle, { color: colors.text }]}>
                      {event.title}
                    </Text>
                    <View style={styles.eventDetails}>
                      <View style={styles.eventDetailRow}>
                        <MaterialIcons name="person" size={16} color={colors.primary} />
                        <Text style={[styles.eventDetailText, { color: colors.textSecondary }]}>
                          {event.creatorName}
                        </Text>
                      </View>
                      {event.groupName && (
                        <View style={styles.eventDetailRow}>
                          <MaterialIcons name="group" size={16} color={colors.primary} />
                          <Text style={[styles.eventDetailText, { color: colors.primary }]}>
                            {event.groupName}
                          </Text>
                        </View>
                      )}
                      <View style={styles.eventDetailRow}>
                        <MaterialIcons name="location-on" size={16} color={colors.primary} />
                        <TouchableOpacity onPress={() => openInMaps(event.location)}>
                          <Text style={[styles.eventDetailText, { color: '#000000', textDecorationLine: 'underline' }]}>
                            {event.location}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.eventDetailRow}>
                        <MaterialIcons name="access-time" size={16} color={colors.primary} />
                        <Text style={[styles.eventDetailText, { color: colors.textSecondary }]}>
                          {dayjs(event.startTime).format('MMM D, YYYY h:mm A')} - {dayjs(event.endTime).format('h:mm A')}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.eventDescription, { color: colors.text }]} numberOfLines={2}>
                      {event.description}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.emptyState}>
                  <MaterialIcons name="event" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No events found</Text>
                </View>
              </View>
            )
          ) : (
            // Groups mode
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.emptyState}>
                <MaterialIcons name="group-add" size={48} color={colors.primary} />
                <Text style={[styles.eventTitle, { color: colors.text, textAlign: 'center', marginTop: 16 }]}>
                  Create Groups
                </Text>
                <Text style={[styles.eventDescription, { color: colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 16 }]}>
                  Start your own group and bring together people who share your interests and passions
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/CreateGroup')}
                  style={[styles.actionButton, { backgroundColor: '#000000' }]}
                >
                  <MaterialIcons name="add" size={16} color="white" />
                  <Text style={[styles.actionButtonText, { color: 'white' }]}>Create Group</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcomeSection: {
    marginLeft: 12,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    opacity: 0.8,
  },
  headerUserName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
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
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 2,
    borderWidth: 1,
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    fontFamily: 'Rubik-Regular',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetails: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  userBio: {
    fontSize: 14,
    marginTop: 2,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupAvatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  groupAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
  },
  groupDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  eventItem: {
    paddingVertical: 4,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventDetails: {
    marginBottom: 8,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventDetailText: {
    fontSize: 14,
    marginLeft: 8,
  },
  eventDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default Explore;