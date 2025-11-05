import EventImage from '@/components/EventImage';
import { Background } from '@/components/ui/Background';
import { CATEGORIES, getCategoriesByValues } from '@/constants/categories';
import { enrichEventsWithGroupNames, fetchEventsWithGroupNames, isUserAttendingEvent } from '@/lib/api/event';
import { cancelFriendRequest, getUserFriends, sendFriendRequest, unfriendUser } from '@/lib/api/friendship';
import { getDiscoverableGroups, getPublicGroups, getUserGroups, joinGroup, searchPublicGroups } from '@/lib/api/group';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { config, databases } from '@/lib/appwrite/appwrite';
import { useAlert } from '@/lib/context/AlertContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { useActionTracker } from '@/lib/hooks/useOptimizedData';
import { useRealTimeUI } from '@/lib/hooks/useRealTimeUI';
import { useUserLocation } from '@/lib/hooks/useUserLocation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { sendFriendRequestNotification } from '@/lib/notifications/notificationUtils';
import { isUserAttendingHeuristic } from '@/lib/utils/attendance';
import { useCreatorInfo } from '@/lib/utils/creatorInfoManager';
import { cacheScreenData, shouldFetchData } from '@/lib/utils/dataFetchingOptimizer';
import { emit as emitEvent } from '@/lib/utils/eventBus';
import { realTimeUI } from '@/lib/utils/realTimeUI';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Query } from 'react-native-appwrite';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';
import { useEvents } from '../context/EventContext';

dayjs.extend(relativeTime);

