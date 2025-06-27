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
import { useRouter } from 'expo-router';
import images from '@/constants/images';
import icons from '@/constants/icons';
import { getAllUsers, getUserProfile, updateUserProfile } from '@/lib/api/user';
import { getAllEvents } from '@/lib/api/event';
import { getCurrentUser, databases, config } from '@/lib/appwrite';

const Explore = () => {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [mode, setMode] = useState<'users' | 'events'>('users');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [friends, setFriends] = useState<string[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUserId(currentUser?.$id);
        const userProfile = await getUserProfile(currentUser?.$id);
        setProfile(userProfile);
        setFriends(userProfile?.friends ?? []);

        const [userRes, eventRes] = await Promise.all([
          getAllUsers(),
          getAllEvents(),
        ]);
        // Exclude current user from the list
        setUsers((userRes || []).filter((u: any) => u.id !== currentUser?.$id));
        setEvents(eventRes || []);
      } catch (err) {
        console.error('Explore fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAddFriend = async (friendId: string) => {
    const updatedFriends = [...friends, friendId];
    setFriends(updatedFriends);
    await updateUserProfile({
      ...profile,
      friends: updatedFriends,
    });
  };

  // Filter users by search query
  const filteredUsers = users.filter((u) =>
    u.name?.toLowerCase().includes(query.toLowerCase())
  );

  // Filter events by search query (by title or location)
  const filteredEvents = events.filter(
    (e) =>
      e.title?.toLowerCase().includes(query.toLowerCase()) ||
      e.location?.toLowerCase().includes(query.toLowerCase())
  );

  // Attend event handler
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
        // Update local state
        setEvents((prev) =>
          prev.map((ev) =>
            (ev.$id || ev.id) === (event.$id || event.id)
              ? { ...ev, inviteeIds: updatedInviteeIds }
              : ev
          )
        );
        Alert.alert('Success', 'You are now attending this event!');
      } catch (err) {
        console.error('Attend event error:', err);
        Alert.alert('Error', 'Failed to attend event');
      }
    }
  };

  return (
    <ScrollView className="bg-white h-full">
      <View className="px-5 mt-5">
        {/* Header */}
        <View className="flex flex-row items-center justify-between">
          <View className="flex flex-row items-center">
            <Image source={images.avatar} className="size-12 rounded-full" />
            <View className="ml-2">
              <Text className="text-lg font-semibold">Hello</Text>
              <Text className="text-sm text-gray-500">Search for something</Text>
            </View>
          </View>
          <Image source={icons.bell} className="size-6" />
        </View>

        {/* Toggle */}
        <View className="flex flex-row justify-center mt-6">
          <TouchableOpacity
            onPress={() => setMode('users')}
            className={`px-4 py-2 rounded-full ${
              mode === 'users' ? 'bg-primary-300' : 'bg-gray-200'
            }`}
          >
            <Text className="text-white font-rubik-medium">Users</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode('events')}
            className={`ml-4 px-4 py-2 rounded-full ${
              mode === 'events' ? 'bg-primary-300' : 'bg-gray-200'
            }`}
          >
            <Text className="text-white font-rubik-medium">Events</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TextInput
          placeholder={`Search ${mode}`}
          value={query}
          onChangeText={setQuery}
          className="border border-gray-300 rounded-lg px-4 py-3 mt-4 font-rubik text-black-300"
          placeholderTextColor="#aaa"
        />
        <View className="mt-6">
          {loading ? (
            <ActivityIndicator size="large" color="#888" className="mt-10" />
          ) : mode === 'users' ? (
            filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const isFriend = friends.includes(user.id);
                return (
                  <View key={user.id} className="mb-4 flex-row items-center justify-between">
                    <Text className="text-black-300 font-rubik">{user.name}</Text>
                    {!isFriend && (
                      <Button
                        title="Add"
                        color="green"
                        onPress={() => handleAddFriend(user.id)}
                      />
                    )}
                  </View>
                );
              })
            ) : (
              <Text className="text-gray-400 mt-4 text-center">No users found</Text>
            )
          ) : filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <TouchableOpacity
                key={event.$id || event.id}
                className="mb-4"
                onPress={() => router.push(`/event/${event.$id || event.id}`)}
              >
                <Text className="text-black-300 font-rubik font-semibold">
                  {event.title}
                </Text>
                <Text className="text-gray-400">{event.location}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text className="text-gray-400 mt-4 text-center">No events found</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default Explore;