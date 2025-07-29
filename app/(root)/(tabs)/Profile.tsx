import { getUserGroups } from '@/lib/api/group';
import { getProfilePhotoUrl, uploadProfilePhoto } from '@/lib/api/profilePhoto';
import { getFriends, updateUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { Group } from '@/lib/types/Groups';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';

const Profile = () => {
  const router = useRouter();
  const { user } = useGlobalContext();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const userId = user?.$id;

  const [firstName, setFirstName] = useState(user?.profile?.firstName || '');
  const [lastName, setLastName] = useState(user?.profile?.lastName || '');
  const [status, setStatus] = useState(user?.profile?.status || '');
  const [nationality, setNationality] = useState(user?.profile?.nationality || '');
  const [age, setAge] = useState(user?.profile?.age?.toString() || '');
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [stats, setStats] = useState({
    friends: 0,
    groups: 0,
  });

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      if (!userId) return;

      try {
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
        if (user?.profile?.photoId) {
          const photoUrl = await getProfilePhotoUrl(user.profile.photoId);
          setProfilePhotoUrl(photoUrl);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [userId, user?.profile?.photoId]);

  // Update local state when user profile changes
  useEffect(() => {
    if (user?.profile) {
      setFirstName(user.profile.firstName || '');
      setLastName(user.profile.lastName || '');
      setStatus(user.profile.status || '');
      setNationality(user.profile.nationality || '');
      setAge(user.profile.age?.toString() || '');
    }
  }, [user?.profile]);

  const handleUpdateProfilePhoto = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to update your profile picture.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingPhoto(true);

        const asset = result.assets[0];
        const photoId = await uploadProfilePhoto(asset.uri, userId!);

        if (photoId && user?.profile) {
          // Update user profile with new photo ID
          const updatedProfile = {
            ...user.profile,
            photoId: photoId
          };

          await updateUserProfile(updatedProfile);

          // Update local state
          const photoUrl = await getProfilePhotoUrl(photoId);
          setProfilePhotoUrl(photoUrl);

          Alert.alert('Success', 'Profile photo updated successfully!');
        }
      }
    } catch (error) {
      console.error('Error updating profile photo:', error);
      Alert.alert('Error', 'Failed to update profile photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      if (!user?.profile) return;

      const updatedProfile = {
        ...user.profile,
        status: status.trim(),
        nationality: nationality.trim(),
        age: age && age.trim() ? parseInt(age.toString()) : undefined,
      };

      await updateUserProfile(updatedProfile);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={['#1a1a1a', '#4a4a4a']}
        start={[0, 0]}
        end={[1, 0]}
        className="flex-row items-center justify-between p-4 border-b"
        style={{ borderBottomColor: '#333333' }}
      >
        <View className="flex-row items-center">
          <TouchableOpacity onPress={handleUpdateProfilePhoto} disabled={isUploadingPhoto}>
            {profilePhotoUrl ? (
              <Image
                source={{ uri: profilePhotoUrl }}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <View className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center">
                <Text className="text-xl text-gray-400 font-rubik-medium">
                  {userDisplayUtils.getInitials({ firstName, lastName })}
                </Text>
              </View>
            )}
            {/* Edit indicator */}
            <View className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full items-center justify-center border border-gray-300">
              <Text className="text-black text-xs font-bold">
                {isUploadingPhoto ? '...' : '✎'}
              </Text>
            </View>
          </TouchableOpacity>
          <View className="ml-3">
            <Text className="text-xl font-rubik-semibold" style={{ color: '#ffffff' }}>
              {userDisplayUtils.getFullName({ firstName, lastName })}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center">
          <View className="flex-row items-center mr-8">
            <View className="items-center mr-4">
              <Text className="text-lg font-rubik-semibold" style={{ color: '#ffffff' }}>{stats.friends}</Text>
              <Text className="text-xs" style={{ color: '#ffffff', opacity: 0.8 }}>Friends</Text>
            </View>
            <View className="items-center mr-6">
              <Text className="text-lg font-rubik-semibold" style={{ color: '#ffffff' }}>{stats.groups}</Text>
              <Text className="text-xs" style={{ color: '#ffffff', opacity: 0.8 }}>Groups</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/(root)/Settings')} className="p-2">
            <View className="w-6 h-6 rounded-full border-2 border-white items-center justify-center">
              <View className="w-2 h-2 bg-white rounded-full" />
              <View className="absolute w-4 h-4 border border-white rounded-full" />
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 70 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* Profile Info Section */}
        <View className="px-4 py-4">
          {/* Status Section */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-rubik-semibold" style={{ color: colors.text }}>Status</Text>
              <TouchableOpacity
                onPress={() => setIsEditing(!isEditing)}
                className="px-3 py-1 rounded-lg"
                style={{ backgroundColor: isEditing ? colors.success : colors.primary }}
              >
                <Text className="text-white font-rubik-medium text-sm">
                  {isEditing ? 'Cancel' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>
            {isEditing ? (
              <View>
                <TextInput
                  value={status}
                  onChangeText={setStatus}
                  placeholder="What's on your mind?"
                  placeholderTextColor={colors.textSecondary}
                  className="p-3 rounded-lg border text-base font-rubik"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text
                  }}
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity
                  onPress={handleSaveProfile}
                  className="mt-3 px-4 py-2 rounded-lg self-end"
                  style={{ backgroundColor: colors.success }}
                >
                  <Text className="text-white font-rubik-medium">Save Changes</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="p-3 rounded-lg" style={{ backgroundColor: colors.surface }}>
                <Text className="text-base font-rubik" style={{ color: colors.text }}>
                  {status || "No status set"}
                </Text>
              </View>
            )}
          </View>

          {/* About Me Section */}
          <View className="mb-6">
            <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>About Me</Text>
            {isEditing ? (
              <View>
                <View className="mb-3">
                  <Text className="text-sm font-rubik-medium mb-2" style={{ color: colors.textSecondary }}>Nationality</Text>
                  <TextInput
                    value={nationality}
                    onChangeText={setNationality}
                    placeholder="Your nationality"
                    placeholderTextColor={colors.textSecondary}
                    className="p-3 rounded-lg border text-base font-rubik"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text
                    }}
                  />
                </View>
                <View className="mb-3">
                  <Text className="text-sm font-rubik-medium mb-2" style={{ color: colors.textSecondary }}>Age</Text>
                  <TextInput
                    value={age.toString()}
                    onChangeText={setAge}
                    placeholder="Your age"
                    placeholderTextColor={colors.textSecondary}
                    className="p-3 rounded-lg border text-base font-rubik"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text
                    }}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ) : (
              <View className="p-3 rounded-lg" style={{ backgroundColor: colors.surface }}>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm font-rubik-medium" style={{ color: colors.textSecondary }}>Nationality:</Text>
                  <Text className="text-base font-rubik" style={{ color: colors.text }}>
                    {nationality || "Not specified"}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm font-rubik-medium" style={{ color: colors.textSecondary }}>Age:</Text>
                  <Text className="text-base font-rubik" style={{ color: colors.text }}>
                    {age ? `${age} years old` : "Not specified"}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Friends Section */}
          <View className="mt-6">
            <Text className="text-lg font-rubik-semibold mb-3" style={{ color: colors.text }}>Friends</Text>
            <View style={{ height: 100 }}>
              <FlatList
                data={friends}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.$id}
                nestedScrollEnabled={true}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className="mr-4 items-center"
                    onPress={() => router.push(`/(root)/UserProfile/${item.$id}` as any)}
                  >
                    <UserAvatar
                      photoUrl={item.photoId ? getProfilePhotoUrl(item.photoId) : null}
                      firstName={item.firstName}
                      lastName={item.lastName}
                      size={64}
                    />
                    <Text className="text-sm font-rubik mt-1" style={{ color: colors.text }}>{userDisplayUtils.getFullName(item)}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text className="text-gray-500 font-rubik" style={{ color: colors.textSecondary }}>No friends yet</Text>
                }
              />
            </View>
          </View>

          {/* Groups Section */}
          <View className="mt-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-rubik-semibold" style={{ color: colors.text }}>Groups</Text>
              <TouchableOpacity
                onPress={() => router.push('/(root)/CreateGroup')}
                className="bg-black px-3 py-1 rounded-lg"
              >
                <Text className="text-white font-rubik-medium text-sm">+ New</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 100 }}>
              <FlatList
                data={groups}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.$id}
                nestedScrollEnabled={true}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className="mr-4 items-center"
                    onPress={() => router.push(`/Group/${item.$id}`)}
                  >
                    <View className="w-16 h-16 rounded-full bg-black items-center justify-center mb-2">
                      <Text className="text-white text-xl font-rubik-semibold">
                        {item.title.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      className="text-sm font-rubik text-center"
                      style={{ color: colors.text }}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text className="text-gray-500 font-rubik" style={{ color: colors.textSecondary }}>No groups yet</Text>
                }
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;