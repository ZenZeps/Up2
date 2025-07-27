import { getCategoriesByValues, getEventEmoji } from '@/constants/categories';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getFriendsTravelAnnouncements } from '@/lib/api/travel';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { account, config, databases } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { batchProcess, createOptimizedQuery, dbConnectionPool } from '@/lib/utils/dbOptimization';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Linking, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import icons from '@/constants/icons';
import images from '@/constants/images';
import UserAvatar from '../components/UserAvatar';

import { Event as AppEvent } from '@/lib/types/Events';
import { TravelAnnouncementWithUserInfo } from '@/lib/types/Travel';
import EventForm from '../components/EventForm';
import TravelForm from '../components/TravelForm';
import { useEvents } from '../context/EventContext';

dayjs.extend(relativeTime);

// Combined feed item type
type FeedItem = (AppEvent & { type: 'event'; creatorName?: string }) | (TravelAnnouncementWithUserInfo & { type: 'travel' });
export default function Feed() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { events, refetchEvents } = useEvents();
  const params = useLocalSearchParams();
  const [eventsWithCreatorNames, setEventsWithCreatorNames] = useState<AppEvent[]>([]);
  const [travelAnnouncements, setTravelAnnouncements] = useState<TravelAnnouncementWithUserInfo[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [travelFormVisible, setTravelFormVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [creatorPhotoUrls, setCreatorPhotoUrls] = useState<Record<string, string | null>>({});

  // Optimized fetch function for scalability
  const fetchFeedData = useCallback(async () => {
    try {
      const user = await account.get();
      if (!user?.$id) return;

      setCurrentUserId(user.$id);
      const profile = await getUserProfile(user.$id);
      const userFriends = profile?.friends ?? [];
      setFriends(userFriends);

      if (userFriends.length > 0) {
        // Use optimized queries and connection pooling for scalability
        const friendEvents = await dbConnectionPool.acquire(async () => {
          return await databases.listDocuments(
            config.databaseID!,
            config.eventsCollectionID!,
            createOptimizedQuery.events.friendEvents(userFriends, 50)
          );
        });

        // Batch process creator profiles for better performance
        const uniqueCreatorIds = [...new Set(friendEvents.documents.map(event => event.creatorId))];
        const creatorProfiles = await batchProcess(
          uniqueCreatorIds,
          async (batch) => await getUsersByIds(batch),
          25 // Optimal batch size
        );

        const creatorMap = new Map(
          creatorProfiles.flat().map(profile => [profile.$id, userDisplayUtils.getFullName(profile)])
        );

        // Fetch creator profile photos
        const creatorPhotoMap: Record<string, string | null> = {};
        await Promise.all(
          uniqueCreatorIds.map(async (creatorId) => {
            try {
              const photoUrl = await getUserProfilePhotoUrl(creatorId);
              creatorPhotoMap[creatorId] = photoUrl;
            } catch (error) {
              creatorPhotoMap[creatorId] = null;
            }
          })
        );
        setCreatorPhotoUrls(creatorPhotoMap);

        const filteredAndMappedEvents = friendEvents.documents
          .filter(event => {
            // Only show upcoming events that the user is NOT attending
            const eventDate = new Date(event.date);
            const now = new Date();
            const isUpcoming = eventDate >= now;
            const isNotAttending = !event.attendees?.includes(user.$id ?? '');
            return isUpcoming && isNotAttending;
          })
          .map(event => ({
            ...(event as unknown as AppEvent),
            creatorName: creatorMap.get(event.creatorId) || 'Unknown Creator',
            isAttending: event.attendees?.includes(user.$id ?? ''),
          }));
        setEventsWithCreatorNames(filteredAndMappedEvents as AppEvent[]);

        // Fetch travel announcements with connection pooling
        await dbConnectionPool.acquire(async () => {
          await fetchTravelAnnouncements(userFriends);
        });
      }
    } catch (err: any) {
      if (err?.message?.includes('missing scope (account)')) return;
      console.error('Error fetching feed data:', err);
    }
  }, []);

  // Pull-to-refresh handler for Instagram-like functionality
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchFeedData();
      await refetchEvents(); // Also refresh events context
    } catch (error) {
      console.error('Error refreshing feed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchFeedData, refetchEvents]);

  // Initial load - happens once per session for scalability
  useEffect(() => {
    if (!initialLoadComplete) {
      const init = async () => {
        await fetchFeedData();
        await refetchEvents();
        setInitialLoadComplete(true);
      };
      init();
    }
  }, [fetchFeedData, refetchEvents, initialLoadComplete]);

  const fetchTravelAnnouncements = async (friendIds: string[]) => {
    try {
      const travelData = await getFriendsTravelAnnouncements(friendIds);

      // Filter for upcoming/current travel only (not past travel)
      const now = new Date();
      const upcomingTravelData = travelData.filter(travel => new Date(travel.endDate) > now);

      // Fetch user names and photos for each travel announcement
      const travelWithUserInfo = await Promise.all(
        upcomingTravelData.map(async (travel) => {
          const userProfile = await getUserProfile(travel.userId);
          const userPhotoUrl = await getUserProfilePhotoUrl(travel.userId);

          return {
            ...travel,
            userName: userDisplayUtils.getFullName(userProfile || {}, 'Unknown User'),
            userPhotoUrl,
          } as TravelAnnouncementWithUserInfo;
        })
      );

      setTravelAnnouncements(travelWithUserInfo);
    } catch (error) {
      console.error('Error fetching travel announcements:', error);
    }
  };

  const openInMaps = (location: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    Linking.openURL(url);
  };

  const handleAttend = async (event: AppEvent) => {
    if (!currentUserId) return;
    if (event.attendees?.includes(currentUserId)) {
      Alert.alert('Info', 'You are already attending this event.');
      return;
    }

    try {
      const updatedAttendees = [...(event.attendees || []), currentUserId];
      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        event.$id,
        {
          attendees: updatedAttendees,
        }
      );
      // Update the local state to reflect the change
      setEventsWithCreatorNames(prevEvents =>
        prevEvents.map(e =>
          e.$id === event.$id ? { ...e, attendees: updatedAttendees, isAttending: true } : e
        )
      );
      Alert.alert('Success', 'You are now attending this event!');
      refetchEvents();
    } catch (err) {
      console.error('Attend event error:', err);
      Alert.alert('Error', 'Failed to attend event');
    }
  };

  const handleNotAttend = async (event: AppEvent) => {
    if (!currentUserId) return;

    try {
      const updatedAttendees = (event.attendees || []).filter((id: string) => id !== currentUserId);
      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        event.$id,
        {
          attendees: updatedAttendees,
        }
      );
      // Update the local state to reflect the change
      setEventsWithCreatorNames(prevEvents =>
        prevEvents.map(e =>
          e.$id === event.$id ? { ...e, attendees: updatedAttendees, isAttending: false } : e
        )
      );
      Alert.alert('Success', 'You are no longer attending this event.');
      refetchEvents();
    } catch (err) {
      console.error('Not attend event error:', err);
      Alert.alert('Error', 'Failed to un-attend event');
    }
  };

  // Filter for upcoming events only and combine with travel announcements for the feed
  const now = new Date();
  const upcomingEvents = eventsWithCreatorNames.filter(event => new Date(event.endTime) > now);

  const feedItems: FeedItem[] = [
    ...upcomingEvents.map(event => ({ ...event, type: 'event' as const })),
    ...travelAnnouncements.map(travel => ({ ...travel, type: 'travel' as const }))
  ].sort((a, b) => {
    // Sort by creation time (most recent first)
    // For events, use startTime as proxy for creation time since $createdAt may not be available
    const aDate = a.type === 'event' ? new Date(a.startTime) : new Date(a.createdAt);
    const bDate = b.type === 'event' ? new Date(b.startTime) : new Date(b.createdAt);
    return bDate.getTime() - aDate.getTime();
  });

  const renderEventItem = ({ item }: { item: AppEvent & { creatorName?: string } }) => (
    <View className="rounded-lg shadow-md mb-4 mx-4" style={{ backgroundColor: colors.card }}>
      {/* Event Header */}
      <View className="flex-row items-center p-3">
        <UserAvatar
          photoUrl={creatorPhotoUrls[item.creatorId] || null}
          name={item.creatorName}
          size={40}
          className="mr-3"
        />
        <View>
          <Text className="font-rubik-semibold text-base" style={{ color: colors.text }}>{item.creatorName || 'Unknown Creator'}</Text>
          <Text className="text-xs" style={{ color: colors.textSecondary }}>{dayjs(item.startTime).fromNow()}</Text>
        </View>
      </View>

      {/* Event Emoji Container */}
      <View className="w-full h-48 justify-center items-center" style={{ backgroundColor: colors.surface }}>
        <Text className="text-6xl">{getEventEmoji(item.tags)}</Text>
      </View>

      {/* Event Details */}
      <View className="p-3">
        <Text className="font-rubik-bold text-lg mb-1" style={{ color: colors.text }}>{item.title}</Text>
        <View className="flex-row items-center mb-2">
          <View className="flex-row items-center mb-2">
            <Image source={icons.location} className="w-4 h-4 mr-1" resizeMode="contain" style={{ tintColor: colors.text }} />
            <TouchableOpacity onPress={() => openInMaps(item.location)}>
              <Text className="text-blue-600 underline text-sm">{item.location}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>
          {dayjs(item.startTime).format('MMM D, YYYY h:mm A')} - {dayjs(item.endTime).format('h:mm A')}
        </Text>

        {/* Display event tags */}
        {item.tags && item.tags.length > 0 && (
          <View className="flex-row flex-wrap mb-2">
            {getCategoriesByValues(item.tags).map((category) => (
              <View key={category.value} className="bg-blue-100 px-2 py-1 rounded-full mr-1 mb-1 flex-row items-center">
                <Text className="text-xs mr-1">{category.emoji}</Text>
                <Text className="text-xs text-blue-800">{category.label}</Text>
              </View>
            ))}
          </View>
        )}

        <Text className="text-base" style={{ color: colors.text }}>{item.description}</Text>
      </View>

      {/* Actions */}
      <View className="flex-row justify-around p-3" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
        {item.isAttending ? (
          <TouchableOpacity
            onPress={() => handleNotAttend(item)}
            className="flex-row items-center"
          >
            <Image source={icons.people} className="w-5 h-5 mr-1" resizeMode="contain" style={{ tintColor: colors.text }} />
            <Text className="text-red-500 font-rubik-medium">Not Attending</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => handleAttend(item)}
            className="flex-row items-center"
          >
            <Image source={icons.people} className="w-5 h-5 mr-1" resizeMode="contain" style={{ tintColor: colors.text }} />
            <Text className="font-rubik-medium" style={{ color: colors.primary }}>Attend</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderTravelItem = ({ item }: { item: TravelAnnouncementWithUserInfo }) => (
    <View className="rounded-lg shadow-md mb-4 mx-4" style={{ backgroundColor: colors.card }}>
      {/* Travel Header */}
      <View className="flex-row items-center p-3">
        <UserAvatar
          photoUrl={item.userPhotoUrl}
          name={item.userName}
          size={40}
          className="mr-3"
        />
        <View>
          <Text className="font-rubik-semibold text-base" style={{ color: colors.text }}>{item.userName}</Text>
          <Text className="text-xs" style={{ color: colors.textSecondary }}>{dayjs(item.createdAt).fromNow()}</Text>
        </View>
      </View>

      {/* Travel Image - Using a travel/destination placeholder */}
      <Image
        source={images.onboarding} // You could add a travel-specific placeholder
        className="w-full h-48 object-cover"
      />

      {/* Travel Details */}
      <View className="p-3">
        <View className="flex-row items-center mb-2">
          <Image source={icons.location} className="w-5 h-5 mr-2" resizeMode="contain" style={{ tintColor: colors.text }} />
          <Text className="font-rubik-bold text-lg" style={{ color: colors.primary }}>
            Traveling to {item.destination}
          </Text>
        </View>

        <View className="flex-row items-center mb-2">
          <Image source={icons.calendar} className="w-4 h-4 mr-2" resizeMode="contain" style={{ tintColor: colors.text }} />
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {dayjs(item.startDate).format('MMM D')} - {dayjs(item.endDate).format('MMM D, YYYY')}
          </Text>
        </View>

        {item.description && (
          <Text className="text-base mt-2" style={{ color: colors.text }}>{item.description}</Text>
        )}
      </View>

      {/* Travel Actions */}
      <View className="flex-row justify-around p-3" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
        <TouchableOpacity className="flex-row items-center">
          <Image source={icons.heart} className="w-5 h-5 mr-1" resizeMode="contain" style={{ tintColor: colors.text }} />
          <Text className="font-rubik-medium" style={{ color: colors.primary }}>Like</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Message', 'Messaging feature coming soon!')} className="flex-row items-center">
          <Image source={icons.chat} className="w-5 h-5 mr-1" resizeMode="contain" style={{ tintColor: colors.text }} />
          <Text className="font-rubik-medium" style={{ color: colors.primary }}>Message</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    if (item.type === 'event') {
      return renderEventItem({ item: item as AppEvent & { creatorName?: string } });
    } else {
      return renderTravelItem({ item: item as TravelAnnouncementWithUserInfo });
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b" style={{ backgroundColor: colors.background, borderBottomColor: colors.border }}>
        <Text className="text-2xl font-rubik-extrabold" style={{ color: colors.text }}>Up2 You</Text>
        <View className="flex-row space-x-3">
          <TouchableOpacity onPress={() => setTravelFormVisible(true)} className="p-2 rounded-lg" style={{ backgroundColor: colors.card }}>
            <Image source={icons.location} className="w-8 h-8" resizeMode="contain" style={{ tintColor: colors.text }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFormVisible(true)} className="p-2 rounded-lg" style={{ backgroundColor: colors.card }}>
            <Image source={icons.edit} className="w-8 h-8" resizeMode="contain" style={{ tintColor: colors.text }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Event Feed with Pull-to-Refresh for scalability */}
      <FlatList
        data={feedItems}
        keyExtractor={(item) => `${item.type}-${item.$id}`}
        renderItem={renderFeedItem}
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 70 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />

      {/* Event Form Modal */}
      {formVisible && (
        <EventForm
          visible={formVisible}
          onClose={() => setFormVisible(false)}
          currentUserId={currentUserId ?? ''}
          friends={friends}
          selectedDateTime={new Date().toISOString()}
        />
      )}

      {/* Travel Form Modal */}
      {travelFormVisible && (
        <TravelForm
          visible={travelFormVisible}
          onClose={() => setTravelFormVisible(false)}
          onSuccess={() => {
            // Refresh travel announcements
            if (friends.length > 0) {
              fetchTravelAnnouncements(friends);
            }
          }}
          currentUserId={currentUserId ?? ''}
        />
      )}
    </SafeAreaView>
  );
}
