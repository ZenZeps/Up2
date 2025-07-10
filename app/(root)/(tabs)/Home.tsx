import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { useEvents } from '../context/EventContext';
import EventForm from '../components/EventForm';
import { Event as AppEvent } from '@/lib/types/Events';
import dayjs from 'dayjs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { account } from '@/lib/appwrite/appwrite';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { getAllEvents } from '@/lib/api/event';
import EventDetailsModal from '../components/EventDetailsModal';

// Define available calendar view modes
const viewModes: Mode[] = ['day', 'week', 'month'];

export default function Home() {
  // Get events from context
  const { events, refetchEvents } = useEvents();

  // Modal state for event form
  const [formVisible, setFormVisible] = useState(false);
  // Date/time selected for new/edit event
  const [selectedDateTime, setSelectedDateTime] = useState<string | null>(null);
  // Event being edited (if any)
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  // Current calendar view mode
  const [viewMode, setViewMode] = useState<Mode>('week');
  const [date, setDate] = useState(new Date());
  // Current user's Appwrite ID
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Current user's friends (array of user IDs)
  const [friends, setFriends] = useState<string[]>([]);
  const [startHour, setStartHour] = useState(new Date().getHours() - 4);
  const [endHour, setEndHour] = useState(new Date().getHours() + 4);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  // Get route params (for user calendar view)
  const params = useLocalSearchParams();

  const [eventsWithCreatorNames, setEventsWithCreatorNames] = useState<AppEvent[]>([]);

  // On mount or when params change, fetch current user and their friends
  useFocusEffect(
    React.useCallback(() => {
      const init = async () => {
        try {
          // Get current Appwrite user
          const user = await account.get();
          if (!user?.$id) return; // If not logged in, skip
          setCurrentUserId(user.$id);

          // Fetch user profile to get friends list
          const profile = await getUserProfile(user.$id);
          setFriends(profile?.friends ?? []);

          // Fetch all events and add creator names
          const allEvents = await getAllEvents(); // Assuming getAllEvents exists and fetches all events
          const uniqueCreatorIds = [...new Set(allEvents.map(event => event.creatorId))];
          const creatorProfiles = await getUsersByIds(uniqueCreatorIds);
          const creatorMap = new Map(creatorProfiles.map(profile => [profile.$id, profile.name]));

          const eventsWithNames = allEvents.map(event => ({
            ...event,
            creatorName: creatorMap.get(event.creatorId) || 'Unknown Creator',
          }));
          setEventsWithCreatorNames(eventsWithNames);
          console.log('Events with creator names:', eventsWithNames);

        } catch (err) {
          // Ignore error if not logged in, otherwise log
          if (err?.message?.includes('missing scope (account)')) return;
          console.error('Error getting current user or friends:', err);
        }
      };
      init();
      refetchEvents();
    }, [params])
  );

  const calendarEvents = eventsWithCreatorNames
    .filter(
      (e) =>
        currentUserId &&
        (
          e.creatorId === currentUserId ||
          (e.inviteeIds && e.inviteeIds.includes(currentUserId)) ||
          (e.attendees && e.attendees.includes(currentUserId))
        )
    )
    .map((e) => ({
      title: e.title,
      start: new Date(e.startTime),
      end: new Date(e.endTime),
      location: e.location,
      rawEvent: { ...e, $id: e.$id, creatorName: e.creatorName }, // Keep original event for editing and ensure $id is present
    }));

  // Handler for pressing a calendar cell (to create a new event)
  const handlePressCell = (date: Date) => {
    setSelectedDateTime(date.toISOString());
    setEditingEvent(null);
    setFormVisible(true);
  };

  // Handler for pressing an event (to edit)
  const handlePressEvent = (calendarEvent: any) => {
    setEditingEvent({ ...calendarEvent.rawEvent, creatorName: calendarEvent.rawEvent.creatorName });
    setDetailsModalVisible(true);
  };

  const renderEvent = (event, { key, ...touchableOpacityProps }) => (
    <TouchableOpacity key={key} {...touchableOpacityProps}>
      <Text style={{ fontSize: 10, color: 'black' }} numberOfLines={1}>{event.title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1">
        {/* View Mode Toggle Buttons */}
        <View className="flex-row justify-center mb-4">
          {viewModes.map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => {
                if (mode === 'day') {
                  setDate(new Date());
                }
                setViewMode(mode);
              }}
              className={`flex-1 items-center py-3 rounded-lg mx-1 ${
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
          className="flex-1 bg-white rounded-2xl shadow-md"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <BigCalendar
            date={date}
            showAllDayEventCell={false}
            events={calendarEvents}
            height={viewMode === 'month' ? undefined : (Platform.OS === 'ios' ? 640 : 620)}
            mode={viewMode}
            onPressCell={handlePressCell}
            onPressEvent={handlePressEvent}
            renderEvent={renderEvent}
            dayTextStyle={{ fontSize: 12 }}
            startHour={startHour}
            endHour={endHour}
            eventCellStyle={{
              backgroundColor: '#E3F2FD',
              borderColor: '#1E88E5',
              borderWidth: 1,
              borderRadius: 0,
            }}
            headerContainerStyle={{
              backgroundColor: 'white',
              borderBottomWidth: 1,
              borderBottomColor: '#E0E0E0',
            }}
            hourRowStyle={{
              borderColor: '#F5F5F5',
            }}
            bodyContainerStyle={{
              backgroundColor: 'white',
            }}
            nowIndicatorColor="red"
          />
        </View>

        {/* Event Form Modal (only for own calendar, not when viewing another user's calendar) */}
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

        <EventDetailsModal
          event={editingEvent}
          isCreator={editingEvent?.creatorId === currentUserId}
          onClose={() => {
            setDetailsModalVisible(false);
            setEditingEvent(null);
          }}
          onEdit={() => {
            setDetailsModalVisible(false);
            setFormVisible(true);
          }}
        />
      </View>
    </SafeAreaView>
  );
}
