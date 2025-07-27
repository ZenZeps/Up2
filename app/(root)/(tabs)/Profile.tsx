import { getUserGroups } from '@/lib/api/group';
import { getProfilePhotoUrl, uploadProfilePhoto } from '@/lib/api/profilePhoto';
import { getFriends, updateUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { Group } from '@/lib/types/Groups';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import EnhancedCard from '@/components/ui/EnhancedCard';
import EnhancedButton from '@/components/ui/EnhancedButton';
import EnhancedAvatar from '@/components/ui/EnhancedAvatar';
import StatsCard from '@/components/ui/StatsCard';
import LoadingIndicator from '@/components/ui/LoadingIndicator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';

const Profile = () => {
  const router = useRouter();
  const { user } = useGlobalContext();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const userId = user?.$id;

  const [firstName, setFirstName] = useState(user?.profile?.firstName || '');
  const [lastName, setLastName] = useState(user?.profile?.lastName || '');
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
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

      if (!result.canceled && result.assets[0] && userId) {
        setIsUploadingPhoto(true);

        const asset = result.assets[0];
        const photoId = await uploadProfilePhoto(userId, asset.uri);

        if (photoId) {
          // Update user profile with new photo ID
          if (user?.profile) {
            await updateUserProfile({ 
              ...user.profile,
              photoId
            });
          }

          // Get the new photo URL and update state
          const newPhotoUrl = await getProfilePhotoUrl(photoId);
          setProfilePhotoUrl(newPhotoUrl);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView 
        contentContainerStyle={{ 
          flexGrow: 1, 
          paddingBottom: 70 + insets.bottom,
          padding: spacing.md
        }} 
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: spacing.lg
        }}>
          <Text style={{ fontSize: 24, fontWeight: '600', color: colors.text }}>
            Profile
          </Text>
          <EnhancedButton
            title="Settings"
            onPress={() => router.push('/(root)/Settings')}
            variant="ghost"
            size="small"
          />
        </View>

        {/* Enhanced Profile Info Section */}
        <EnhancedCard variant="elevated" style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            {/* Enhanced Avatar */}
            <EnhancedAvatar
              firstName={firstName}
              lastName={lastName}
              size={80}
              photoUrl={profilePhotoUrl}
              showEditIcon
              onPress={handleUpdateProfilePhoto}
              loading={isUploadingPhoto}
              style={{ marginRight: spacing.md }}
            />

            {/* User Info */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                {userDisplayUtils.getFullName({ firstName, lastName })}
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                Member since {user?.profile?.createdAt ? new Date(user.profile.createdAt).getFullYear() : 'Recently'}
              </Text>
            </View>
          </View>

          {/* Enhanced Stats */}
          <StatsCard 
            stats={[
              { 
                label: 'Friends', 
                value: stats.friends, 
                onPress: () => Alert.alert('Friends', 'View your friends list') 
              },
              { 
                label: 'Groups', 
                value: stats.groups, 
                onPress: () => Alert.alert('Groups', 'View your groups') 
              },
              { 
                label: 'Events', 
                value: 0, 
                onPress: () => Alert.alert('Events', 'View your events') 
              }
            ]}
          />
        </EnhancedCard>

        {/* Enhanced Friends Section */}
        <EnhancedCard variant="default" style={{ marginBottom: spacing.md }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.sm }}>
            Friends ({friends.length})
          </Text>
          {friends.length > 0 ? (
            <View style={{ height: 100 }}>
              <FlatList
                data={friends}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.$id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{ marginRight: spacing.md, alignItems: 'center' }}
                    onPress={() => router.push(`/(root)/UserProfile/${item.$id}` as any)}
                  >
                    <UserAvatar
                      photoUrl={item.photoId ? getProfilePhotoUrl(item.photoId) : null}
                      name={userDisplayUtils.getFullName(item)}
                      size={60}
                      className="mb-2"
                    />
                    <Text style={{ fontSize: 12, color: colors.text, textAlign: 'center' }}>
                      {userDisplayUtils.getFullName(item)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          ) : (
            <Text style={{ color: colors.textSecondary, fontStyle: 'italic' }}>
              No friends yet
            </Text>
          )}
        </EnhancedCard>

        {/* Enhanced Groups Section */}
        <EnhancedCard variant="default">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>
              Groups ({groups.length})
            </Text>
            <EnhancedButton
              title="Create"
              onPress={() => router.push('/(root)/CreateGroup')}
              variant="outline"
              size="small"
            />
          </View>
          
          {groups.length > 0 ? (
            <FlatList
              data={groups}
              keyExtractor={(item) => item.$id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ 
                    paddingVertical: spacing.sm, 
                    borderBottomWidth: 1, 
                    borderBottomColor: colors.border 
                  }}
                  onPress={() => router.push(`/(root)/Group/${item.$id}` as any)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 20, 
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: spacing.sm
                    }}>
                      <Text style={{ color: 'white', fontWeight: '600' }}>
                        {item.title?.charAt(0).toUpperCase() || 'G'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
                        {item.title || 'Untitled Group'}
                      </Text>
                      <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                        {item.users?.length || 0} members
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : (
            <Text style={{ color: colors.textSecondary, fontStyle: 'italic' }}>
              No groups yet
            </Text>
          )}
        </EnhancedCard>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
