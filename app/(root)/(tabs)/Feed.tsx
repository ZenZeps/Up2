import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getFriendsTravelAnnouncements } from '@/lib/api/travel';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { account, config, databases, Query } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { getCategoriesByValues } from '@/constants/categories';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, Linking, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import icons from '@/constants/icons';
import images from '@/constants/images';
import { Alert } from 'react-native';

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
  const { events, refetchEvents } = useEvents();
  const params = useLocalSearchParams();
  const [eventsWithCreatorNames, setEventsWithCreatorNames] = useState<AppEvent[]>([]);
  const [travelAnnouncements, setTravelAnnouncements] = useState<TravelAnnouncementWithUserInfo[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [travelFormVisible, setTravelFormVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await account.get();
        if (!user?.$id) return;
        setCurrentUserId(user.$id);
        const profile = await getUserProfile(user.$id);
        const userFriends = profile?.friends ?? [];
        setFriends(userFriends);

        if (userFriends.length > 0) {
          // Fetch friend events
          const friendEvents = await databases.listDocuments(
            config.databaseID!,
            config.eventsCollectionID!,
            [
              Query.equal('creatorId', userFriends)
            ]
          );

          const uniqueCreatorIds = [...new Set(friendEvents.documents.map(event => event.creatorId))];
          const creatorProfiles = await getUsersByIds(uniqueCreatorIds);
          const creatorMap = new Map(creatorProfiles.map(profile => [profile.$id, userDisplayUtils.getFullName(profile)]));

          const filteredAndMappedEvents = friendEvents.documents
            .filter(event => {
              const hasNotHappened = new Date(event.endTime).getTime() > Date.now();
              return hasNotHappened;
            })
            .map(event => ({
              ...(event as unknown as AppEvent),
              creatorName: creatorMap.get(event.creatorId) || 'Unknown Creator',
              isAttending: event.attendees?.includes(user.$id ?? ''),
            }));
          setEventsWithCreatorNames(filteredAndMappedEvents as AppEvent[]);

          // Fetch travel announcements
          await fetchTravelAnnouncements(userFriends);
        }
      } catch (err: any) {
        if (err?.message?.includes('missing scope (account)')) return;
        console.error('Error getting current user or friends:', err);
      }
    };
    init();
    refetchEvents();
  }, []);

  const fetchTravelAnnouncements = async (friendIds: string[]) => {
    try {
      const travelData = await getFriendsTravelAnnouncements(friendIds);

      // Fetch user names and photos for each travel announcement
      const travelWithUserInfo = await Promise.all(
        travelData.map(async (travel) => {
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

  const sortedEvents = [...eventsWithCreatorNames].sort((a, b) => {
    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
  });

  // Combine and sort events and travel announcements for the feed
  const feedItems: FeedItem[] = [
    ...eventsWithCreatorNames.map(event => ({ ...event, type: 'event' as const })),
    ...travelAnnouncements.map(travel => ({ ...travel, type: 'travel' as const }))
  ].sort((a, b) => {
    const aDate = a.type === 'event' ? new Date(a.startTime) : new Date(a.createdAt);
    const bDate = b.type === 'event' ? new Date(b.startTime) : new Date(b.createdAt);
    return bDate.getTime() - aDate.getTime();
  });

  const renderEventItem = ({ item }: { item: AppEvent & { creatorName?: string } }) => (
    <View className="bg-white rounded-lg shadow-md mb-4 mx-4">
      {/* Event Header */}
      <View className="flex-row items-center p-3">
        <Image
          source={images.avatar} // TODO: Use profile photo
          className="w-10 h-10 rounded-full mr-3"
        />
        <View>
          <Text className="font-rubik-semibold text-base">{item.creatorName || 'Unknown Creator'}</Text>
          <Text className="text-gray-500 text-xs">{dayjs(item.startTime).fromNow()}</Text>
        </View>
      </View>

      {/* Event Image (Placeholder) */}
      <Image
        source={images.onboarding} // Placeholder for event image
        className="w-full h-48 object-cover"
      />

      {/* Event Details */}
      <View className="p-3">
        <Text className="font-rubik-bold text-lg mb-1">{item.title}</Text>
        <View className="flex-row items-center mb-2">
          <View className="flex-row items-center mb-2">
            <Image source={icons.location} className="w-4 h-4 mr-1" resizeMode="contain" />
            <TouchableOpacity onPress={() => openInMaps(item.location)}>
              <Text className="text-blue-600 underline text-sm">{item.location}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text className="text-gray-700 text-sm mb-2">
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
        
        <Text className="text-gray-800 text-base">{item.description}</Text>
      </View>

      {/* Actions */}
      <View className="flex-row justify-around p-3 border-t border-gray-200">
        {item.isAttending ? (
          <TouchableOpacity
            onPress={() => handleNotAttend(item)}
            className="flex-row items-center"
          >
            <Image source={icons.people} className="w-5 h-5 mr-1" resizeMode="contain" />
            <Text className="text-red-500 font-rubik-medium">Not Attending</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => handleAttend(item)}
            className="flex-row items-center"
          >
            <Image source={icons.people} className="w-5 h-5 mr-1" resizeMode="contain" />
            <Text className="text-primary-500 font-rubik-medium">Attend</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => Alert.alert('Invite Friend', 'This feature is coming soon!')} className="flex-row items-center">
          <Image source={icons.bell} className="w-5 h-5 mr-1" resizeMode="contain" />
          <Text className="text-primary-500 font-rubik-medium">Invite</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTravelItem = ({ item }: { item: TravelAnnouncementWithUserInfo }) => (
    <View className="bg-white rounded-lg shadow-md mb-4 mx-4">
      {/* Travel Header */}
      <View className="flex-row items-center p-3">
        <Image
          source={item.userPhotoUrl ? { uri: item.userPhotoUrl } : images.avatar}
          className="w-10 h-10 rounded-full mr-3"
        />
        <View>
          <Text className="font-rubik-semibold text-base">{item.userName}</Text>
          <Text className="text-gray-500 text-xs">{dayjs(item.createdAt).fromNow()}</Text>
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
          <Image source={icons.location} className="w-5 h-5 mr-2" resizeMode="contain" />
          <Text className="font-rubik-bold text-lg text-primary-600">
            Traveling to {item.destination}
          </Text>
        </View>

        <View className="flex-row items-center mb-2">
          <Image source={icons.calendar} className="w-4 h-4 mr-2" resizeMode="contain" />
          <Text className="text-gray-700 text-sm">
            {dayjs(item.startDate).format('MMM D')} - {dayjs(item.endDate).format('MMM D, YYYY')}
          </Text>
        </View>

        {item.description && (
          <Text className="text-gray-800 text-base mt-2">{item.description}</Text>
        )}
      </View>

      {/* Travel Actions */}
      <View className="flex-row justify-around p-3 border-t border-gray-200">
        <TouchableOpacity className="flex-row items-center">
          <Image source={icons.heart} className="w-5 h-5 mr-1" resizeMode="contain" />
          <Text className="text-primary-500 font-rubik-medium">Like</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Message', 'Messaging feature coming soon!')} className="flex-row items-center">
          <Image source={icons.chat} className="w-5 h-5 mr-1" resizeMode="contain" />
          <Text className="text-primary-500 font-rubik-medium">Message</Text>
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
          <TouchableOpacity onPress={() => setTravelFormVisible(true)}>
            <Image source={icons.location} className="w-6 h-6" resizeMode="contain" style={{ tintColor: colors.text }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFormVisible(true)}>
            <Image source={icons.edit} className="w-6 h-6" resizeMode="contain" style={{ tintColor: colors.text }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Event Feed */}
      <FlatList
        data={feedItems}
        keyExtractor={(item) => `${item.type}-${item.$id}`}
        renderItem={renderFeedItem}
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 70 }}
        showsVerticalScrollIndicator={false}
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
