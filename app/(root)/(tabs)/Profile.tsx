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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNPickerSelect from 'react-native-picker-select';
import icons from '@/constants/icons';
import images from '@/constants/images';
import { getCurrentUser, logout } from '@/lib/appwrite/appwrite';
import { getAllUsers, getUserProfile, updateUserProfile, getFriends } from '@/lib/api/user';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useGlobalContext } from '@/lib/global-provider';


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
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [userId, setUserId] = useState('');
  const [friends, setFriends] = useState<UserProfile[]>([]);

  const handleInterestToggle = (interest: string) => {
    setSelectedEventTypes((prev) =>
      prev.includes(interest)
        ? prev.filter((item) => item !== interest)
        : [...prev, interest]
    );
  };

  // Fetch current user and profile on mount
  const loadUser = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      setUserId(user.$id);
      const profile = await getUserProfile(user.$id);
      if (profile) {
        setName(profile.name || '');
        setIsPrivate(!profile.isPublic);
        setSelectedEventTypes(profile.preferences || []);
      }
      const userFriends = await getFriends(user.$id);
      setFriends(userFriends);
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
    const newFriendProfile = await getUserProfile(friendId);
    if (newFriendProfile) {
      setFriends([...friends, newFriendProfile]);
    }
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
  setFriends(friends.filter((friend) => friend.$id !== friendId));
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
    const mergedFriends = Array.from(new Set([...latestFriends, ...friends.map(f => f.$id)]));

    await updateUserProfile({
      $id: userId,
      name,
      email: latestProfile.email,
      isPublic: !isPrivate,
      preferences: selectedEventTypes,
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
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-5 pt-5 flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center">
            <Image source={images.avatar} className="w-12 h-12 rounded-full" />
            <View className="ml-3">
              <Text className="text-base font-rubik-medium text-gray-600">Hello,</Text>
              <Text className="text-xl font-rubik-semibold text-gray-900">{name || 'User'}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={toggleEditing}>
            <Image
              source={isEditing ? icons.check : icons.edit}
              className="w-7 h-7"
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Profile Details */}
        <ScrollView className="flex-1">
          {/* Name */}
          <View className="mb-6">
            <Text className="text-lg font-rubik-semibold mb-2">Name</Text>
            {isEditing ? (
              <TextInput
                className="border border-gray-300 p-3 rounded-lg text-base font-rubik"
                value={name}
                onChangeText={setName}
              />
            ) : (
              <Text className="text-base font-rubik text-gray-800">{name}</Text>
            )}
          </View>

          {/* Privacy Toggle */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-lg font-rubik-semibold">Profile Privacy</Text>
            <View className="flex-row items-center space-x-2">
              <Text className="text-base font-rubik text-gray-800">{isPrivate ? 'Private' : 'Public'}</Text>
              <Switch value={isPrivate} onValueChange={setIsPrivate} />
            </View>
          </View>

          {/* Event Type Dropdown */}
          <View className="mb-6">
            <Text className="text-lg font-rubik-semibold mb-2">Event Interests</Text>
            {isEditing ? (
              <View className="flex-row flex-wrap">
                {eventTypeOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    className={`px-4 py-2 rounded-full border mb-2 mr-2 ${
                      selectedEventTypes.includes(option.value)
                        ? 'bg-primary-300 border-primary-300'
                        : 'bg-gray-100 border-gray-300'
                    }`}
                    onPress={() => handleInterestToggle(option.value)}
                  >
                    <Text
                      className={`text-base font-rubik-medium ${
                        selectedEventTypes.includes(option.value) ? 'text-white' : 'text-gray-800'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text className="text-base font-rubik text-gray-800">
                {selectedEventTypes.length > 0
                  ? selectedEventTypes.map(value => eventTypeOptions.find(opt => opt.value === value)?.label).join(', ')
                  : 'None selected'}
              </Text>
            )}
          </View>

          {/* Friends List */}
          <View className="mb-6">
            <Text className="text-lg font-rubik-semibold mb-2">Friends</Text>
            {friends.length === 0 ? (
              <Text className="text-gray-500 text-center font-rubik">No friends yet.</Text>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.$id}
                renderItem={({ item }) => (
                  <View className="flex-row items-center justify-between bg-white p-3 rounded-lg shadow-sm mb-3 border border-gray-100">
                    <View className="flex-row items-center">
                      <Image source={images.avatar} className="w-10 h-10 rounded-full mr-3" />
                      <Text className="text-base font-rubik-medium text-gray-800">{item.name}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveFriend(item.$id)}
                      className="bg-red-500 px-4 py-2 rounded-full shadow-sm"
                    >
                      <Text className="text-white font-rubik-medium text-sm">Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-red-500 px-4 py-3 rounded-lg items-center shadow-sm mt-4"
          >
            <Text className="text-white text-lg font-rubik-semibold">Log Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default Profile;
