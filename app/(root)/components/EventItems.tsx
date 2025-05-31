// components/EventItem.tsx
import React from 'react';
import { View, Text, Button } from 'react-native';
import { Event } from '../types/Events';
import { useEvents } from '../context/EventContext';

export default function EventItem({ event }: { event: Event }) {
  const { deleteEvent } = useEvents();

  return (
    <View className="p-2 border-b border-gray-200">
      <Text className="text-xl font-rubik-semibold">{event.title}</Text>
      <Text className="text-sm text-gray-600">{event.location}</Text>
      <Text className="text-xs text-gray-500">{event.dateTime}</Text>
      <Button title="Delete" color="red" onPress={() => deleteEvent(event.id)} />
    </View>
  );
}
