import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Image, Linking, Alert, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { databases, config, getCurrentUser } from '@/lib/appwrite/appwrite';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { useEvents } from '../context/EventContext';
import dayjs from 'dayjs';
import icons from '@/constants/icons';
import images from '@/constants/images';

const EventDetail = () => {
  const { eventId } = useLocalSearchParams();
  const router = useRouter();
  const { refetchEvents } = useEvents();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [attending, setAttending] = useState(false);
  const [creatorName, setCreatorName] = useState('');
  const [attendeeNames, setAttendeeNames] = useState<string[]>([]);
  const [inviteeNames, setInviteeNames] = useState<string[]>([]);

  useEffect(() => {
    const fetchEventAndCreator = async () => {
      try {
        const res = await databases.getDocument(
          config.databaseID!,
          config.eventsCollectionID!,
          String(eventId)
        );
        setEvent(res);

        const user = await getCurrentUser();
        setUserId(user?.$id);
        setAttending(res.attendees?.includes(user?.$id));

        // Fetch creator's profile
        const creatorProfile = await getUserProfile(res.creatorId);
        setCreatorName(creatorProfile?.name || 'Unknown');

        // Fetch attendee names
        if (res.attendees && res.attendees.length > 0) {
          const attendees = await getUsersByIds(res.attendees);
          setAttendeeNames(attendees.map(attendee => attendee.name));
        }

        // Fetch invitee names
        if (res.inviteeIds && res.inviteeIds.length > 0) {
          const invitees = await getUsersByIds(res.inviteeIds);
          setInviteeNames(invitees.map(invitee => invitee.name));
        }

      } catch (err) {
        console.error('Failed to fetch event or creator:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEventAndCreator();
  }, [eventId]);

  const handleAttend = async () => {
    if (!event || !userId) return;
    if (event.attendees?.includes(userId)) {
      Alert.alert('Info', 'You are already attending this event.');
      return;
    }

    try {
      const updatedAttendees = [...(event.attendees || []), userId];
      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        event.$id,
        {
          attendees: updatedAttendees,
        }
      );
      setEvent({ ...event, attendees: updatedAttendees });
      setAttending(true);
      Alert.alert('Success', 'You are now attending this event!');
      refetchEvents();
    } catch (err) {
      console.error('Attend event error:', err);
      Alert.alert('Error', 'Failed to attend event');
    }
  };

  const handleNotAttend = async () => {
    if (!event || !userId) return;

    try {
      const updatedAttendees = (event.attendees || []).filter((id: string) => id !== userId);
      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        event.$id,
        {
          attendees: updatedAttendees,
        }
      );
      setEvent({ ...event, attendees: updatedAttendees });
      setAttending(false);
      Alert.alert('Success', 'You are no longer attending this event.');
      refetchEvents();
    } catch (err) {
      console.error('Not attend event error:', err);
      Alert.alert('Error', 'Failed to un-attend event');
    }
  };

  const handleInviteFriend = () => {
    Alert.alert('Invite Friend', 'This feature is coming soon!');
    // In a real app, you would navigate to an invite screen or share options
  };

  const openInMaps = (location: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#0061FF" />
        <Text className="mt-4 text-gray-500">Loading event...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-red-500">Event not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-100 pt-8">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()}>
          <Image source={icons.backArrow} className="w-6 h-6" resizeMode="contain" />
        </TouchableOpacity>
        <Text className="text-xl font-rubik-semibold">Event Details</Text>
        <TouchableOpacity onPress={handleInviteFriend}>
          <Image source={icons.send} className="w-6 h-6" resizeMode="contain" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1">
        {/* Event Image */}
        <Image
          source={images.onboarding} // Placeholder for event image
          className="w-full h-64 object-cover"
        />

        {/* Creator Info */}
        <View className="flex-row items-center p-4 bg-white border-b border-gray-200">
          <Image source={images.avatar} className="w-10 h-10 rounded-full mr-3" />
          <Text className="font-rubik-semibold text-base">{creatorName}</Text>
        </View>

        {/* Event Details */}
        <View className="p-4 bg-white mb-4">
          <Text className="font-rubik-bold text-2xl mb-2">{event.title}</Text>
          <TouchableOpacity onPress={() => openInMaps(event.location)} className="flex-row items-center mb-2">
            <Image source={icons.location} className="w-4 h-4 mr-1" resizeMode="contain" />
            <Text className="text-blue-600 underline text-base">{event.location}</Text>
          </TouchableOpacity>
          <Text className="text-gray-700 text-sm mb-2">
            {dayjs(event.startTime).format('MMM D, YYYY h:mm A')} - {dayjs(event.endTime).format('h:mm A')}
          </Text>
          <Text className="text-gray-800 text-base">{event.description}</Text>
        </View>

        {/* Attendees and Actions */}
        <View className="p-4 bg-white">
          <Text className="font-rubik-semibold text-lg mb-3">Attendees:</Text>
          {attendeeNames.length > 0 ? (
            <View className="mb-4">
              {attendeeNames.map((name, index) => (
                <Text key={index} className="text-gray-800 text-base">- {name}</Text>
              ))}
            </View>
          ) : (
            <Text className="text-gray-600 mb-4">No attendees yet.</Text>
          )}

          <Text className="font-rubik-semibold text-lg mb-3">Invitees:</Text>
          {inviteeNames.length > 0 ? (
            <View className="mb-4">
              {inviteeNames.map((name, index) => (
                <Text key={index} className="text-gray-800 text-base">- {name}</Text>
              ))}
            </View>
          ) : (
            <Text className="text-gray-600 mb-4">No invitees yet.</Text>
          )}

          {!attending ? (
            <TouchableOpacity
              onPress={handleAttend}
              className="bg-primary-300 py-3 rounded-lg items-center mb-4"
            >
              <Text className="text-white font-rubik-semibold text-lg">Attend Event</Text>
            </TouchableOpacity>
          ) : (
            <View className="mb-4">
              <View className="flex-row items-center justify-center bg-green-100 py-3 rounded-lg mb-2">
                <Image source={icons.check} className="w-5 h-5 mr-2" resizeMode="contain" tintColor="#22C55E" />
                <Text className="text-green-600 font-rubik-semibold text-lg">You are attending this event</Text>
              </View>
              <TouchableOpacity
                onPress={handleNotAttend}
                className="bg-red-500 py-3 rounded-lg items-center"
              >
                <Text className="text-white font-rubik-semibold text-lg">Not Attending</Text>
              </TouchableOpacity>
            </View>
          )}

          
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EventDetail;