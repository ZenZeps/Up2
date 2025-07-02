import { useEffect, useState } from 'react';
import {
  TextInput,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Button,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import images from '@/constants/images';
import icons from '@/constants/icons';
import { getAllUsers, getUserProfile, updateUserProfile } from '@/lib/api/user';
import { getAllEvents } from '@/lib/api/event';
import { getCurrentUser, databases, config } from '@/lib/appwrite/appwrite';
import { useEvents } from '../context/EventContext';
import { ID } from 'react-native-appwrite';
import dayjs from 'dayjs';

const Explore = () => {
  const router = useRouter();
  const { events, refetchEvents } = useEvents();

  // State variables
  const [query, setQuery] = useState(''); // Search query
  const [users, setUsers] = useState<any[]>([]); // All users except current
  const [mode, setMode] = useState<'events' | 'users'>('events'); // 'events' or 'users'
  
  const [loading, setLoading] = useState(true); // Loading state
  const [userId, setUserId] = useState(''); // Current user ID
  const [friends, setFriends] = useState<string[]>([]); // Current user's friends
  const [profile, setProfile] = useState<any>(null); // Current user's profile

  // Fetch current user, profile, and all users on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user and their profile
        const currentUser = await getCurrentUser();
        setUserId(currentUser?.$id);
        const userProfile = await getUserProfile(currentUser?.$id);
        setProfile(userProfile);
        setFriends(userProfile?.friends ?? []);

        // Get all users except current user
        const userRes = await getAllUsers();
        setUsers((userRes || []).filter((u: any) => u.$id !== currentUser?.$id));
      } catch (err) {
        console.error('Explore fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    refetchEvents(); // Fetch latest events on mount
  }, []);

  // Send a friend request to another user
  const handleSendFriendRequest = async (toUserId: string) => {
    try {
      const requestId = ID.unique();
      await databases.createDocument(
        config.databaseID!,
        config.friendRequestsCollectionID,
        requestId,
        {
          id: requestId, // Document ID
          from: userId,  // Sender's user ID
          to: toUserId,  // Recipient's user ID
          status: 'pending',
        }
      );
      Alert.alert('Friend request sent!');
    } catch (err) {
      console.error('Friend request error:', err);
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  // Filter users by search query (case-insensitive)
  const filteredUsers = users.filter((u) =>
    u.name?.toLowerCase().includes(query.toLowerCase())
  );

  // Filter events by search query (title or location)
  const filteredEvents = events.filter(
    (e) =>
      e.title?.toLowerCase().includes(query.toLowerCase()) ||
      e.location?.toLowerCase().includes(query.toLowerCase())
  );

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
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-5 pt-5 flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center">
            <Image source={images.avatar} className="w-12 h-12 rounded-full" />
            <View className="ml-3">
              <Text className="text-base font-rubik-medium text-gray-600">Welcome back,</Text>
              <Text className="text-xl font-rubik-semibold text-gray-900">{profile?.name || 'User'}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/Invites')} className="relative">
            <Image
              source={icons.bell}
              className="w-7 h-7"
              style={{ tintColor: hasInvites ? '#FF3B30' : '#666876' }}
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
            className={`flex-1 items-center py-3 rounded-lg mx-1 ${
              mode === 'users' ? 'bg-primary-300' : 'bg-gray-100'
            }`}
          >
            <Text
              className={`text-lg font-rubik-medium ${
                mode === 'users' ? 'text-white' : 'text-gray-700'
              }`}
            >
              Users
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode('events')}
            className={`flex-1 items-center py-3 rounded-lg mx-1 ${
              mode === 'events' ? 'bg-primary-300' : 'bg-gray-100'
            }`}
          >
            <Text
              className={`text-lg font-rubik-medium ${
                mode === 'events' ? 'text-white' : 'text-gray-700'
              }`}
            >
              Events
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mb-6 border border-gray-200">
          <Image source={icons.search} className="w-5 h-5 mr-3" resizeMode="contain" tintColor="#888" />
          <TextInput
            placeholder={`Search ${mode}...`}
            value={query}
            onChangeText={setQuery}
            className="flex-1 text-base font-rubik text-gray-800"
            placeholderTextColor="#888"
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
                  <View key={user.$id} className="flex-row items-center justify-between bg-white p-4 rounded-lg shadow-sm mb-3 border border-gray-100">
                    <View className="flex-row items-center">
                      <Image source={images.avatar} className="w-10 h-10 rounded-full mr-3" />
                      <Text className="text-lg font-rubik-medium text-gray-800">{user.name}</Text>
                    </View>
                    {!isFriend && (
                      <TouchableOpacity
                        onPress={() => handleSendFriendRequest(user.$id)}
                        className="bg-green-500 px-4 py-2 rounded-full shadow-sm"
                      >
                        <Text className="text-white font-rubik-medium text-sm">Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            ) : (
              <Text className="text-gray-500 mt-4 text-center font-rubik">No users found</Text>
            )
          ) : filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <TouchableOpacity
                key={event.$id}
                className="bg-white p-4 rounded-lg shadow-sm mb-3 border border-gray-100"
                onPress={() => router.push(`/event/${event.$id}`)}
              >
                <Text className="text-lg font-rubik-semibold text-gray-900 mb-1">{event.title}</Text>
                <Text className="text-sm font-rubik text-gray-600">{event.location}</Text>
                <Text className="text-xs font-rubik text-gray-500 mt-1">
                  {dayjs(event.startTime).format('MMM D, YYYY h:mm A')} - {dayjs(event.endTime).format('h:mm A')}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text className="text-gray-500 mt-4 text-center font-rubik">No events found</Text>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default Explore;