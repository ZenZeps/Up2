import { getUserFriends } from '@/lib/api/friendship';
import { getUserGroups } from '@/lib/api/group';
import { getProfilePhotoUrl, uploadProfilePhoto } from '@/lib/api/profilePhoto';
import { getUserProfile, getUsersByIds, updateUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { useActionTracker } from '@/lib/hooks/useOptimizedData';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Group } from '@/lib/types/Groups';
import { cacheScreenData, shouldFetchData } from '@/lib/utils/dataFetchingOptimizer';
import { on as onEvent } from '@/lib/utils/eventBus';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
  const { t } = useLanguage();
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
  const [isInitialMount, setIsInitialMount] = useState(true);

  // Track actions for cache invalidation
  const recordAction = useActionTracker();

  // Optimized data loading with smart caching strategy
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!userId) return;

      // For Profile, only refresh on specific actions (friend/group/profile changes)
      const fetchResult = await shouldFetchData('profile', isInitialMount);
      const shouldRefresh = fetchResult.shouldFetch;

      if (!shouldRefresh) {
        console.log('Profile: Using cached data, no action recorded');
        setIsInitialMount(false);
        return;
      }

      try {
        console.log('Profile: Fetching fresh data from database');
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

        // Cache the combined data (friends and groups as arrays)
        const cacheData = [...(userFriends || []), ...(userGroups || [])];
        cacheScreenData('profile', cacheData);

      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsInitialMount(false);
      }
    };

    fetchProfileData();
  }, [userId, isInitialMount]);

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
  }, [user?.profile]);

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

  // Refresh data when screen comes into focus - using optimized strategy
  useFocusEffect(
    useCallback(() => {
      const checkAndRefresh = async () => {
        const fetchResult = await shouldFetchData('profile', false);
        if (fetchResult.shouldFetch) {
          loadUserData();
        }
      };
      checkAndRefresh();
    }, [loadUserData])
  );

  // Listen for global group membership changes and reload
  useEffect(() => {
    const cb = (_payload: any) => {
      // Record the action and trigger refresh
      recordAction('joinGroup');
      loadUserData();
    };
    const unsubscribe = onEvent('groups:changed', cb);
    return () => {
      unsubscribe && unsubscribe();
    };
  }, [loadUserData, recordAction]);

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
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingPhoto(true);

        const asset = result.assets[0];
        const photoId = await uploadProfilePhoto(userId!, asset.uri);

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

          // Record the action to trigger cache refresh
          recordAction('updateProfile');

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
      // Record the action to trigger cache refresh
      recordAction('updateProfile');
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 70 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Original Simple Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {/* Header Actions */}
          <View style={styles.headerActions}>
            <View style={styles.headerSpacer} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.background }]} onPress={() => router.push('/(root)/settings/Settings')}>
                <MaterialIcons name="settings" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Profile Content */}
          <View style={styles.profileContent}>
            <TouchableOpacity
              onPress={handleUpdateProfilePhoto}
              disabled={isUploadingPhoto}
              style={styles.avatarContainer}
            >
              {profilePhotoUrl ? (
                <Image source={{ uri: profilePhotoUrl }} style={[styles.profileAvatar, { borderColor: colors.border }]} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary, borderColor: colors.border }]}>
                  <Text style={styles.avatarText}>{userDisplayUtils.getInitials({ firstName, lastName })}</Text>
                </View>
              )}
              <View style={[styles.cameraIcon, { backgroundColor: colors.primary }]}>
                <MaterialIcons name={isUploadingPhoto ? 'hourglass-empty' : 'camera-alt'} size={16} color="white" />
              </View>
            </TouchableOpacity>

            <Text style={[styles.profileName, { color: colors.text }]}>{userDisplayUtils.getFullName({ firstName, lastName })}</Text>
            <Text style={[styles.profileTitle, { color: colors.textSecondary }]}>
              {about ? about.slice(0, 80) + (about.length > 80 ? '...' : '') : 'Add your bio to tell others about yourself'}
            </Text>

            {/* Simple Stats Row */}
            <View style={styles.statsContainer}>
              <TouchableOpacity style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.text }]}>{stats.friends}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('profile.friends')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.text }]}>{stats.groups}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('profile.groups')}</Text>
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.editProfileButton, { backgroundColor: isEditing ? '#EF4444' : colors.primary }]}
                onPress={() => setIsEditing(!isEditing)}
              >
                <MaterialIcons name={isEditing ? "close" : "edit"} size={16} color={colors.buttonText} />
                <Text style={[styles.editProfileButtonText, { color: colors.buttonText }]}>
                  {isEditing ? 'Cancel' : t('profile.editProfile')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.shareButton, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <MaterialIcons name="share" size={16} color={colors.text} />
                <Text style={[styles.shareButtonText, { color: colors.text }]}>{t('profile.share')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bio Section with Edit Functionality */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <MaterialIcons name="info" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('profile.bio')}</Text>
            </View>
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
                numberOfLines={4}
              />

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

              <View style={styles.editActionButtons}>
                <TouchableOpacity
                  onPress={() => setIsEditing(false)}
                  style={[styles.cancelButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                >
                  <MaterialIcons name="close" size={16} color={colors.text} />
                  <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveProfile}
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                >
                  <MaterialIcons name="check" size={16} color={colors.buttonText} />
                  <Text style={[styles.saveButtonText, { color: colors.buttonText }]}>{t('profile.saveChanges')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
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
            </View>
          )}
        </View>

        {/* Friends Section (stylish) */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <MaterialIcons name="people" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Friends</Text>
            </View>
            <Text style={{ color: colors.textSecondary }}>{stats.friends}</Text>
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
                  style={styles.friendItemModern}
                  onPress={() => router.push(`/(root)/profile/${item.$id}` as any)}
                >
                  <View style={styles.friendAvatarWrap}>
                    <UserAvatar
                      photoUrl={item.photoId ? getProfilePhotoUrl(item.photoId) : null}
                      firstName={item.firstName}
                      lastName={item.lastName}
                      size={64}
                    />
                  </View>
                  <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
                    {userDisplayUtils.getFirstName(item)}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="person-add" size={32} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No friends yet</Text>
                </View>
              }
            />
          </View>
        </View>

        {/* Groups Section */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <MaterialIcons name="apps" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Groups</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(root)/groups/create')} style={[styles.createButton, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="add" size={16} color={colors.buttonText} />
              <Text style={[styles.createButtonText, { color: colors.buttonText }]}>New</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.horizontalList}>
            <FlatList
              data={groups}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.$id}
              contentContainerStyle={styles.friendsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.groupItem}
                  onPress={() => router.push(`/(root)/groups/${item.$id}` as any)}
                >
                  <View style={styles.groupAvatar}>
                    <Text style={styles.groupAvatarText}>{(item.title || '').charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.groupMembers, { color: colors.textSecondary }]}>{item.memberCount ?? (Array.isArray(item.users) ? item.users.length : 0)} members</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="group-add" size={32} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No groups yet</Text>
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  profileHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  gradientBackground: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 50,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileContent: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
  },
  avatarPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 42,
    fontWeight: '700',
    color: 'white',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  profileTitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  editProfileButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  followButton: {
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  followButtonText: {
    color: '#FF8A65',
    fontSize: 14,
    fontWeight: '700',
  },
  messageButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
  messageButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  // Card and functional styles
  card: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
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
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  contentContainer: {
    padding: 12,
    borderRadius: 12,
  },

  detailsContainer: {
    gap: 12,
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
  friendItemModern: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 84,
  },
  friendAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  friendName: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
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
    backgroundColor: '#000',
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  createButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '600',
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
  editActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default Profile;