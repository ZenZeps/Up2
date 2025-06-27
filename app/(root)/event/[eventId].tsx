import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Button, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { databases, config, getCurrentUser } from '@/lib/appwrite';

const EventDetail = () => {
  const { eventId } = useLocalSearchParams();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [attending, setAttending] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await databases.getDocument(
          config.databaseID!,
          config.eventsCollectionID!,
          String(eventId)
        );
        setEvent(res);

        const user = await getCurrentUser();
        setUserId(user?.$id);
        setAttending(res.inviteeIds?.includes(user?.$id));
      } catch (err) {
        console.error('Failed to fetch event:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [eventId]);

  const handleAttend = async () => {
    if (!event || !userId) return;
    if (event.inviteeIds?.includes(userId)) return;

    try {
      const updatedInviteeIds = [...(event.inviteeIds || []), userId];
      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        event.$id || event.id,
        {
          ...event,
          inviteeIds: updatedInviteeIds,
        }
      );
      setEvent({ ...event, inviteeIds: updatedInviteeIds });
      setAttending(true);
      Alert.alert('Success', 'You are now attending this event!');
    } catch (err) {
      console.error('Attend event error:', err);
      Alert.alert('Error', 'Failed to attend event');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-black">
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">Loading event...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-black">
        <Text className="text-red-500">Event not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-black p-4">
      <View className="bg-gray-100 dark:bg-gray-800 p-6 rounded-2xl shadow-md">
        <Text className="text-3xl font-bold text-gray-900 dark:text-white">{event.title}</Text>
        <Text className="mt-2 text-lg text-indigo-600 dark:text-indigo-400">{event.location}</Text>
        <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">{new Date(event.dateTime).toLocaleString()}</Text>

        {event.description && (
          <View className="mt-6">
            <Text className="text-base text-gray-700 dark:text-gray-300">{event.description}</Text>
          </View>
        )}

        {!attending ? (
          <Button title="Attend Event" color="green" onPress={handleAttend} />
        ) : (
          <Text className="mt-4 text-green-600 font-bold">You are attending this event</Text>
        )}
      </View>
    </ScrollView>
  );
};

export default EventDetail;