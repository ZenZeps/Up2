import icons from '@/constants/icons';
import images from '@/constants/images';
import { getProfilePhotoUrl, pickProfilePhoto, uploadProfilePhoto } from '@/lib/api/profilePhoto';
import { getFriends, getUserProfile, updateUserProfile } from '@/lib/api/user';
import { logout } from '@/lib/appwrite/appwrite';
import { useGlobalContext } from '@/lib/global-provider';
import { registerForPushNotifications } from '@/lib/notifications/pushNotifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const eventTypeOptions = [
  { label: 'Sports', value: 'sports' },
  { label: 'Party', value: 'party' },
  { label: 'Study', value: 'study' },
  { label: 'Family', value: 'family' },
];

const Profile = () => {
  const router = useRouter();
  const { user, refetch } = useGlobalContext();
  const userId = user?.$id;

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [stats, setStats] = useState({
    events: 0,
    friends: 0,
    preferences: 0
  });

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) return;

      try {
        const [profile, userFriends] = await Promise.all([
          getUserProfile(userId),
          getFriends(userId)
        ]);

        if (profile) {
          setName(profile.name);
          setIsPrivate(!profile.isPublic);
          setSelectedEventTypes(profile.preferences || []);
          setFriends(userFriends || []);

          if (profile.photoId) {
            const photoUrl = await getProfilePhotoUrl(profile.photoId);
            setProfilePhotoUrl(photoUrl);
          }

          // Update stats
          setStats({
            events: 0, // You can add event count here
            friends: userFriends?.length || 0,
            preferences: profile.preferences?.length || 0
          });
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        Alert.alert('Error', 'Failed to load profile');
      }
    };

    loadProfile();
  }, [userId]);

  const handlePhotoUpload = async () => {
    if (!userId) return;

    try {
      const image = await pickProfilePhoto();
      const photoId = await uploadProfilePhoto(userId, image.uri);
      const photoUrl = await getProfilePhotoUrl(photoId);
      setProfilePhotoUrl(photoUrl);
      Alert.alert('Success', 'Profile photo updated');
    } catch (err: any) {
      if (err.message !== 'Image selection was cancelled') {
        console.error('Photo upload error:', err);
        Alert.alert('Error', err.message || 'Failed to upload photo');
      }
    }
  };

  const handleInterestToggle = (interest: string) => {
    setSelectedEventTypes((prev) =>
      prev.includes(interest)
        ? prev.filter((item) => item !== interest)
        : [...prev, interest]
    );
  };

  const handleSave = async () => {
    if (!userId) return;

    try {
      const latestProfile = await getUserProfile(userId);
      if (!latestProfile) return;

      await updateUserProfile({
        $id: userId,
        name,
        email: latestProfile.email,
        isPublic: !isPrivate,
        preferences: selectedEventTypes,
        friends: friends.map(f => f.$id),
      });

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

  const handleToggleNotifications = async () => {
    if (!userId) return;

    try {
      if (!notificationsEnabled) {
        await registerForPushNotifications(userId);
        setNotificationsEnabled(true);
        Alert.alert('Success', 'Push notifications enabled');
      } else {
        setNotificationsEnabled(false);
        Alert.alert('Success', 'Push notifications disabled');
      }
    } catch (err: any) {
      console.error('Notification toggle error:', err);
      Alert.alert('Error', err.message || 'Failed to toggle notifications');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView>
        {/* Header */}
        <View className="px-4 py-3 flex-row items-center justify-between border-b border-gray-200">
          <Text className="text-2xl font-rubik-semibold">{name}</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Image
              source={isEditing ? icons.check : icons.edit}
              className="w-6 h-6"
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Profile Info Section */}
        <View className="px-4 py-4">
          <View className="flex-row items-center">
            {/* Profile Photo */}
            <TouchableOpacity onPress={handlePhotoUpload} className="mr-6">
              {profilePhotoUrl ? (
                <Image
                  source={{ uri: profilePhotoUrl }}
                  className="w-20 h-20 rounded-full"
                />
              ) : (
                <View className="w-20 h-20 rounded-full bg-gray-200 items-center justify-center">
                  <Text className="text-4xl text-gray-400 font-rubik-medium">
                    {name?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Stats */}
            <View className="flex-row flex-1 justify-around">
              <View className="items-center">
                <Text className="text-xl font-rubik-semibold">{stats.events}</Text>
                <Text className="text-gray-600">Events</Text>
              </View>
              <View className="items-center">
                <Text className="text-xl font-rubik-semibold">{stats.friends}</Text>
                <Text className="text-gray-600">Friends</Text>
              </View>
              <View className="items-center">
                <Text className="text-xl font-rubik-semibold">{stats.preferences}</Text>
                <Text className="text-gray-600">Interests</Text>
              </View>
            </View>
          </View>

          {/* Bio Section */}
          <View className="mt-4">
            {isEditing ? (
              <TextInput
                value={name}
                onChangeText={setName}
                className="text-base font-rubik mb-2 border border-gray-300 p-2 rounded"
                placeholder="Your name"
              />
            ) : (
              <Text className="text-base font-rubik mb-2">{name}</Text>
            )}
          </View>

          {/* Settings Section */}
          <View className="mt-4 bg-gray-50 rounded-lg p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-rubik-medium">Private Profile</Text>
              <Switch value={isPrivate} onValueChange={setIsPrivate} />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="font-rubik-medium">Push Notifications</Text>
              <Switch value={notificationsEnabled} onValueChange={handleToggleNotifications} />
            </View>
          </View>

          {/* Interests Section */}
          <View className="mt-6">
            <Text className="text-lg font-rubik-semibold mb-3">Interests</Text>
            <View className="flex-row flex-wrap">
              {eventTypeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => isEditing && handleInterestToggle(option.value)}
                  className={`px-4 py-2 rounded-full border mr-2 mb-2 ${selectedEventTypes.includes(option.value)
                      ? 'bg-primary-300 border-primary-300'
                      : 'bg-gray-100 border-gray-300'
                    }`}
                >
                  <Text
                    className={`font-rubik-medium ${selectedEventTypes.includes(option.value) ? 'text-white' : 'text-gray-800'
                      }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Friends Section */}
          <View className="mt-6">
            <Text className="text-lg font-rubik-semibold mb-3">Friends</Text>
            <FlatList
              data={friends}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.$id}
              renderItem={({ item }) => (
                <View className="mr-4 items-center">
                  <Image
                    source={item.photoId ? { uri: getProfilePhotoUrl(item.photoId) } : images.avatar}
                    className="w-16 h-16 rounded-full"
                  />
                  <Text className="text-sm font-rubik mt-1">{item.name}</Text>
                </View>
              )}
              ListEmptyComponent={
                <Text className="text-gray-500 font-rubik">No friends yet</Text>
              }
            />
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="mx-4 mt-6 mb-8 bg-red-500 py-3 rounded-full"
        >
          <Text className="text-white text-center font-rubik-medium">Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
