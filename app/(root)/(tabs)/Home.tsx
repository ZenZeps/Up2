import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { useEvents } from '../context/EventContext';
import EventForm from '../components/EventForm';
import { Event as AppEvent } from '../types/Events';
import dayjs from 'dayjs';
import { SafeAreaView } from 'react-native-safe-area-context';

const viewModes: Mode[] = ['day', 'week', 'month'];

export default function Home() {
  const { events } = useEvents();
  const [formVisible, setFormVisible] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [viewMode, setViewMode] = useState<Mode>('week');

  const calendarEvents = events.map((e) => ({
    title: e.title,
    start: new Date(e.dateTime),
    end: dayjs(e.dateTime).add(e.duration, 'minute').toDate(),
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
    setSelectedDateTime(calendarEvent.rawEvent.dateTime);
    setFormVisible(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 p-4 pb-8">
        {/* Header */}
        <Text className="text-2xl font-rubik-semibold mb-4 text-primary-300">My Events</Text>
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
            // Native shadow for iOS, elevation for Android
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
        {/* Event Form Modal */}
        {selectedDateTime && (
          <EventForm
            visible={formVisible}
            selectedDateTime={selectedDateTime}
            event={editingEvent || undefined}
            currentUserId="demo"
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