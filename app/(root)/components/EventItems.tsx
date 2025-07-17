// components/EventItem.tsx
import { getCategoriesByValues } from '@/constants/categories';
import { Event } from '@/lib/types/Events';
import React from 'react';
import { Button, Text, View } from 'react-native';
import { useEvents } from '../context/EventContext';

export default function EventItem({ event }: { event: Event }) {
  const { deleteEvent } = useEvents();
  const eventCategories = getCategoriesByValues(event.tags || []);

  return (
    <View className="p-2 border-b border-gray-200">
      <Text className="text-xl font-rubik-semibold">{event.title}</Text>
      <Text className="text-sm text-gray-600">{event.location}</Text>
      <Text className="text-xs text-gray-500">{event.startTime}</Text>
      <Text className="text-xs text-gray-500">{event.endTime}</Text>

      {/* Display tags */}
      {eventCategories.length > 0 && (
        <View className="flex-row flex-wrap mt-1">
          {eventCategories.map((category) => (
            <View key={category.value} className="bg-blue-100 px-2 py-1 rounded-full mr-1 mb-1 flex-row items-center">
              <Text className="text-xs mr-1">{category.emoji}</Text>
              <Text className="text-xs text-blue-800">{category.label}</Text>
            </View>
          ))}
        </View>
      )}

      <Button title="Delete" color="red" onPress={() => deleteEvent(event.$id)} />
    </View>
  );
}