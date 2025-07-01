import React, { useEffect, useState, useCallback } from 'react';
import {
  Text,
  View,
  Image,
  TextInput,
  FlatList,
  TouchableOpacity,
  Switch,
  Alert,
  Button,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native-gesture-handler';
import RNPickerSelect from 'react-native-picker-select';
import icons from '@/constants/icons';
import images from '@/constants/images';
import { getCurrentUser, logout } from '@/lib/appwrite/appwrite';
import { getAllUsers, getUserProfile, updateUserProfile, getFriends } from '@/lib/api/user';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';


const eventTypeOptions = [
  { label: 'Sports', value: 'sports' },
  { label: 'Party', value: 'party' },
  { label: 'Study', value: 'study' },
  { label: 'Family', value: 'family' },
];

const mockFriends = ['Alice', 'Bob', 'Charlie', 'Diana'];

const Profile = () => {
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [eventType, setEventType] = useState('sports');
  const [userId, setUserId] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [friends, setFriends] = useState<string[]>([]);

  // Fetch current user and profile on mount
  const loadUser = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      setUserId(user.$id);
      const profile = await getUserProfile(user.$id);
      if (profile) {
        setName(profile.name || '');
        setIsPrivate(!profile.isPublic);
        setEventType(profile.preferences?.[0] || 'sports');
      }
      // Fetch all users except current user
      const users = await getAllUsers();
      setAllUsers(users.filter((u: any) => u.$id !== user.$id));

      // Fetch friends using the new getFriends function
      const userFriends = await getFriends(user.$id);
      setFriends(userFriends.map(friend => friend.$id));
    } catch (err) {
      console.error('Failed to load profile:', err);
      Alert.alert('Error', 'Failed to load profile');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser])
  );

  const handleAddFriend = async (friendId: string) => {
    // Fetch the latest profile before updating
    const latestProfile = await getUserProfile(userId);
    if (!latestProfile) return; // Handle case where profile is null
    const updatedFriends = Array.from(new Set([...(latestProfile?.friends ?? []), friendId]));
    setFriends(updatedFriends);
    await updateUserProfile({
      $id: userId,
      name: latestProfile.name,
      email: latestProfile.email,
      isPublic: latestProfile.isPublic,
      preferences: latestProfile.preferences,
      friends: updatedFriends,
    });
    console.log('Updated user profile:', userId, updatedFriends);
  };

const handleRemoveFriend = async (friendId: string) => {
  // Fetch the latest profile before updating
  const latestProfile = await getUserProfile(userId);
  if (!latestProfile) return; // Handle case where profile is null
  const updatedFriends = (latestProfile?.friends ?? []).filter((id) => id !== friendId);
  setFriends(updatedFriends);
  await updateUserProfile({
    $id: userId,
    name: latestProfile.name,
    email: latestProfile.email,
    isPublic: latestProfile.isPublic,
    preferences: latestProfile.preferences,
    friends: updatedFriends,
  });
};

const handleSave = async () => {
  try {
    const latestProfile = await getUserProfile(userId);
    if (!latestProfile) return; // Handle case where profile is null

    const latestFriends = latestProfile.friends ?? [];
    const mergedFriends = Array.from(new Set([...latestFriends, ...friends]));

    await updateUserProfile({
      $id: userId,
      name,
      email: latestProfile.email,
      isPublic: !isPrivate,
      preferences: [eventType],
      friends: mergedFriends, // 👈 Use merged list
    });

    setFriends(mergedFriends); // Optional: update local state
    setIsEditing(false);
    Alert.alert('Success', 'Profile updated');
  } catch (err) {
    console.error('Update failed:', err);
    Alert.alert('Error', 'Failed to update profile');
  }
};


  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/SignIn');
    } catch (err) {
      console.error('Logout failed:', err);
      Alert.alert('Error', 'Failed to log out');
    }
  };

  const toggleEditing = () => {
    if (isEditing) {
      handleSave();
    } else {
      setIsEditing(true);
    }
  };

  return (
    <SafeAreaView className="bg-white h-full px-7 pb-32">
      <View>
        <View className="flex flex-row items-center justify-between mt-5">
          <Text className="text-xl font-rubik-semibold">Profile</Text>
          <TouchableOpacity onPress={toggleEditing}>
            <Text className="text-blue-500">{isEditing ? 'Done' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View className="flex flex-row justify-center mt-5">
          <View className="items-center mt-5">
            <Image source={images.avatar} className="size-44 rounded-full" />
          </View>
        </View>

        {/* Name */}
        <View className="mt-5">
          <Text className="text-lg font-semibold mb-1">Name</Text>
          {isEditing ? (
            <TextInput
              className="border border-gray-300 p-2 rounded"
              value={name}
              onChangeText={setName}
            />
          ) : (
            <Text>{name}</Text>
          )}
        </View>

        {/* Privacy Toggle */}
        <View className="mt-5 flex flex-row items-center justify-between">
          <Text className="text-lg font-semibold">Profile Privacy</Text>
          <View className="flex-row items-center space-x-2">
            <Text>{isPrivate ? 'Private' : 'Public'}</Text>
            <Switch value={isPrivate} onValueChange={setIsPrivate} />
          </View>
        </View>

        {/* Event Type Dropdown */}
        <View className="mt-5">
          <Text className="text-lg font-semibold mb-1">Event Interests</Text>
          {isEditing ? (
            <RNPickerSelect
              value={eventType}
              onValueChange={setEventType}
              items={eventTypeOptions}
              style={{
                inputIOS: {
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  borderColor: 'gray',
                  borderWidth: 1,
                  borderRadius: 5,
                },
                inputAndroid: { color: 'black' },
              }}
            />
          ) : (
            <Text>{eventTypeOptions.find((e) => e.value === eventType)?.label}</Text>
          )}
        </View>

        {/* Friends List */}
        <View className="mt-7">
          <Text className="text-lg font-semibold mb-2">Friends</Text>
          <FlatList
            data={allUsers.filter((user) => friends.includes(user.$id))} // Only show friends
            keyExtractor={(item) => item.$id}
            renderItem={({ item }) => (
              <View className="py-2 border-b border-gray-200 flex-row items-center justify-between">
                <Text>{item.name}</Text>
                <Button
                  title="Remove"
                  color="red"
                  onPress={() => handleRemoveFriend(item.$id)}
                />
              </View>
            )}
          />
        </View>

        {/* Logout Button */}
        <View className="mt-10">
          <Button title="Log Out" color="red" onPress={handleLogout} />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Profile;
