import { CATEGORIES } from '@/constants/categories';
import { enrichEventsWithGroupNames, isUserAttendingEvent, updateEvent } from '@/lib/api/event';
import { cancelFriendRequest, getUserFriends, sendFriendRequest, unfriendUser } from '@/lib/api/friendship';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { config, databases } from '@/lib/appwrite/appwrite';
import { useAlert } from '@/lib/context/AlertContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { sendFriendRequestNotification } from '@/lib/notifications/notificationUtils';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Query } from 'react-native-appwrite';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';
import { useEvents } from '../context/EventContext';

const Explore = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { events, refetchEvents } = useEvents();
  const { showAlert } = useAlert();
  const { user: globalUser } = useGlobalContext();

  // State variables
  const [query, setQuery] = useState(''); // Search query
  const [users, setUsers] = useState<any[]>([]); // All users except current
  const [hasMoreUsers, setHasMoreUsers] = useState(true); // Pagination state
  const [userOffset, setUserOffset] = useState(0); // Pagination offset
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false); // Loading more users
  const [mode, setMode] = useState<'events' | 'users' | 'groups'>('events'); // 'events', 'users', or 'groups' - default to events

  // New filtering state
  const [dateFilter, setDateFilter] = useState<'any' | 'today' | 'tomorrow' | 'week'>('any');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [priceFilter, setPriceFilter] = useState<'any' | 'free' | 'paid'>('any');
  const [locationFilter, setLocationFilter] = useState<'any' | 'near'>('any');

  const [loading, setLoading] = useState(true); // Loading state
  const [userId, setUserId] = useState(''); // Current user ID
  const [friends, setFriends] = useState<string[]>([]); // Current user's friends
  const [profile, setProfile] = useState<any>(null); // Current user's profile
  const [currentUserPhotoUrl, setCurrentUserPhotoUrl] = useState<string | null>(null); // Current user's profile photo
  const [userPhotoUrls, setUserPhotoUrls] = useState<Record<string, string | null>>({}); // All users' profile photos
  const [requestedUsers, setRequestedUsers] = useState<string[]>([]); // Users who have sent friend requests
  const [eventsWithCreatorNames, setEventsWithCreatorNames] = useState<any[]>([]);

  // Fetch current user, profile, and all users on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user from global context
        if (!globalUser?.$id) {
          console.error('No current user found');
          return;
        }

        setUserId(globalUser.$id); // Function to define the currentUser statd with information form Appwrite
        const userProfile = await getUserProfile(globalUser.$id); // Fetches the user profile for the specified user from Appwrite
        setProfile(userProfile); // Sets the profile state to the found user profile

        // Use new friendship API to get friends from junction table
        const userFriendIds = await getUserFriends(globalUser.$id);
        setFriends(userFriendIds); // Sets the friends state to the users friend IDs from junction table

        // Get current user's profile photo
        const currentUserPhoto = await getUserProfilePhotoUrl(globalUser.$id);
        setCurrentUserPhotoUrl(currentUserPhoto);

        // Get paginated users instead of ALL users - CRITICAL FIX
        const USER_PAGE_SIZE = 50; // Only load 50 users at a time
        const userRes = await databases.listDocuments(
          config.databaseID!,
          config.usersCollectionID!,
          [
            Query.limit(USER_PAGE_SIZE),
            Query.offset(0),
            Query.notEqual('$id', globalUser.$id), // Exclude current user
            Query.orderDesc('$createdAt') // Most recent users first
          ]
        );
        const otherUsers = userRes.documents || [];
        setUsers(otherUsers);
        setHasMoreUsers(userRes.documents.length === USER_PAGE_SIZE);

        // Get profile photos ONLY for visible users - CRITICAL FIX
        const photoUrls: Record<string, string | null> = {};
        const BATCH_SIZE = 10; // Process photos in small batches

        for (let i = 0; i < otherUsers.length; i += BATCH_SIZE) {
          const batch = otherUsers.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(async (user: any) => {
            try {
              const photoUrl = await getUserProfilePhotoUrl(user.$id);
              photoUrls[user.$id] = photoUrl;
            } catch (error) {
              console.error(`Error fetching photo for user ${user.$id}:`, error);
              photoUrls[user.$id] = null;
            }
          });
          await Promise.all(batchPromises); // Parallel processing
        }
        setUserPhotoUrls(photoUrls);

        // Get pending friend requests sent by the current user
        const requestsRes = await databases.listDocuments(
          config.databaseID!,
          config.userFriendshipsCollectionID,
          [
            Query.equal('requesterId', globalUser.$id),
            Query.equal('status', 'pending'),
          ]
        );
        // Extract the other user ID from the friendship records
        setRequestedUsers(requestsRes.documents.map((req: any) => {
          // If globalUser is userId1, then the recipient is userId2, and vice versa
          return req.userId1 === globalUser.$id ? req.userId2 : req.userId1;
        }));

      } catch (err) {
        console.error('Explore fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (globalUser) {
      fetchData();
      refetchEvents(); // Fetch latest events on mount
    }
  }, [globalUser]);

  // Refresh friends list when screen comes into focus
  const refreshFriends = useCallback(async () => {
    if (!userId) return;
    try {
      const userFriendIds = await getUserFriends(userId);
      setFriends(userFriendIds);
      console.log('🔄 Friends list refreshed:', userFriendIds);
    } catch (error) {
      console.error('Error refreshing friends:', error);
    }
  }, [userId]);

  // Refresh friends when returning to this screen
  useFocusEffect(
    useCallback(() => {
      refreshFriends();
    }, [refreshFriends])
  );

  useEffect(() => {
    const addCreatorNames = async () => {
      // Filter events for Explore: events from OTHER users that current user is NOT attending
      const now = new Date();

      // First filter out basic criteria (past events, user's own events)
      const basicFilteredEvents = events.filter(event => {
        // Filter out past events
        if (new Date(event.endTime) <= now) return false;

        // Filter out events created by current user (we want events from OTHER users)
        if (event.creatorId === userId) return false;

        return true;
      });

      // Now check attendance status using junction table for remaining events
      const eventsWithAttendanceCheck = await Promise.all(
        basicFilteredEvents.map(async (event) => {
          // Check if user is attending using junction table
          const isAttending = await isUserAttendingEvent(userId, event.$id);

          return {
            event,
            isAttending
          };
        })
      );

      // Filter out events the user is attending
      const finalFilteredEvents = eventsWithAttendanceCheck
        .filter(({ isAttending }) => !isAttending)
        .map(({ event }) => event)
        .filter(event => {
          // For private events, only show if user has access (invited but not attending)
          if (event.isPrivate) {
            return (event.inviteeIds && event.inviteeIds.includes(userId)); // User is invited but not attending
          }

          // Show all public events from other users that user is not attending
          return true;
        });

      console.log('Explore Events Filter:', {
        totalEvents: events.length,
        basicFiltered: basicFilteredEvents.length,
        finalFiltered: finalFilteredEvents.length,
        userId,
        sampleEvent: finalFilteredEvents[0] ? {
          title: finalFilteredEvents[0].title,
          creator: finalFilteredEvents[0].creatorId,
        } : null
      });

      // Enrich events with group names
      const eventsWithGroupNames = await enrichEventsWithGroupNames(finalFilteredEvents);

      const uniqueCreatorIds = [...new Set(eventsWithGroupNames.map(event => event.creatorId))];
      const creatorProfiles = await getUsersByIds(uniqueCreatorIds);
      const creatorMap = new Map(creatorProfiles.map(profile => [profile.$id, userDisplayUtils.getFullName(profile)]));

      const eventsWithNames = eventsWithGroupNames.map(event => ({
        ...event,
        creatorName: creatorMap.get(event.creatorId) || 'Unknown Creator',
      }));
      setEventsWithCreatorNames(eventsWithNames);
    };

    if (events.length > 0) {
      addCreatorNames();
    }
  }, [events, userId]);

  // Load more users for pagination - SCALABILITY FIX
  const loadMoreUsers = useCallback(async () => {
    if (loadingMoreUsers || !hasMoreUsers) return;

    try {
      setLoadingMoreUsers(true);
      const USER_PAGE_SIZE = 50;
      const newOffset = userOffset + USER_PAGE_SIZE;

      const userRes = await databases.listDocuments(
        config.databaseID!,
        config.usersCollectionID!,
        [
          Query.limit(USER_PAGE_SIZE),
          Query.offset(newOffset),
          Query.notEqual('$id', userId),
          Query.orderDesc('$createdAt')
        ]
      );

      const newUsers = userRes.documents || [];
      if (newUsers.length === 0) {
        setHasMoreUsers(false);
        return;
      }

      // Get profile photos for new users in batches
      const photoUrls: Record<string, string | null> = { ...userPhotoUrls };
      const BATCH_SIZE = 10;

      for (let i = 0; i < newUsers.length; i += BATCH_SIZE) {
        const batch = newUsers.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (user: any) => {
          try {
            const photoUrl = await getUserProfilePhotoUrl(user.$id);
            photoUrls[user.$id] = photoUrl;
          } catch (error) {
            console.error(`Error fetching photo for user ${user.$id}:`, error);
            photoUrls[user.$id] = null;
          }
        });
        await Promise.all(batchPromises);
      }

      setUsers(prev => [...prev, ...newUsers]);
      setUserPhotoUrls(photoUrls);
      setUserOffset(newOffset);
      setHasMoreUsers(newUsers.length === USER_PAGE_SIZE);

    } catch (error) {
      console.error('Error loading more users:', error);
    } finally {
      setLoadingMoreUsers(false);
    }
  }, [loadingMoreUsers, hasMoreUsers, userOffset, userId, userPhotoUrls]);

  const openInMaps = (location: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    Linking.openURL(url);
  };

  // Render user item for FlatList - SCALABILITY FIX
  const renderUserItem = ({ item: user }: { item: any }) => {
    const isFriend = friends.includes(user.$id);
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.push(`/(root)/UserProfile/${user.$id}` as any)}
          style={styles.userItem}
        >
          <View style={styles.userInfo}>
            <UserAvatar
              photoUrl={userPhotoUrls[user.$id]}
              firstName={user.firstName}
              lastName={user.lastName}
              name={userDisplayUtils.getFullName(user)}
              size={56}
            />
            <View style={styles.userDetails}>
              <Text style={[styles.userName, { color: isFriend ? colors.primary : colors.text }]}>
                {userDisplayUtils.getFullName(user)}
              </Text>
              <Text style={[styles.userBio, { color: colors.textSecondary }]} numberOfLines={1}>
                {user.bio || 'No bio available'}
              </Text>
            </View>
          </View>

          <View style={styles.userActions}>
            {isFriend ? (
              <TouchableOpacity
                onPress={() => handleDeleteFriend(user.$id)}
                style={[styles.actionButton, { backgroundColor: colors.textSecondary }]}
              >
                <MaterialIcons name="person-remove" size={16} color={colors.background} />
                <Text style={[styles.actionButtonText, { color: colors.background }]}>
                  Remove
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  if (requestedUsers.includes(user.$id)) {
                    handleCancelFriendRequest(user.$id);
                  } else {
                    handleSendFriendRequest(user.$id);
                  }
                }}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: requestedUsers.includes(user.$id) ? colors.background : colors.primary,
                    borderWidth: requestedUsers.includes(user.$id) ? 1 : 0,
                    borderColor: colors.border,
                  }
                ]}
              >
                <MaterialIcons
                  name={requestedUsers.includes(user.$id) ? "hourglass-empty" : "person-add"}
                  size={16}
                  color={requestedUsers.includes(user.$id) ? colors.text : 'white'}
                />
                <Text
                  style={[
                    styles.actionButtonText,
                    {
                      color: requestedUsers.includes(user.$id) ? colors.text : 'white'
                    }
                  ]}
                >
                  {requestedUsers.includes(user.$id) ? 'Pending' : 'Add'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Footer component for FlatList loading
  const renderListFooter = () => {
    if (!loadingMoreUsers) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading more users...</Text>
      </View>
    );
  };

  // Send a friend request to another user
  const handleSendFriendRequest = useCallback(async (toUserId: string) => {
    try {
      console.log('📤 Sending friend request:', { from: userId, to: toUserId });
      console.log('👤 Current user profile:', profile);

      // Use the new friendship API with uniqueness checking
      const result = await sendFriendRequest(userId, toUserId);

      if (!result.success) {
        showAlert('Cannot Send Request', result.message, [{ text: 'OK' }], 'warning');
        return;
      }

      console.log('✅ Friend request sent successfully');

      // Send push notification to the recipient
      const senderName = profile ? `${profile.firstName} ${profile.lastName}` : 'Someone';
      console.log('🔔 Attempting to send notification with sender name:', senderName);

      await sendFriendRequestNotification(toUserId, senderName, userId);

      setRequestedUsers((prev) => [...prev, toUserId]); // Update state
      console.log('🎯 Friend request process completed');
    } catch (err) {
      console.error('❌ Friend request error:', err);
      showAlert('Error', 'Failed to send friend request', [{ text: 'OK' }], 'error');
    }
  }, [userId, profile]);

  const handleDeleteFriend = async (friendId: string) => {
    showAlert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Use the new unfriend API that properly deletes from database
              const result = await unfriendUser(userId, friendId);

              if (!result.success) {
                showAlert('Error', result.message, [{ text: 'OK' }], 'error');
                return;
              }

              // Update the UI state after successful database deletion
              setFriends((prev) => prev.filter((id) => id !== friendId));
              console.log('✅ Friend removed successfully from database and UI');

            } catch (err) {
              console.error('Delete friend error:', err);
              showAlert('Error', 'Failed to remove friend', [{ text: 'OK' }], 'error');
            }
          }
        }
      ],
      'warning'
    );
  };

  const handleCancelFriendRequest = async (toUserId: string) => {
    try {
      // Use the new cancel friend request API
      const result = await cancelFriendRequest(userId, toUserId);

      if (!result.success) {
        showAlert('Error', result.message, [{ text: 'OK' }], 'error');
        return;
      }

      setRequestedUsers((prev) => prev.filter((id) => id !== toUserId)); // Update state
      console.log('✅ Friend request canceled successfully');
    } catch (err) {
      console.error('Cancel friend request error:', err);
      showAlert('Error', 'Failed to cancel friend request', [{ text: 'OK' }], 'error');
    }
  };

  const filteredUsers = useMemo(() => {
    return users
      .filter((u) =>
        // Filter out users who are already friends
        !friends.includes(u.$id) &&
        // Filter by search query
        userDisplayUtils.getSearchableText(u).includes(query.toLowerCase())
      )
      .sort((a, b) => {
        const nameA = userDisplayUtils.getFullName(a).toLowerCase();
        const nameB = userDisplayUtils.getFullName(b).toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [query, users, friends]);

  // Filter users to exclude friends (for main display when no search query)
  const nonFriendUsers = useMemo(() => {
    const filtered = users.filter((u) => !friends.includes(u.$id));
    console.log(`Explore: Filtering ${users.length} users, excluding ${friends.length} friends, showing ${filtered.length} users`);
    return filtered;
  }, [users, friends]);

  const filteredEvents = useMemo(() => {
    let filtered = eventsWithCreatorNames;

    // Text search filter
    if (query.trim()) {
      filtered = filtered.filter(
        (e) =>
          e.title?.toLowerCase().includes(query.toLowerCase()) ||
          e.location?.toLowerCase().includes(query.toLowerCase()) ||
          e.description?.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Date filter
    if (dateFilter !== 'any') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      filtered = filtered.filter(event => {
        const eventStart = new Date(event.startTime);
        const eventDate = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());

        switch (dateFilter) {
          case 'today':
            return eventDate.getTime() === today.getTime();
          case 'tomorrow':
            return eventDate.getTime() === tomorrow.getTime();
          case 'week':
            return eventDate >= today && eventDate <= weekFromNow;
          default:
            return true;
        }
      });
    }

    // Tags filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(event => {
        const eventTags = event.tags || [];
        return selectedTags.some(tag => eventTags.includes(tag));
      });
    }

    // Price filter
    if (priceFilter !== 'any') {
      filtered = filtered.filter(event => {
        const hasPrice = event.price && event.price > 0;
        if (priceFilter === 'free') return !hasPrice;
        if (priceFilter === 'paid') return hasPrice;
        return true;
      });
    }

    // Location filter - simple check for events with location
    if (locationFilter === 'near') {
      filtered = filtered.filter(event => {
        return event.location && event.location !== 'No location' && event.location.trim() !== '';
      });
    }

    return filtered;
  }, [query, eventsWithCreatorNames, dateFilter, selectedTags, priceFilter, locationFilter]);

  // Handler for attending an event (not used in UI here, but available)
  const handleAttendEvent = async (event: any) => {
    if (!event.inviteeIds?.includes(userId)) {
      try {
        const updatedInviteeIds = [...(event.inviteeIds || []), userId];
        // Use updateEvent function to ensure all required fields are included
        await updateEvent(event.$id || event.id, {
          ...event,
          inviteeIds: updatedInviteeIds,
        });
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Search */}
      <View style={[styles.searchHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            placeholder={`Search ${mode}...`}
            value={query}
            onChangeText={setQuery}
            style={[styles.searchInput, { color: colors.text }]}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Filter button for events */}
        {mode === 'events' && (
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={[
              styles.filterButton,
              {
                backgroundColor: showFilters || dateFilter !== 'any' || selectedTags.length > 0 || priceFilter !== 'any' || locationFilter !== 'any'
                  ? colors.primary
                  : colors.background,
                borderColor: colors.border
              }
            ]}
          >
            <MaterialIcons
              name="tune"
              size={20}
              color={showFilters || dateFilter !== 'any' || selectedTags.length > 0 || priceFilter !== 'any' || locationFilter !== 'any'
                ? 'white'
                : colors.text}
            />
            {/* Filter count badge */}
            {(dateFilter !== 'any' || selectedTags.length > 0 || priceFilter !== 'any' || locationFilter !== 'any') && (
              <View style={[styles.filterBadge, { backgroundColor: 'white' }]}>
                <Text style={[styles.filterBadgeText, { color: colors.primary }]}>
                  {(dateFilter !== 'any' ? 1 : 0) + selectedTags.length + (priceFilter !== 'any' ? 1 : 0) + (locationFilter !== 'any' ? 1 : 0)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Mode Selection */}
      <View style={[styles.modeContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setMode('events')}
          style={[
            styles.modeButton,
            {
              backgroundColor: mode === 'events' ? colors.primary : 'transparent',
            }
          ]}
        >
          <MaterialIcons
            name="event"
            size={18}
            color={mode === 'events' ? 'white' : colors.text}
          />
          <Text
            style={[
              styles.modeButtonText,
              { color: mode === 'events' ? 'white' : colors.text }
            ]}
          >
            Events
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMode('users')}
          style={[
            styles.modeButton,
            {
              backgroundColor: mode === 'users' ? colors.primary : 'transparent',
            }
          ]}
        >
          <MaterialIcons
            name="people"
            size={18}
            color={mode === 'users' ? 'white' : colors.text}
          />
          <Text
            style={[
              styles.modeButtonText,
              { color: mode === 'users' ? 'white' : colors.text }
            ]}
          >
            Users
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMode('groups')}
          style={[
            styles.modeButton,
            {
              backgroundColor: mode === 'groups' ? colors.primary : 'transparent',
            }
          ]}
        >
          <MaterialIcons
            name="group"
            size={18}
            color={mode === 'groups' ? 'white' : colors.text}
          />
          <Text
            style={[
              styles.modeButtonText,
              { color: mode === 'groups' ? 'white' : colors.text }
            ]}
          >
            Groups
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Panel for Events */}
      {mode === 'events' && showFilters && (
        <View style={[styles.filterPanel, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {/* Date Filter */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterTitle, { color: colors.text }]}>When</Text>
            <View style={styles.filterOptions}>
              {[
                { label: 'Any time', value: 'any' },
                { label: 'Today', value: 'today' },
                { label: 'Tomorrow', value: 'tomorrow' },
                { label: 'This week', value: 'week' }
              ].map(option => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setDateFilter(option.value as any)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: dateFilter === option.value ? colors.primary : colors.background,
                      borderColor: colors.border
                    }
                  ]}
                >
                  <Text style={[
                    styles.filterChipText,
                    { color: dateFilter === option.value ? 'white' : colors.text }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Price Filter */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterTitle, { color: colors.text }]}>Price</Text>
            <View style={styles.filterOptions}>
              {[
                { label: 'Any price', value: 'any' },
                { label: 'Free', value: 'free' },
                { label: 'Paid', value: 'paid' }
              ].map(option => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setPriceFilter(option.value as any)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: priceFilter === option.value ? colors.primary : colors.background,
                      borderColor: colors.border
                    }
                  ]}
                >
                  <Text style={[
                    styles.filterChipText,
                    { color: priceFilter === option.value ? 'white' : colors.text }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Location Filter */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterTitle, { color: colors.text }]}>Location</Text>
            <View style={styles.filterOptions}>
              {[
                { label: 'Any location', value: 'any' },
                { label: 'With location', value: 'near' }
              ].map(option => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setLocationFilter(option.value as any)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: locationFilter === option.value ? colors.primary : colors.background,
                      borderColor: colors.border
                    }
                  ]}
                >
                  <Text style={[
                    styles.filterChipText,
                    { color: locationFilter === option.value ? 'white' : colors.text }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tags Filter */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterTitle, { color: colors.text }]}>Categories</Text>
            <View style={styles.filterTagsGrid}>
              {CATEGORIES.map(category => (
                <TouchableOpacity
                  key={category.value}
                  onPress={() => {
                    if (selectedTags.includes(category.value)) {
                      setSelectedTags(selectedTags.filter(tag => tag !== category.value));
                    } else {
                      setSelectedTags([...selectedTags, category.value]);
                    }
                  }}
                  style={[
                    styles.filterTagChip,
                    {
                      backgroundColor: selectedTags.includes(category.value) ? colors.primary : colors.background,
                      borderColor: colors.border
                    }
                  ]}
                >
                  <Text style={styles.filterTagEmoji}>{category.emoji}</Text>
                  <Text style={[
                    styles.filterTagText,
                    { color: selectedTags.includes(category.value) ? 'white' : colors.text }
                  ]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Clear Filters Button */}
          {(dateFilter !== 'any' || selectedTags.length > 0 || priceFilter !== 'any' || locationFilter !== 'any') && (
            <TouchableOpacity
              onPress={() => {
                setDateFilter('any');
                setSelectedTags([]);
                setPriceFilter('any');
                setLocationFilter('any');
              }}
              style={[styles.clearFiltersButton, { borderColor: colors.border }]}
            >
              <MaterialIcons name="clear" size={16} color={colors.textSecondary} />
              <Text style={[styles.clearFiltersText, { color: colors.textSecondary }]}>
                Clear filters
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 70 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Content based on mode */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : mode === 'users' ? (
          query.trim() ? (
            filteredUsers.length > 0 ? (
              <FlatList
                data={filteredUsers}
                renderItem={renderUserItem}
                keyExtractor={(item) => item.$id}
                onEndReached={loadMoreUsers}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderListFooter}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false} // Disable internal scrolling as it's inside ScrollView
              />
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.emptyState}>
                  <MaterialIcons name="person-search" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No users found</Text>
                </View>
              </View>
            )
          ) : (
            <FlatList
              data={nonFriendUsers}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.$id}
              onEndReached={loadMoreUsers}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderListFooter}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              ListEmptyComponent={() => (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.emptyState}>
                    <MaterialIcons name="people" size={48} color={colors.primary} />
                    <Text style={[styles.eventTitle, { color: colors.text, textAlign: 'center', marginTop: 16 }]}>
                      Find Friends
                    </Text>
                    <Text style={[styles.eventDescription, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>
                      Use the search bar above to discover and connect with other users in your community
                    </Text>
                  </View>
                </View>
              )}
            />
          )
        ) : mode === 'events' ? (
          filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <View key={event.$id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => router.push(`/event/${event.$id}`)}
                  style={styles.eventItem}
                >
                  <Text style={[styles.eventTitle, { color: colors.text }]}>
                    {event.title}
                  </Text>
                  <View style={styles.eventDetails}>
                    <View style={styles.eventDetailRow}>
                      <MaterialIcons name="person" size={16} color={colors.primary} />
                      <Text style={[styles.eventDetailText, { color: colors.textSecondary }]}>
                        {event.creatorName}
                      </Text>
                    </View>
                    {event.groupName && (
                      <View style={styles.eventDetailRow}>
                        <MaterialIcons name="group" size={16} color={colors.primary} />
                        <Text style={[styles.eventDetailText, { color: colors.primary }]}>
                          {event.groupName}
                        </Text>
                      </View>
                    )}
                    <View style={styles.eventDetailRow}>
                      <MaterialIcons name="location-on" size={16} color={colors.primary} />
                      <TouchableOpacity onPress={() => openInMaps(event.location)}>
                        <Text style={[styles.eventDetailText, { color: '#000000', textDecorationLine: 'underline' }]}>
                          {event.location}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.eventDetailRow}>
                      <MaterialIcons name="access-time" size={16} color={colors.primary} />
                      <Text style={[styles.eventDetailText, { color: colors.textSecondary }]}>
                        {dayjs(event.startTime).format('MMM D, YYYY h:mm A')} - {dayjs(event.endTime).format('h:mm A')}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.eventDescription, { color: colors.text }]} numberOfLines={2}>
                    {event.description}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.emptyState}>
                <MaterialIcons name="event" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No events found</Text>
              </View>
            </View>
          )
        ) : (
          // Groups mode
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.emptyState}>
              <MaterialIcons name="group-add" size={48} color={colors.primary} />
              <Text style={[styles.eventTitle, { color: colors.text, textAlign: 'center', marginTop: 16 }]}>
                Create Groups
              </Text>
              <Text style={[styles.eventDescription, { color: colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 16 }]}>
                Start your own group and bring together people who share your interests and passions
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/CreateGroup')}
                style={[styles.actionButton, { backgroundColor: '#000000' }]}
              >
                <MaterialIcons name="add" size={16} color="white" />
                <Text style={[styles.actionButtonText, { color: 'white' }]}>Create Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // New styles for updated layout
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },
  filterButton: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  filterPanel: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterTagEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  filterTagText: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  // Existing styles
  content: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcomeSection: {
    marginLeft: 12,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    opacity: 0.8,
  },
  headerUserName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
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
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetails: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  userBio: {
    fontSize: 14,
    marginTop: 2,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupAvatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  groupAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
  },
  groupDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  eventItem: {
    paddingVertical: 4,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventDetails: {
    marginBottom: 8,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventDetailText: {
    fontSize: 14,
    marginLeft: 8,
  },
  eventDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Loading footer styles - SCALABILITY FIX
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
});

export default Explore;