const Explore = () => {
  const router = useRouter();
  const { colors, isColorful } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { events, refetchEvents, hasInitialLoad, getScreenEvents, setScreenEvents, markScreenLoadedFromDb } = useEvents();
  const { showAlert } = useAlert();
  const { user: globalUser } = useGlobalContext();
  const recordAction = useActionTracker();
  const { getEventDistance } = useUserLocation();

  // State variables
  const [query, setQuery] = useState(''); // Search query
  const [users, setUsers] = useState<any[]>([]); // All users except current
  const [hasMoreUsers, setHasMoreUsers] = useState(true); // Pagination state
  const [userOffset, setUserOffset] = useState(0); // Pagination offset
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false); // Loading more users
  const [mode, setMode] = useState<'events' | 'users' | 'groups'>('events'); // 'events', 'users', or 'groups' - default to events
  const [isInitialMount, setIsInitialMount] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  const [userPhotoUrls, setUserPhotoUrls] = useState<Record<string, string | null>>({}); // All users' profile photos
  const [requestedUsers, setRequestedUsers] = useState<string[]>([]); // Users who have sent friend requests
  const [baseEventsWithCreatorNames, setBaseEventsWithCreatorNames] = useState<any[]>([]);
  const [eventsWithCreatorNames, setEventsWithCreatorNames] = useState<any[]>([]);
  // Extract creator IDs for unified creator info management
  const creatorIds = useMemo(() => {
    if (!baseEventsWithCreatorNames || baseEventsWithCreatorNames.length === 0) return [];
    const ids = baseEventsWithCreatorNames
      .map((event: any) => event.creatorId)
      .filter(Boolean);
    return [...new Set(ids)] as string[];
  }, [baseEventsWithCreatorNames]);

  // Use unified creator info management instead of manual photo fetching
  const { getCreatorName, getCreatorPhotoUrl } = useCreatorInfo(creatorIds, 20);

  // Re-render when real-time UI pending actions change
  const rtTick = useRealTimeUI();

  // Apply real-time UI overlay whenever base data or pending actions change
  useEffect(() => {
    if (!Array.isArray(baseEventsWithCreatorNames) || !userId) {
      setEventsWithCreatorNames(baseEventsWithCreatorNames);
      return;
    }

    const pendingAttendIds = new Set(realTimeUI.getEventIdsByAction('attend'));
    const pendingUnattendIds = new Set(realTimeUI.getEventIdsByAction('unattend'));

    let filteredEvents = baseEventsWithCreatorNames.filter((ev: any) => !pendingAttendIds.has(ev.$id));

    if (pendingUnattendIds.size > 0) {
      try {
        const globalEvents = events;
        if (Array.isArray(globalEvents)) {
          const additionalEvents = globalEvents.filter((ev: any) => pendingUnattendIds.has(ev.$id));
          const eventsMap = new Map(filteredEvents.map((e: any) => [e.$id, e]));
          additionalEvents.forEach((ev: any) => {
            if (!eventsMap.has(ev.$id)) {
              eventsMap.set(ev.$id, ev);
            }
          });
          filteredEvents = Array.from(eventsMap.values());
        }
      } catch (_e) {
        // Context not available, continue with filtered events
      }
    }

    setEventsWithCreatorNames(filteredEvents);
  }, [rtTick, baseEventsWithCreatorNames, userId]);
  // Groups state
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set());

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

        // Get current user's profile photo - removed since state variable was removed

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
      // Only trigger a global refetch if EventContext hasn't loaded events yet this session
      if (!hasInitialLoad && typeof refetchEvents === 'function') {
        refetchEvents();
      }
    }
  }, [globalUser, hasInitialLoad, refetchEvents]);

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

  // Check for cache invalidation when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (isInitialMount) return; // Don't interfere with initial load

      const checkCacheInvalidation = async () => {
        try {
          const strategy = await shouldFetchData('explore', false);
          if (strategy.shouldFetch) {
            console.log(`Explore: Cache invalidated (${strategy.reason}), refreshing data`);
            // Trigger data refresh by incrementing refreshTrigger
            setRefreshTrigger(prev => prev + 1);
          }
        } catch (error) {
          console.error('Explore: Error checking cache invalidation:', error);
        }
      };

      checkCacheInvalidation();
    }, [isInitialMount])
  );

  // Single optimized event processing effect
  useEffect(() => {
    const fetchExploreEvents = async () => {
      if (!userId) {
        setBaseEventsWithCreatorNames([]);
        setLoading(false);
        return;
      }

      // Try cache first
      const exploreCache = getScreenEvents('explore');
      if (Array.isArray(exploreCache) && exploreCache.length > 0 && !refreshTrigger) {
        setBaseEventsWithCreatorNames(exploreCache);
        setLoading(false);
        return;
      }

      console.log('Explore: Fetching fresh events data');
      // Continue to consolidated processing function
    };

    fetchExploreEvents();
  }, [userId, refreshTrigger, getScreenEvents]);

  // Consolidated and optimized event processing
  useEffect(() => {
    const processExploreEvents = async () => {
      if (!userId) {
        setBaseEventsWithCreatorNames([]);
        setLoading(false);
        return;
      }

      // Smart caching strategy
      const strategy = await shouldFetchData('explore', isInitialMount);
      if (!strategy.shouldFetch && !refreshTrigger) {
        const exploreCache = getScreenEvents('explore');
        if (Array.isArray(exploreCache) && exploreCache.length > 0) {
          setBaseEventsWithCreatorNames(exploreCache);
          setLoading(false);
          setIsInitialMount(false);
          return;
        }
      }

      console.log('Explore: Processing fresh events data');

      try {
        // Single API call for events with fallback chain
        let allEvents: any[] = [];
        try {
          allEvents = await fetchEventsWithGroupNames();
        } catch (err) {
          console.error('Explore: fetchEventsWithGroupNames failed, using fallback', err);
          allEvents = events || [];
        }

        if (allEvents.length === 0) {
          setBaseEventsWithCreatorNames([]);
          setLoading(false);
          setIsInitialMount(false);
          return;
        }

        const now = new Date();

        // Filter out past events and user's own events
        const relevantEvents = allEvents.filter(event =>
          new Date(event.endTime) > now && event.creatorId !== userId
        );

        // Batch check attendance status for all events
        const eventsWithAttendance = await Promise.all(
          relevantEvents.map(async (event) => {
            const isAttending = await isUserAttendingEvent(userId, event.$id);
            return { event, isAttending };
          })
        );

        // Filter out attending events and apply privacy rules
        const nonAttendingEvents = eventsWithAttendance
          .filter(({ isAttending }) => !isAttending)
          .map(({ event }) => event)
          .filter(event => {
            if (event.isPrivate) {
              return Array.isArray(event.inviteeIds) && event.inviteeIds.includes(userId);
            }
            return true;
          });

        // Single enrichment call
        const eventsWithGroupNames = await enrichEventsWithGroupNames(nonAttendingEvents);

        // Single batch creator processing
        const uniqueCreatorIds = [...new Set(eventsWithGroupNames.map(event => event.creatorId))];
        const [creatorProfiles, creatorPhotos] = await Promise.all([
          getUsersByIds(uniqueCreatorIds),
          Promise.all(uniqueCreatorIds.map(async (cid) => {
            try {
              return [cid, await getUserProfilePhotoUrl(cid)];
            } catch {
              return [cid, null];
            }
          }))
        ]);

        const creatorMap = new Map(creatorProfiles.map(profile => [profile.$id, userDisplayUtils.getFullName(profile)]));
        const photoMap = Object.fromEntries(creatorPhotos);
        // Photos now managed by useCreatorInfo hook

        const finalEvents = eventsWithGroupNames.map(event => ({
          ...event,
          creatorName: creatorMap.get(event.creatorId) || 'Unknown Creator',
        }));

        setBaseEventsWithCreatorNames(finalEvents);

        // Cache the results
        try {
          setScreenEvents('explore', finalEvents);
          markScreenLoadedFromDb?.('explore', true);
          await cacheScreenData('explore', finalEvents);
        } catch (err) {
          console.warn('Explore: failed to persist cache', err);
        }

        console.log(`Explore: Processed ${finalEvents.length} events successfully`);

      } catch (error) {
        console.error('Explore: Error processing events:', error);
        setBaseEventsWithCreatorNames([]);
      } finally {
        setLoading(false);
        setIsInitialMount(false);
      }
    };

    processExploreEvents();
  }, [events, userId, isInitialMount, refreshTrigger, getScreenEvents, markScreenLoadedFromDb, setScreenEvents]);

  // Load public groups when entering groups mode (or on mount)
  useEffect(() => {
    const loadGroups = async () => {
      try {
        setLoadingGroups(true);
        // Load all discoverable groups (public + visible private) so we can show groups
        // the user is not a member of. Private groups will show a Request-to-Join action.
        const discoverable = await getDiscoverableGroups();
        setGroups(discoverable || []);
        setGroupsLoaded(true);
        console.log(`Explore: Loaded ${discoverable.length} discoverable groups`);
      } catch (err) {
        console.error('Error loading groups for Explore:', err);
        setGroups([]);
      } finally {
        setLoadingGroups(false);
      }
    };

    // Only fetch once unless user explicitly searches
    if (mode === 'groups' && !groupsLoaded) {
      loadGroups();
    }
  }, [mode, groupsLoaded]);

  // Load groups the current user is a member of to filter them out of Explore
  useEffect(() => {
    const loadUserJoinedGroups = async () => {
      if (!userId) return;
      try {
        const userGroups = await getUserGroups(userId);
        const ids = new Set<string>((userGroups || []).map((g: any) => String(g.$id || g.id || g.id)));
        setJoinedGroupIds(ids as Set<string>);
        console.log('Explore: loaded joined groups', ids.size);
      } catch (err) {
        console.error('Error loading user joined groups:', err);
      }
    };

    // load when user is present or when entering groups mode
    if (userId && mode === 'groups') {
      loadUserJoinedGroups();
    }
  }, [userId, mode]);

  // Run search against groups when user types and mode is groups
  useEffect(() => {
    let cancelled = false;
    const runSearch = async () => {
      if (mode !== 'groups') return;
      const q = query.trim();
      if (!q) {
        // reset to cached public groups
        return;
      }

      try {
        setLoadingGroups(true);
        const results = await searchPublicGroups(q);
        if (!cancelled) setGroups(results || []);
        console.log(`Explore: Found ${results.length} groups for "${q}"`);
      } catch (err) {
        console.error('Group search error:', err);
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    };

    // debounce simple 300ms
    const t = setTimeout(runSearch, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, mode]);

  // Exclude groups the current user is already a member of
  const visibleGroups = useMemo(() => {
    if (!groups || groups.length === 0) return groups || [];
    // Prefer joinedGroupIds (junction table) for membership detection
    if (joinedGroupIds && joinedGroupIds.size > 0) {
      return groups.filter(g => !joinedGroupIds.has(g.$id));
    }
    // Fallback to legacy users array check
    if (!userId) return groups || [];
    return groups.filter((group) => {
      const users = group.users || [];
      if (!Array.isArray(users)) return true;
      return !users.some((u: any) => {
        if (!u) return false;
        if (typeof u === 'string') return u === userId;
        if (typeof u === 'object') return u.$id === userId || u.id === userId;
        return false;
      });
    });
  }, [groups, userId, joinedGroupIds]);

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

  // const openInMaps = (location: string) => {
  //   const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  //   Linking.openURL(url);
  // };

  // Render user item for FlatList - SCALABILITY FIX
  const renderUserItem = ({ item: user }: { item: any }) => {
    const isFriend = friends.includes(user.$id);
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.push(`/(root)/profile/${user.$id}` as any)}
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

  // Render group item
  const handleJoinGroup = async (groupId: string) => {
    if (!userId) return;
    try {
      const res = await joinGroup(groupId, userId);
      if (res.success) {
        showAlert('Joined', res.message || 'Joined group', [{ text: 'OK' }], 'success');
        // Add to local joined set so UI hides it immediately
        setJoinedGroupIds(prev => new Set(prev).add(groupId));
        // Record the action to trigger cache refresh
        recordAction('joinGroup');
        // Emit a global event so other screens can refresh their group data
        emitEvent('groups:changed', { userId, groupId });
        // refresh groups to reflect membership changes (background)
        getPublicGroups().then(p => setGroups(p || [])).catch(err => console.error('refresh groups failed', err));
      } else {
        showAlert('Notice', res.message || 'Request sent', [{ text: 'OK' }], 'info');
      }
    } catch (err) {
      console.error('Error joining group:', err);
      showAlert('Error', 'Failed to join group', [{ text: 'OK' }], 'error');
    }
  };

  const renderGroupItem = ({ item: group }: { item: any }) => {
    const isMember = Array.isArray(group.users) ? group.users.includes(userId) : false;
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.push(`/(root)/groups/${group.$id}`)} style={styles.groupItem}>
          <View style={styles.groupInfo}>
            <View style={[styles.groupAvatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.groupAvatarText, { color: colors.buttonText }]}>{(group.title || '').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.groupDetails}>
              <Text style={[styles.groupName, { color: colors.text }]}>{group.title}</Text>
              <Text style={[styles.groupDescription, { color: colors.textSecondary }]} numberOfLines={2}>{group.description}</Text>
            </View>
          </View>

          <View>
            <TouchableOpacity
              onPress={() => handleJoinGroup(group.$id)}
              style={[styles.actionButton, { backgroundColor: isMember ? colors.textSecondary : colors.primary }]}
            >
              <MaterialIcons name={isMember ? 'check' : 'group-add'} size={16} color={isMember ? colors.background : colors.buttonText} />
              <Text style={[styles.actionButtonText, { color: isMember ? colors.background : colors.buttonText }]}>{isMember ? 'Member' : (group.isPrivate ? 'Request' : 'Join')}</Text>
            </TouchableOpacity>
            <Text style={[styles.filterBadgeText, { color: colors.textSecondary, textAlign: 'right', marginTop: 6 }]}>{group.memberCount ?? 0} members</Text>
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
      // Record the action to trigger cache refresh  
      recordAction('friend');
      console.log('🎯 Friend request process completed');
    } catch (err) {
      console.error('❌ Friend request error:', err);
      showAlert('Error', 'Failed to send friend request', [{ text: 'OK' }], 'error');
    }
  }, [userId, profile, recordAction, showAlert]);

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
              // Record the action to trigger cache refresh
              recordAction('unfriend');
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
      // Record the action to trigger cache refresh
      recordAction('friend');
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

  // Popularity × Time weighting function
  const scoreEvent = useCallback((event: any) => {
    // popularityScore is denormalized on event (higher is more popular)
    const popularity = event.popularityScore || 0;
    const now = Date.now();
    const start = new Date(event.startTime).getTime();
    const hoursUntil = Math.max((start - now) / (1000 * 60 * 60), 0.01); // avoid division by zero

    // decayFactor controls how quickly time wins over popularity. 8 is a reasonable starting point.
    const decayFactor = 8;

    // Score increases with popularity and decreases as event gets further in future.
    const score = popularity / (1 + hoursUntil / decayFactor);
    return score;
  }, []);

  // When search is empty and in events mode, build category sections similar to Feed
  const groupedSections = useMemo(() => {
    // If user typed a query, or there are no events, return empty
    if (query.trim()) return [];
    const upcoming = filteredEvents.filter((e: any) => new Date(e.endTime) > new Date());

    // Exclude events the current user is attending. Use per-user flags first, then legacy attendees array.
    // Do NOT use aggregate attendee counts as a proxy for whether the current user is attending.
    const nonAttending = upcoming.filter((e: any) => {
      // If we have an explicit per-user attendance flag, use it.
      if (typeof e.isAttending === 'boolean') return !e.isAttending;

      // If we have a legacy attendees array, exclude only if the user appears in it.
      if (Array.isArray(e.attendees)) return !isUserAttendingHeuristic(e, userId);

      // If we can't determine per-user attendance, be permissive and show the event.
      return true;
    });

    const map = new Map<string, { key: string; label: string; emoji: string; events: any[] }>();

    nonAttending.forEach((ev: any) => {
      const cats = getCategoriesByValues(ev.tags || []);
      const primary = cats.length > 0 ? cats[0] : { value: 'other', label: 'Other', emoji: '\ud83d\udcc5' } as any;
      const key = primary.value || 'other';

      if (!map.has(key)) {
        map.set(key, { key, label: primary.label || 'Other', emoji: primary.emoji || '\ud83d\udcc5', events: [] });
      }
      map.get(key)!.events.push(ev);
    });

    const sections = Array.from(map.values()).map(section => {
      // Sort within a section by our score (descending: higher score first)
      section.events.sort((a, b) => scoreEvent(b) - scoreEvent(a));
      return section;
    });

    // Sort sections by the top event's start time (soonest first)
    sections.sort((s1, s2) => {
      const t1 = s1.events.length > 0 ? new Date(s1.events[0].startTime).getTime() : Infinity;
      const t2 = s2.events.length > 0 ? new Date(s2.events[0].startTime).getTime() : Infinity;
      return t1 - t2;
    });

    return sections;
  }, [filteredEvents, query, userId, scoreEvent]);

  // Diagnostic: log grouped sections counts for debugging UI empty state
  try {
    const debugSectionsCount = groupedSections.length;
    const debugFilteredCount = filteredEvents.length;
    console.log('Explore Debug: filteredEvents length', debugFilteredCount, 'groupedSections length', debugSectionsCount, groupedSections.map(s => ({ key: s.key, events: s.events.length })));
  } catch (_e) {
    // ignore logging errors in render
  }

  const renderHorizontalEventCard = ({ item }: { item: any }) => {
    // Force explicit dark palette so horizontal minicards match dark-mode exactly regardless of theme
    const darkCard = {
      card: '#2c2c2e',
      border: '#333333',
      surface: '#1e1e1e',
      text: '#ffffff',
      textSecondary: '#8e8e93',
      primary: '#FFFFFF',
    };

    const { formattedDistance } = getEventDistance(item.location || '');

    return (
      //The Minicard Layout
      <TouchableOpacity
        style={[styles.eventMiniCard, { backgroundColor: darkCard.card, borderColor: darkCard.border }]}
        onPress={() => router.push(`/(root)/events/${item.$id}?from=explore` as any)}
      >
        <EventImage
          photoId={(item as any).photoId}
          tags={item.tags}
          size={64}
          style={styles.eventMiniEmoji}
          gradientColors={['#667eea', '#764ba2']}
        />
        <View style={styles.eventMiniContent}>
          {/* Title */}
          <Text style={[styles.eventMiniTitle, { color: darkCard.text }]} numberOfLines={2}>{item.title}</Text>
          {/* Location with Distance */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, marginLeft: -2 }}>
            <MaterialIcons name="location-on" size={12} color={darkCard.primary} />
            <Text style={{ fontSize: 11, color: darkCard.primary, marginLeft: 2, flexShrink: 1 }} numberOfLines={1} ellipsizeMode='tail'>
              {item.location || ''}
              {formattedDistance && ` • ${formattedDistance}`}
            </Text>
          </View>
          {/* Date (In number of days from today)*/}
          <Text style={[styles.eventMiniMeta, { color: darkCard.textSecondary }]}>{dayjs(item.startTime).fromNow()}</Text>
        </View>
        <TouchableOpacity style={styles.goIconSmall} onPress={() => router.push(`/(root)/events/${item.$id}?from=explore` as any)}>
          <MaterialIcons name="arrow-forward" size={18} color={darkCard.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Handler for attending an event (not used in UI here, but available) - COMMENTED OUT
  // const handleAttendEvent = async (event: any) => {
  //   // Use inviteCount when available, otherwise fallback to legacy inviteeIds check
  //   if (!(typeof event.inviteCount === 'number' ? (event.inviteCount > 0 && (Array.isArray(event.inviteeIds) ? event.inviteeIds.includes(userId) : true)) : isUserAttendingHeuristic(event, userId))) {
  //     try {
  //       // Apply immediate UI feedback
  //       realTimeUI.applyAction(event.$id || event.id, 'attend');
  //
  //       // Create attendance record and remove any invitation records
  //       await addEventAttendee(event.$id || event.id, userId);
  //       await removeEventInvitation(event.$id || event.id, userId);
  //
  //       // Record the action to trigger cache refresh
  //       recordAction('attend');
  //       Alert.alert('Success', 'You are now attending this event!');
  //
  //       // Clear the pending action since it succeeded
  //       realTimeUI.clearAction(event.$id || event.id);
  //     } catch (err) {
  //       console.error('Attend event error:', err);
  //       Alert.alert('Error', 'Failed to attend event');
  //
  //       // Clear the pending action on failure
  //       realTimeUI.clearAction(event.$id || event.id);
  //     }
  //   }
  // };

  return (
    <Background>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        {/* Header with Search */}
        {isColorful ? (
          <LinearGradient colors={["#667eea", "#764ba2"]} style={[styles.searchHeader]}>
            <View style={[styles.searchContainer, { backgroundColor: 'rgba(255, 255, 255, 0.9)' }]}>
              <MaterialIcons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                placeholder={mode === 'events' ? t('explore.searchEvents') : mode === 'users' ? t('explore.searchUsers') : t('explore.searchGroups')}
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
                    backgroundColor: (showFilters || dateFilter !== 'any' || selectedTags.length > 0 || priceFilter !== 'any' || locationFilter !== 'any') ? '#FFFFFF' : 'rgba(255, 255, 255, 0.9)',
                    borderColor: 'rgba(255, 255, 255, 0.3)'
                  }
                ]}
              >
                <MaterialIcons
                  name="tune"
                  size={20}
                  color={showFilters || dateFilter !== 'any' || selectedTags.length > 0 || priceFilter !== 'any' || locationFilter !== 'any'
                    ? colors.primary
                    : '#000000'}
                />
                {/* Filter count badge */}
                {(dateFilter !== 'any' || selectedTags.length > 0 || priceFilter !== 'any' || locationFilter !== 'any') && (
                  <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.filterBadgeText, { color: '#FFFFFF' }]}>
                      {(dateFilter !== 'any' ? 1 : 0) + selectedTags.length + (priceFilter !== 'any' ? 1 : 0) + (locationFilter !== 'any' ? 1 : 0)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </LinearGradient>
        ) : (
          <View style={[styles.searchHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <View style={[styles.searchContainer, { backgroundColor: '#FFFFFF' }]}>
              <MaterialIcons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                placeholder={mode === 'events' ? t('explore.searchEvents') : mode === 'users' ? t('explore.searchUsers') : t('explore.searchGroups')}
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
                    backgroundColor: (showFilters || dateFilter !== 'any' || selectedTags.length > 0 || priceFilter !== 'any' || locationFilter !== 'any') ? colors.primary : '#FFFFFF',
                    borderColor: colors.border
                  }
                ]}
              >
                <MaterialIcons
                  name="tune"
                  size={20}
                  color={showFilters || dateFilter !== 'any' || selectedTags.length > 0 || priceFilter !== 'any' || locationFilter !== 'any'
                    ? colors.buttonText
                    : '#000000'}
                />
                {/* Filter count badge */}
                {(dateFilter !== 'any' || selectedTags.length > 0 || priceFilter !== 'any' || locationFilter !== 'any') && (
                  <View style={[styles.filterBadge, { backgroundColor: colors.buttonText }]}>
                    <Text style={[styles.filterBadgeText, { color: colors.primary }]}>
                      {(dateFilter !== 'any' ? 1 : 0) + selectedTags.length + (priceFilter !== 'any' ? 1 : 0) + (locationFilter !== 'any' ? 1 : 0)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Mode Selection */}
        <View style={[styles.modeContainer, { backgroundColor: 'transparent', borderBottomColor: colors.border }]}>
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
              color={mode === 'events' ? colors.buttonText : colors.text}
            />
            <Text
              style={[
                styles.modeButtonText,
                { color: mode === 'events' ? colors.buttonText : colors.text }
              ]}
            >
              {t('explore.events')}
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
              color={mode === 'users' ? colors.buttonText : colors.text}
            />
            <Text
              style={[
                styles.modeButtonText,
                { color: mode === 'users' ? colors.buttonText : colors.text }
              ]}
            >
              {t('explore.users')}
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
              {t('explore.groups')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter Panel for Events */}
        {mode === 'events' && showFilters && (
          <View style={[styles.filterPanel, { backgroundColor: 'transparent', borderBottomColor: colors.border }]}>
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
                      { color: dateFilter === option.value ? colors.buttonText : colors.text }
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
                      { color: priceFilter === option.value ? colors.buttonText : colors.text }
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
                      { color: locationFilter === option.value ? colors.buttonText : colors.text }
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
            // If user has typed a query, show the filtered vertical events list
            query.trim() ? (
              filteredEvents.length > 0 ? (
                filteredEvents.map((event) => (
                  <TouchableOpacity
                    key={event.$id}
                    onPress={() => router.push(`/(root)/events/${event.$id}`)}
                    style={[styles.feedRowCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <EventImage
                      photoId={(event as any).photoId}
                      tags={event.tags}
                      size={72}
                      style={styles.feedThumb}
                      gradientColors={["#667eea", "#764ba2"]}
                    />

                    <View style={styles.feedBody}>
                      <Text style={[styles.feedTitle, { color: colors.text }]} numberOfLines={1}>{event.title}</Text>

                      <View style={styles.feedMetaRow}>
                        <MaterialIcons name="calendar-today" size={12} color={colors.textSecondary} />
                        <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginLeft: 6 }]}>{dayjs(event.startTime).format('DD MMM, YYYY')}</Text>
                        <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginHorizontal: 8 }]}>•</Text>
                        <MaterialIcons name="location-on" size={12} color={colors.textSecondary} />
                        <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginLeft: 6, flexShrink: 1 }]} numberOfLines={1} ellipsizeMode='tail'>{event.location || ''}</Text>
                      </View>

                      <View style={styles.feedSubRow}>
                        <UserAvatar photoUrl={getCreatorPhotoUrl(event.creatorId)} name={getCreatorName(event.creatorId)} size={28} />
                        <Text style={[styles.smallCreatorName, { color: colors.text, marginLeft: 8 }]} numberOfLines={1}>{getCreatorName(event.creatorId) || 'Unknown'}</Text>
                      </View>
                    </View>

                    <View style={styles.feedRightCol}>
                      {((event as any).price !== undefined && (event as any).price !== null) ? (
                        <View style={styles.pricePill}>
                          <Text style={styles.priceText}>${(event as any).price}</Text>
                        </View>
                      ) : null}

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{(typeof event.attendeeCount === 'number' ? event.attendeeCount : (event.attendees?.length || 0))} attending</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                // If grouping produced no sections but we still have filtered events, show a vertical fallback list
                groupedSections.length > 0 ? (
                  groupedSections.map(section => (
                    <View key={section.key} style={styles.categorySection}>
                      <View style={styles.categoryHeader}>
                        <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>{section.emoji} {section.label}</Text>
                        <TouchableOpacity onPress={() => console.log('See all', section.key)}>
                          <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
                        </TouchableOpacity>
                      </View>

                      <FlatList
                        data={section.events}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(it) => it.$id}
                        renderItem={renderHorizontalEventCard}
                        contentContainerStyle={styles.horizontalList}
                      />
                    </View>
                  ))
                ) : filteredEvents.length > 0 ? (
                  // Vertical fallback: render each filtered event
                  filteredEvents.map((event) => (
                    <TouchableOpacity
                      key={event.$id}
                      onPress={() => router.push(`/(root)/events/${event.$id}`)}
                      style={[styles.feedRowCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <EventImage
                        photoId={(event as any).photoId}
                        tags={event.tags}
                        size={72}
                        style={styles.feedThumb}
                        gradientColors={["#667eea", "#764ba2"]}
                      />

                      <View style={styles.feedBody}>
                        <Text style={[styles.feedTitle, { color: colors.text }]} numberOfLines={1}>{event.title}</Text>

                        <View style={styles.feedMetaRow}>
                          <MaterialIcons name="calendar-today" size={12} color={colors.textSecondary} />
                          <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginLeft: 6 }]}>{dayjs(event.startTime).format('DD MMM, YYYY')}</Text>
                          <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginHorizontal: 8 }]}>•</Text>
                          <MaterialIcons name="location-on" size={12} color={colors.textSecondary} />
                          <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginLeft: 6, flexShrink: 1 }]} numberOfLines={1} ellipsizeMode='tail'>{event.location || ''}</Text>
                        </View>

                        <View style={styles.feedSubRow}>
                          <UserAvatar photoUrl={getCreatorPhotoUrl(event.creatorId)} name={getCreatorName(event.creatorId)} size={28} />
                          <Text style={[styles.smallCreatorName, { color: colors.text, marginLeft: 8 }]} numberOfLines={1}>{event.creatorName || 'Unknown'}</Text>
                        </View>
                      </View>

                      <View style={styles.feedRightCol}>
                        {((event as any).price !== undefined && (event as any).price !== null) ? (
                          <View style={styles.pricePill}>
                            <Text style={styles.priceText}>${(event as any).price}</Text>
                          </View>
                        ) : null}

                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{(typeof event.attendeeCount === 'number' ? event.attendeeCount : (event.attendees?.length || 0))} attending</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.emptyState}>
                      <MaterialIcons name="event" size={48} color={colors.textSecondary} />
                      <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No events found</Text>
                    </View>
                  </View>
                )
              )
            ) : (
              // Default Explore: grouped category horizontal lists (same as Feed)
              groupedSections.length > 0 ? (
                groupedSections.map(section => (
                  <View key={section.key} style={styles.categorySection}>
                    <View style={styles.categoryHeader}>
                      <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>{section.emoji} {section.label}</Text>
                      <TouchableOpacity onPress={() => console.log('See all', section.key)}>
                        <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
                      </TouchableOpacity>
                    </View>

                    <FlatList
                      data={section.events}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(it) => it.$id}
                      renderItem={renderHorizontalEventCard}
                      contentContainerStyle={styles.horizontalList}
                    />
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
            )
          ) : (
            // Groups mode
            <View>
              {loadingGroups ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : groups.length > 0 ? (
                <FlatList
                  data={visibleGroups}
                  renderItem={renderGroupItem}
                  keyExtractor={(item) => item.$id}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                  ListEmptyComponent={() => (
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.emptyState}>
                        <MaterialIcons name="group" size={48} color={colors.textSecondary} />
                        <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No groups found</Text>
                      </View>
                    </View>
                  )}
                />
              ) : (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.emptyState}>
                    <MaterialIcons name="group-add" size={48} color={colors.primary} />
                    <Text style={[styles.eventTitle, { color: colors.text, textAlign: 'center', marginTop: 16 }]}>Create Groups</Text>
                    <Text style={[styles.eventDescription, { color: colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 16 }]}>Start your own group and bring together people who share your interests and passions</Text>
                    <TouchableOpacity onPress={() => router.push('/(root)/groups/create')} style={[styles.actionButton, { backgroundColor: colors.primary }]}>
                      <MaterialIcons name="add" size={16} color={colors.buttonText} />
                      <Text style={[styles.actionButtonText, { color: colors.buttonText }]}>Create Group</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Background>
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
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 2,
    // subtle shadow to lift the search bar off the gradient
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    height: 40,
    paddingVertical: 0,
    borderRadius: 20,
    textAlignVertical: 'center',
    lineHeight: 18,
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
  // Horizontal mini card styles (copied from Feed)
  eventMiniCard: {
    width: 220,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventMiniEmoji: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventEmojiSmall: {
    fontSize: 28,
  },
  eventMiniContent: {
    flex: 1,
  },
  eventMiniTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  eventMiniMeta: {
    fontSize: 12,
    marginTop: 6,
  },
  goIconSmall: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 8,
  },
  // Shared feed-style horizontal card styles (copied from Feed)
  feedRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  feedThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventEmojiThumb: {
    fontSize: 28,
  },
  feedBody: {
    flex: 1,
    justifyContent: 'center',
  },
  feedTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  feedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedMetaText: {
    fontSize: 12,
  },
  smallCreatorName: {
    fontSize: 13,
    fontWeight: '600',
  },
  feedSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  feedRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 72,
  },
  pricePill: {
    backgroundColor: '#fff0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  priceText: {
    color: '#d64545',
    fontWeight: '700',
  },
  joinButton: {
    backgroundColor: '#1f6feb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  categorySection: {
    marginBottom: 18,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  horizontalList: {
    paddingLeft: 12,
    paddingRight: 12,
  },
});

export default Explore;