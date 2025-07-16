import { CATEGORIES } from '@/constants/categories';
import icons from '@/constants/icons';
import images from '@/constants/images';
import { getProfilePhotoUrl, pickProfilePhoto, uploadProfilePhoto } from '@/lib/api/profilePhoto';
import { getFriends, getUserProfile, updateUserProfile } from '@/lib/api/user';
import { logout } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
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

const Profile = () => {
  const router = useRouter();
  const { user, refetch } = useGlobalContext();
  const { isDark, toggleTheme, colors } = useTheme();
  const userId = user?.$id;

  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.profile?.firstName || '');
  const [lastName, setLastName] = useState(user?.profile?.lastName || '');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [stats, setStats] = useState({
    events: 0,
    friends: 0,
    preferences: 0
  });

  // Load profile data with session-based caching for scalability
  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) return;

      try {
        // For 100k user scalability: Use session-level caching for profile data
        // Check if we already have profile data in global context (session cache)
        const existingProfile = user?.profile;

        if (existingProfile) {
          // Use cached profile data from session
          setFirstName(existingProfile.firstName || '');
          setLastName(existingProfile.lastName || '');
          setIsPrivate(!existingProfile.isPublic);
          setSelectedEventTypes(existingProfile.preferences || []);

          if (existingProfile.photoId) {
            const photoUrl = await getProfilePhotoUrl(existingProfile.photoId);
            setProfilePhotoUrl(photoUrl);
          }

          // Load friends separately (can be cached with shorter TTL)
          const userFriends = await getFriends(userId);
          setFriends(userFriends || []);

          // Update stats
          setStats({
            events: 0, // Event count can be added here if needed
            friends: userFriends?.length || 0,
            preferences: existingProfile.preferences?.length || 0
          });

          return; // Exit early with cached data
        }

        // Only fetch from database if no cached profile exists (session start)
        const [profile, userFriends] = await Promise.all([
          getUserProfile(userId),
          getFriends(userId)
        ]);

        if (profile) {
          setFirstName(profile.firstName || '');
          setLastName(profile.lastName || '');
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
  }, [userId]); // Removed user?.profile dependency to prevent excessive re-renders

  const handlePhotoUpload = async () => {
    if (!userId) return;

    try {
      const image = await pickProfilePhoto();
      if (!image?.uri) {
        if (image === null) {
          // This case is for when permissions are denied.
          // The alert is already shown in pickProfilePhoto.
          return;
        }
        // For other cases where URI might be missing.
        throw new Error('Failed to get image URI.');
      }

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

    // Validate firstName and lastName
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'First name and last name are required');
      return;
    }

    if (firstName.trim().length < 1 || lastName.trim().length < 1) {
      Alert.alert('Error', 'Names must be at least 1 character long');
      return;
    }

    try {
      const latestProfile = await getUserProfile(userId);
      if (!latestProfile) return;

      // Construct full name from first and last name
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      await updateUserProfile({
        $id: userId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: latestProfile.email,
        isPublic: !isPrivate,
        preferences: selectedEventTypes,
        friends: friends.map(f => f.$id),
        photoId: latestProfile.photoId,
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

      // Wait a moment for logout to complete, then force refetch to clear any cached user data
      setTimeout(async () => {
        try {
          await refetch();
        } catch (e) {
          // Ignore errors during refetch after logout
        }
      }, 100);

      router.replace('/SignIn');
    } catch (err) {
      console.error('Logout failed:', err);
      Alert.alert('Error', 'Failed to log out');
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView>
        {/* Header */}
        <View className="px-4 py-3 flex-row items-center justify-between border-b" style={{ borderBottomColor: colors.border }}>
          <Text className="text-2xl font-rubik-semibold" style={{ color: colors.text }}>
            {userDisplayUtils.getFullName({ firstName, lastName })}
          </Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Image
              source={isEditing ? icons.check : icons.edit}
              className="w-6 h-6"
              resizeMode="contain"
              style={{ tintColor: colors.text }}
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
                    {userDisplayUtils.getInitials({ firstName, lastName })}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Stats */}
            <View className="flex-row flex-1 justify-around">
              <View className="items-center">
                <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>{stats.events}</Text>
                <Text className="text-gray-600" style={{ color: colors.textSecondary }}>Events</Text>
              </View>
              <View className="items-center">
                <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>{stats.friends}</Text>
                <Text className="text-gray-600" style={{ color: colors.textSecondary }}>Friends</Text>
              </View>
              <View className="items-center">
                <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>{stats.preferences}</Text>
                <Text className="text-gray-600" style={{ color: colors.textSecondary }}>Interests</Text>
              </View>
            </View>
          </View>

          {/* Bio Section */}
          <View className="mt-4">
            {isEditing ? (
              <View className="space-y-2">
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  className="text-base font-rubik mb-2 border p-2 rounded"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    color: colors.text
                  }}
                  placeholder="First name"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  className="text-base font-rubik border p-2 rounded"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    color: colors.text
                  }}
                  placeholder="Last name"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            ) : (
              <Text className="text-base font-rubik mb-2" style={{ color: colors.text }}>
                {firstName} {lastName}
              </Text>
            )}
          </View>

          {/* Settings Section */}
          <View className="mt-4 bg-gray-50 rounded-lg p-4" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-rubik-medium" style={{ color: colors.text }}>Private Profile</Text>
              <Switch value={isPrivate} onValueChange={setIsPrivate} />
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="font-rubik-medium" style={{ color: colors.text }}>Dark Mode</Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={isDark ? colors.background : colors.surface}
              />
            </View>
          </View>

          {/* Interests Section */}
          <View className="mt-6">
            <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>Interests</Text>
            <View className="flex-row flex-wrap">
              {CATEGORIES.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => isEditing && handleInterestToggle(option.value)}
                  className={`px-4 py-2 rounded-full border mr-2 mb-2`}
                  style={{
                    backgroundColor: selectedEventTypes.includes(option.value)
                      ? colors.primary
                      : colors.surface,
                    borderColor: selectedEventTypes.includes(option.value)
                      ? colors.primary
                      : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: selectedEventTypes.includes(option.value)
                        ? colors.background
                        : colors.text
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Friends Section */}
          <View className="mt-6">
            <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>Friends</Text>
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
                  <Text className="text-sm font-rubik mt-1" style={{ color: colors.text }}>{userDisplayUtils.getFullName(item)}</Text>
                </View>
              )}
              ListEmptyComponent={
                <Text className="text-gray-500 font-rubik" style={{ color: colors.textSecondary }}>No friends yet</Text>
              }
            />
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            onPress={handleLogout}
            className="mt-8 bg-red-500 py-3 rounded-lg"
          >
            <Text className="text-white text-center font-rubik-medium">
              Log Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
