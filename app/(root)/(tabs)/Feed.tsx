import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { databases, config, account } from '@/lib/appwrite/appwrite';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';

import icons from '@/constants/icons';
import images from '@/constants/images';
import { Alert } from 'react-native';

import { useEvents } from '../context/EventContext';
import EventForm from '../components/EventForm';
import { Event as AppEvent } from '@/lib/types/Events';

dayjs.extend(relativeTime);
export default function Feed() {
  const { events } = useEvents();
  const [eventsWithCreatorNames, setEventsWithCreatorNames] = useState<AppEvent[]>([]);

 useEffect(() => {
  const addCreatorNamesAndFilterEvents = async () => {
    if (!currentUserId) return;

    const uniqueCreatorIds = [...new Set(events.map(event => event.creatorId))];
    const creatorProfiles = await getUsersByIds(uniqueCreatorIds);
    const creatorMap = new Map(creatorProfiles.map(profile => [profile.$id, profile.name]));

    const filteredAndMappedEvents = events
      .filter(event => {
        const hasNotHappened = new Date(event.endTime).getTime() > Date.now();
        const isFriend = friends.includes(event.creatorId);
        return hasNotHappened && isFriend;
      })
      .map(event => ({
        ...event,
        creatorName: creatorMap.get(event.creatorId) || 'Unknown Creator',
        isAttending: event.attendees?.includes(currentUserId ?? ''),
      }));
    setEventsWithCreatorNames(filteredAndMappedEvents);
  };

  addCreatorNamesAndFilterEvents();
}, [events, currentUserId, friends]);

  const openInMaps = (location: string) => {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  Linking.openURL(url);
};

  const sortedEvents = [...eventsWithCreatorNames].sort((a, b) => {
    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
  });
  const [formVisible, setFormVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<string[]>([]);
  const params = useLocalSearchParams();

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
    } catch (err) {
      console.error('Not attend event error:', err);
      Alert.alert('Error', 'Failed to un-attend event');
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const user = await account.get();
        if (!user?.$id) return;
        setCurrentUserId(user.$id);
        const profile = await getUserProfile(user.$id);
        setFriends(profile?.friends ?? []);
      } catch (err) {
        if (err?.message?.includes('missing scope (account)')) return;
        console.error('Error getting current user or friends:', err);
      }
    };
    init();
  }, [params]);

  const renderEventItem = ({ item }: { item: AppEvent }) => (
    <View className="bg-white rounded-lg shadow-md mb-4 mx-4">
      {/* Event Header */}
      <View className="flex-row items-center p-3">
        <Image
          source={images.avatar} // Placeholder for creator's avatar
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

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-rubik-extrabold">For You</Text>
        <TouchableOpacity onPress={() => setFormVisible(true)}>
          <Image source={icons.edit} className="w-6 h-6" resizeMode="contain" />
        </TouchableOpacity>
      </View>

      {/* Event Feed */}
      <FlatList
        data={sortedEvents}
        keyExtractor={(item) => item.$id}
        renderItem={renderEventItem}
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
        />
      )}
    </SafeAreaView>
  );
}
