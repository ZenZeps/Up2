import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { useEvents } from '../context/EventContext';
import EventForm from '../components/EventForm';
import { Event as AppEvent } from '../types/Events';
import dayjs from 'dayjs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { account } from '@/lib/appwrite';
import { useLocalSearchParams } from 'expo-router';
import { getUserProfile } from '@/lib/api/user';

const viewModes: Mode[] = ['day', 'week', 'month'];

export default function Home() {
  const { events } = useEvents();
  const [formVisible, setFormVisible] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [viewMode, setViewMode] = useState<Mode>('week');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<string[]>([]);

  const params = useLocalSearchParams();

  useEffect(() => {
    const init = async () => {
      try {
        const user = await account.get();
        if (!user?.$id) return; // Don't fetch profile if not logged in
        setCurrentUserId(user.$id);
        const profile = await getUserProfile(user.$id);
        setFriends(profile?.friends ?? []);
      } catch (err) {
        // Optionally ignore error if not logged in
        if (err?.message?.includes('missing scope (account)')) return;
        console.error('Error getting current user or friends:', err);
      }
    };
    init();
  }, [params]);

  // Filter events for this user
  const calendarEvents = events
    .filter(
      (e) =>
        currentUserId &&
        (e.creatorId === currentUserId || e.inviteeIds.includes(currentUserId))
    )
    .map((e) => ({
      title: e.title,
      start: new Date(e.startTime),
      end: new Date(e.endTime),
      location: e.location,
      rawEvent: e,
    }));

  const handlePressCell = (date: Date) => {
    setSelectedDateTime(date.toISOString());
    setEditingEvent(null);
    setFormVisible(true);
  };

  const handlePressEvent = (calendarEvent: any) => {
    setEditingEvent(calendarEvent.rawEvent);
    setSelectedDateTime(calendarEvent.rawEvent.startTime);
    setFormVisible(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 p-4 pb-8">
        {/* Header */}
        <Text className="text-2xl font-rubik-semibold mb-4 text-primary-300">
          {params?.id ? "User's Calendar" : 'My Events'}
        </Text>

        {/* View Mode Toggle */}
        <View className="flex-row justify-center mb-4">
          {viewModes.map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setViewMode(mode)}
              className={`px-4 py-2 mx-1 rounded-xl ${
                viewMode === mode ? 'bg-primary-300' : 'bg-gray-200'
              }`}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: viewMode === mode ? 0.2 : 0,
                shadowRadius: 4,
                elevation: viewMode === mode ? 4 : 0,
              }}
            >
              <Text className={`${viewMode === mode ? 'text-white' : 'text-black'}`}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calendar Card */}
        <View
          className="flex-1 bg-white rounded-2xl shadow-md p-2"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 6,
            marginBottom: Platform.OS === 'ios' ? 24 : 16,
          }}
        >
          <BigCalendar
            events={calendarEvents}
            height={Platform.OS === 'ios' ? 540 : 520}
            mode={viewMode}
            onPressCell={handlePressCell}
            onPressEvent={handlePressEvent}
            eventCellStyle={{
              backgroundColor: '#0061FF1A',
              borderRadius: 8,
              borderLeftWidth: 4,
              borderLeftColor: '#0061FF',
            }}
            headerContainerStyle={{
              backgroundColor: '#F3F6FA',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            }}
            hourRowStyle={{
              borderColor: '#E5E7EB',
            }}
            bodyContainerStyle={{
              backgroundColor: '#F9FAFB',
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
            }}
          />
        </View>

        {/* Event Form Modal (only for own calendar) */}
        {selectedDateTime && !params?.id && (
          <EventForm
            visible={formVisible}
            selectedDateTime={selectedDateTime}
            event={editingEvent || undefined}
            currentUserId={currentUserId ?? ''}
            friends={friends}
            onClose={() => {
              setFormVisible(false);
              setEditingEvent(null);
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}