import { getUserFriends } from '@/lib/api/friendship';
import { getUserGroups } from '@/lib/api/group';
import { getProfilePhotoUrl, uploadProfilePhoto } from '@/lib/api/profilePhoto';
import { getUserProfile, getUsersByIds, updateUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { Group } from '@/lib/types/Groups';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
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
  const [about, setAbout] = useState(user?.profile?.about || '');
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
        // Load user profile, friends and groups
        const [freshProfile, userFriendIds, userGroups] = await Promise.all([
          getUserProfile(userId),
          getUserFriends(userId),
          getUserGroups(userId)
        ]);

        // Get full friend profiles from IDs
        const userFriends = userFriendIds.length > 0 ? await getUsersByIds(userFriendIds) : [];

        // Update profile information with fresh data
        if (freshProfile) {
          setFirstName(freshProfile.firstName || '');
          setLastName(freshProfile.lastName || '');
          setAbout(freshProfile.about || '');
          setNationality(freshProfile.nationality || '');
          setAge(freshProfile.age?.toString() || '');
        }

        setFriends(userFriends || []);
        setGroups(userGroups || []);
        setStats({
          friends: userFriends?.length || 0,
          groups: userGroups?.length || 0,
        });

        // Load profile photo if available
        if (freshProfile?.photoId) {
          const photoUrl = await getProfilePhotoUrl(freshProfile.photoId);
          setProfilePhotoUrl(photoUrl);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [userId]);

  // Update local state when user profile changes (fallback for context updates)
  useEffect(() => {
    // Only update if we don't have fresh data or if it's a context update after save
    if (user?.profile && (!firstName || !lastName)) {
      setFirstName(user.profile.firstName || '');
      setLastName(user.profile.lastName || '');
      setAbout(user.profile.about || '');
      setNationality(user.profile.nationality || '');
      setAge(user.profile.age?.toString() || '');
    }
  }, [user?.profile, firstName, lastName]);

  // Create a reusable loadUserData function
  const loadUserData = useCallback(async () => {
    if (!userId) return;

    try {
      // Load user profile, friends and groups
      const [freshProfile, userFriendIds, userGroups] = await Promise.all([
        getUserProfile(userId),
        getUserFriends(userId),
        getUserGroups(userId)
      ]);

      // Get full friend profiles from IDs
      const userFriends = userFriendIds.length > 0 ? await getUsersByIds(userFriendIds) : [];

      // Update profile information with fresh data
      if (freshProfile) {
        setFirstName(freshProfile.firstName || '');
        setLastName(freshProfile.lastName || '');
        setAbout(freshProfile.about || '');
        setNationality(freshProfile.nationality || '');
        setAge(freshProfile.age?.toString() || '');
      }

      setFriends(userFriends || []);
      setGroups(userGroups || []);
      setStats({
        friends: userFriends?.length || 0,
        groups: userGroups?.length || 0,
      });

      // Load profile photo if available
      if (freshProfile?.photoId) {
        const photoUrl = await getProfilePhotoUrl(freshProfile.photoId);
        setProfilePhotoUrl(photoUrl);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, [userId]);

  // Load data on mount
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

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
        about: about.trim(),
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Enhanced Header with Gradient */}
      <View style={styles.header}>
        <LinearGradient
          colors={['#000000', '#1a1a1a', '#2d2d2d']}
          start={[0, 0]}
          end={[1, 1]}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            {/* Profile Section */}
            <View style={styles.profileSection}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={handleUpdateProfilePhoto}
                disabled={isUploadingPhoto}
              >
                {profilePhotoUrl ? (
                  <Image
                    source={{ uri: profilePhotoUrl }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {userDisplayUtils.getInitials({ firstName, lastName })}
                    </Text>
                  </View>
                )}
                {/* Edit indicator */}
                <View style={styles.editIndicator}>
                  <MaterialIcons
                    name={isUploadingPhoto ? "hourglass-empty" : "camera-alt"}
                    size={12}
                    color="#000"
                  />
                </View>
              </TouchableOpacity>

              <View style={styles.nameSection}>
                <Text style={styles.userName}>
                  {userDisplayUtils.getFullName({ firstName, lastName })}
                </Text>
                <Text style={styles.userSubtitle}>
                  {about ? about.slice(0, 50) + (about.length > 50 ? '...' : '') : 'No bio yet'}
                </Text>
              </View>
            </View>

            {/* Stats Section */}
            <View style={styles.statsSection}>
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.friends}</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.groups}</Text>
                <Text style={styles.statLabel}>Groups</Text>
              </TouchableOpacity>
            </View>

            {/* Settings Button */}
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => router.push('/(root)/Settings')}
            >
              <MaterialIcons name="settings" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 70 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* About Section */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <MaterialIcons name="info" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>About</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsEditing(!isEditing)}
              style={[
                styles.editButton,
                { backgroundColor: isEditing ? '#EF4444' : colors.primary }
              ]}
            >
              <MaterialIcons
                name={isEditing ? "close" : "edit"}
                size={16}
                color="white"
              />
              <Text style={styles.editButtonText}>
                {isEditing ? 'Cancel' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>

          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                value={about}
                onChangeText={setAbout}
                placeholder="Tell us about yourself..."
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                onPress={handleSaveProfile}
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
              >
                <MaterialIcons name="check" size={16} color="white" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
              <Text style={[styles.contentText, { color: colors.text }]}>
                {about || "No about information set"}
              </Text>
            </View>
          )}
        </View>

        {/* Personal Details Section */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <MaterialIcons name="person" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Personal Details</Text>
            </View>
          </View>

          {isEditing ? (
            <View style={styles.detailsEditContainer}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nationality</Text>
                <TextInput
                  value={nationality}
                  onChangeText={setNationality}
                  placeholder="Your nationality"
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    styles.detailInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text
                    }
                  ]}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Age</Text>
                <TextInput
                  value={age.toString()}
                  onChangeText={setAge}
                  placeholder="Your age"
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    styles.detailInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text
                    }
                  ]}
                  keyboardType="numeric"
                />
              </View>
            </View>
          ) : (
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <MaterialIcons name="flag" size={18} color={colors.textSecondary} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Nationality</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {nationality || "Not specified"}
                  </Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <MaterialIcons name="cake" size={18} color={colors.textSecondary} />
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Age</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {age ? `${age} years old` : "Not specified"}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Friends Section */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <MaterialIcons name="people" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Friends ({stats.friends})
              </Text>
            </View>
          </View>

          <View style={styles.horizontalList}>
            <FlatList
              data={friends}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.$id}
              contentContainerStyle={styles.friendsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.friendItem}
                  onPress={() => router.push(`/(root)/UserProfile/${item.$id}` as any)}
                >
                  <UserAvatar
                    photoUrl={item.photoId ? getProfilePhotoUrl(item.photoId) : null}
                    firstName={item.firstName}
                    lastName={item.lastName}
                    size={56}
                  />
                  <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
                    {userDisplayUtils.getFirstName(item)}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="person-add" size={32} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No friends yet
                  </Text>
                </View>
              }
            />
          </View>
        </View>

        {/* Groups Section */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <MaterialIcons name="group" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Groups ({stats.groups})
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(root)/CreateGroup')}
              style={[styles.createButton, { backgroundColor: colors.primary }]}
            >
              <MaterialIcons name="add" size={16} color="white" />
              <Text style={styles.createButtonText}>New</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.horizontalList}>
            <FlatList
              data={groups}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.$id}
              contentContainerStyle={styles.groupsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.groupItem}
                  onPress={() => router.push(`/Group/${item.$id}`)}
                >
                  <View style={[styles.groupAvatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.groupAvatarText}>
                      {item.title.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.groupMembers, { color: colors.textSecondary }]}>
                    {item.users?.length || 0} members
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="group-add" size={32} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No groups yet
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'relative',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: 'white',
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
  },
  editIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  nameSection: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  userSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
  },
  statsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  editButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  createButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  editContainer: {
    gap: 12,
  },
  textInput: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-end',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  contentContainer: {
    padding: 16,
    borderRadius: 12,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
  },
  detailsEditContainer: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailInput: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  detailsContainer: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '400',
  },
  horizontalList: {
    height: 120,
  },
  friendsList: {
    paddingHorizontal: 4,
  },
  friendItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 64,
  },
  friendName: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  groupsList: {
    paddingHorizontal: 4,
  },
  groupItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 80,
  },
  groupAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  groupName: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  groupMembers: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default Profile;