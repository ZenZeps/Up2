import icons from '@/constants/icons';
import images from '@/constants/images';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getAllUsers, getUserProfile, getUsersByIds, updateUserProfile } from '@/lib/api/user';
import { config, databases, getCurrentUser } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import dayjs from 'dayjs';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { ID, Query } from 'react-native-appwrite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEvents } from '../context/EventContext';

const Explore = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const { events, refetchEvents } = useEvents();

  // State variables
  const [query, setQuery] = useState(''); // Search query
  const [users, setUsers] = useState<any[]>([]); // All users except current
  const [mode, setMode] = useState<'events' | 'users'>('users'); // 'events' or 'users'

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
      const uniqueCreatorIds = [...new Set(events.map(event => event.creatorId))];
      const creatorProfiles = await getUsersByIds(uniqueCreatorIds);
      const creatorMap = new Map(creatorProfiles.map(profile => [profile.$id, userDisplayUtils.getFullName(profile)]));

      const eventsWithNames = events.map(event => ({
        ...event,
        creatorName: creatorMap.get(event.creatorId) || 'Unknown Creator',
      }));
      setEventsWithCreatorNames(eventsWithNames);
    };

    if (events.length > 0) {
      addCreatorNames();
    }
  }, [events]);

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
    return users.filter((u) =>
      userDisplayUtils.getSearchableText(u).includes(query.toLowerCase())
    );
  }, [query, users]);

  const filteredEvents = useMemo(() => {
    return eventsWithCreatorNames.filter(
      (e) =>
        e.title?.toLowerCase().includes(query.toLowerCase()) ||
        e.location?.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, eventsWithCreatorNames]);

  // Check if the user has any pending event invites
  const hasInvites = events.some(
    (event) =>
      userId &&
      event.inviteeIds.includes(userId) &&
      event.creatorId !== userId
  );

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
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-5 pt-5 flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center">
            <Image
              source={currentUserPhotoUrl ? { uri: currentUserPhotoUrl } : images.avatar}
              className="w-12 h-12 rounded-full"
            />
            <View className="ml-3">
              <Text className="text-base font-rubik-medium" style={{ color: colors.textSecondary }}>Welcome back,</Text>
              <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>{userDisplayUtils.getFullName(profile, 'User')}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/Invites')} className="relative">
            <Image
              source={icons.bell}
              className="w-7 h-7"
              style={{ tintColor: hasInvites ? '#FF3B30' : colors.text }}
            />
            {hasInvites && (
              <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3 items-center justify-center">
                <Text className="text-white text-xs"></Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Toggle Buttons */}
        <View className="flex-row mb-6">
          <TouchableOpacity
            onPress={() => setMode('users')}
            className="flex-1 items-center py-3 rounded-lg mx-1"
            style={{
              backgroundColor: mode === 'users' ? colors.primary : colors.surface
            }}
          >
            <Text
              className="text-lg font-rubik-medium"
              style={{
                color: mode === 'users' ? colors.background : colors.text
              }}
            >
              Users
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode('events')}
            className="flex-1 items-center py-3 rounded-lg mx-1"
            style={{
              backgroundColor: mode === 'events' ? colors.primary : colors.surface
            }}
          >
            <Text
              className="text-lg font-rubik-medium"
              style={{
                color: mode === 'events' ? colors.background : colors.text
              }}
            >
              Events
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center rounded-xl px-4 py-3 mb-6 border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <Image source={icons.search} className="w-5 h-5 mr-3" resizeMode="contain" style={{ tintColor: colors.textSecondary }} />
          <TextInput
            placeholder={`Search ${mode}...`}
            value={query}
            onChangeText={setQuery}
            className="flex-1 text-base font-rubik"
            style={{ color: colors.text }}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Main content: Users or Events list */}
        <ScrollView className="flex-1">
          {loading ? (
            <ActivityIndicator size="large" color="#0061FF" className="mt-10" />
          ) : mode === 'users' ? (
            filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const isFriend = friends.includes(user.$id);
                return (
                  <View
                    key={user.$id}
                    className="flex-row items-center justify-between p-4 rounded-lg shadow-sm mb-3 border"
                    style={{ backgroundColor: colors.card, borderColor: colors.border }}
                  >
                    <TouchableOpacity
                      className="flex-row items-center flex-1 mr-2"
                      onPress={() => isFriend ? router.push(`/Calendar/${user.$id}`) : null}
                    >
                      <Image
                        source={userPhotoUrls[user.$id] ? { uri: userPhotoUrls[user.$id] } : images.avatar}
                        className="w-10 h-10 rounded-full mr-3"
                      />
                      <Text
                        className="text-lg font-rubik-medium"
                        style={{ color: isFriend ? colors.primary : colors.text }}
                      >
                        {userDisplayUtils.getFullName(user)}
                      </Text>
                    </TouchableOpacity>
                    {isFriend ? (
                      <TouchableOpacity
                        onPress={() => handleDeleteFriend(user.$id)}
                        className="px-4 py-2 rounded-full shadow-sm"
                        style={{ backgroundColor: colors.error }}
                      >
                        <Text className="font-rubik-medium text-sm" style={{ color: colors.background }}>Remove</Text>
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
                        className="px-4 py-2 rounded-full shadow-sm"
                        style={{
                          backgroundColor: requestedUsers.includes(user.$id) ? colors.secondary : colors.primary
                        }}
                      >
                        <Text
                          className="font-rubik-medium text-sm"
                          style={{
                            color: requestedUsers.includes(user.$id) ? colors.text : colors.background
                          }}
                        >
                          {requestedUsers.includes(user.$id) ? 'Requested' : 'Add'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            ) : (
              <Text className="mt-4 text-center font-rubik" style={{ color: colors.textSecondary }}>No users found</Text>
            )
          ) : filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <TouchableOpacity
                key={event.$id}
                className="p-4 rounded-lg shadow-sm mb-3 border"
                style={{ backgroundColor: colors.card, borderColor: colors.border }}
                onPress={() => router.push(`/event/${event.$id}`)}
              >
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-lg font-rubik-semibold" style={{ color: colors.text }}>{event.title}</Text>
                  <Text className="text-xs font-rubik" style={{ color: colors.textSecondary }}>{event.creatorName}</Text>
                </View>
                <Text className="text-sm font-rubik" style={{ color: colors.textSecondary }}>
                  <TouchableOpacity onPress={() => openInMaps(event.location)}>
                    <Text className="underline" style={{ color: colors.primary }}>{event.location}</Text>
                  </TouchableOpacity>
                </Text>
                <Text className="text-xs font-rubik mt-1" style={{ color: colors.textSecondary }}>
                  {dayjs(event.startTime).format('MMM D, YYYY h:mm A')} - {dayjs(event.endTime).format('h:mm A')}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text className="mt-4 text-center font-rubik" style={{ color: colors.textSecondary }}>No events found</Text>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default Explore;