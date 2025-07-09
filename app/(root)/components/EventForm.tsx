import { View, TextInput, Modal, Button, Text, ScrollView, TouchableOpacity } from 'react-native';
import React, { useState, useEffect } from 'react';
import RNPickerSelect from 'react-native-picker-select';
import { Event } from '@/lib/types/Events';
import { useAppwrite } from '@/lib/appwrite/useAppwrite';
import { getAllUsers } from '@/lib/api/user';
import { databases, config } from '@/lib/appwrite/appwrite';
import { ID } from '@/lib/appwrite/appwrite';
import { createEvent } from '@/lib/api/event';
import { useEvents } from '../context/EventContext';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import dayjs from 'dayjs';

interface Props {
  visible: boolean;
  onClose: () => void;
  event?: Event;
  selectedDateTime: string;
  currentUserId: string;
  friends: string[];
}

const durationOptions = Array.from({ length: 12 }, (_, i) => (i + 1) * 15); // 15–180 mins

export default function EventForm({ visible, onClose, event, selectedDateTime, currentUserId, friends }: Props) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState(60);
  const [description, setDescription] = useState('');
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [selectedInvitee, setSelectedInvitee] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date>(event ? new Date(event.startTime) : new Date(selectedDateTime));
  const [endDate, setEndDate] = useState<Date>(
    event
      ? new Date(event.endTime)
      : dayjs(selectedDateTime).add(1, 'hour').toDate()
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

const [users, setUsers] = useState<any[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await getAllUsers(); // <-- use getAllUsers
      setUsers(allUsers);
    } catch (err) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };
  fetchUsers();
}, []);

    const friendUsers = users.filter(
    (u) =>
      u.$id !== currentUserId &&
      friends.includes(u.$id) &&
      !inviteeIds.includes(u.$id)
  );

  const isCreator = event?.creatorId === currentUserId;

  const editable = !event || isCreator;

  const { refetchEvents } = useEvents();

useEffect(() => {
  if (event) {
    setTitle(event.title || '');
    setLocation(event.location || '');
    setDescription(event.description || '');
    setInviteeIds(event.inviteeIds ?? []);
    setStartDate(new Date(event.startTime));
    setEndDate(new Date(event.endTime));
  } else {
    setTitle('');
    setLocation('');
    setDescription('');
    setInviteeIds([]);
    setStartDate(new Date(selectedDateTime));
    setEndDate(dayjs(selectedDateTime).add(1, 'hour').toDate());
  }
}, [event, selectedDateTime]);


const newEvent: Event = {
  $id: event?.$id ?? ID.unique(),
  id: event?.$id ?? ID.unique(),
  title,
  location,
  startTime: startDate.toISOString(),
  endTime: endDate.toISOString(),
  creatorId: currentUserId,
  inviteeIds,
  description,
};

    

const handleSave = async () => {
  try {
    if (event && event.$id) { // Ensure event and event.$id exist for update
      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        event.$id,
        newEvent
      );
    } else if (!event) { // Only create if event is undefined (new event)
      await createEvent(newEvent);
    } else {
      console.error("Error: Event or event.$id is missing for update operation.", event);
      alert("Failed to save event: Missing event ID.");
      return;
    }


      await refetchEvents(); // <-- refetch after save

      onClose(); // Close modal after save
    } catch (err) {
      console.error("Error saving event:", err);
      alert("Failed to save event.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
          <TouchableOpacity onPress={onClose} className="p-2">
            <Text className="text-blue-500 text-lg">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-xl font-bold">{event ? 'Edit Event' : 'New Event'}</Text>
          {editable && (
            <TouchableOpacity onPress={handleSave} className="p-2">
              <Text className="text-blue-500 text-lg font-semibold">Done</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView className="flex-1 p-4">
          <TextInput
            placeholder="Event name"
            value={title}
            onChangeText={setTitle}
            className="border-b border-gray-300 p-3 mb-4 text-lg"
            placeholderTextColor="#A0A0A0"
            editable={editable}
          />

          <TextInput
            placeholder="Location"
            value={location}
            onChangeText={setLocation}
            className="border-b border-gray-300 p-3 mb-4 text-lg"
            placeholderTextColor="#A0A0A0"
            editable={editable}
          />

          <TextInput
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            className="border-b border-gray-300 p-3 mb-4 text-lg"
            placeholderTextColor="#A0A0A0"
            multiline
            editable={editable}
          />

          <View className="mb-4">
            <Text className="text-gray-600 text-base mb-2">Start Time</Text>
            <TouchableOpacity
              onPress={() => editable && setShowStartPicker(true)}
              className="border border-gray-300 p-3 rounded-lg"
              disabled={!editable}
            >
              <Text className="text-lg">{dayjs(startDate).format('MMM D, YYYY h:mm A')}</Text>
            </TouchableOpacity>
            <DateTimePickerModal
              isVisible={showStartPicker}
              mode="datetime"
              date={startDate}
              onConfirm={(date) => {
                setStartDate(date);
                setShowStartPicker(false);
                if (date > endDate) setEndDate(dayjs(date).add(1, 'hour').toDate());
              }}
              onCancel={() => setShowStartPicker(false)}
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-600 text-base mb-2">End Time</Text>
            <TouchableOpacity
              onPress={() => editable && setShowEndPicker(true)}
              className="border border-gray-300 p-3 rounded-lg"
              disabled={!editable}
            >
              <Text className="text-lg">{dayjs(endDate).format('MMM D, YYYY h:mm A')}</Text>
            </TouchableOpacity>
            <DateTimePickerModal
              isVisible={showEndPicker}
              mode="datetime"
              date={endDate}
              minimumDate={startDate}
              onConfirm={(date) => {
                setEndDate(date);
                setShowEndPicker(false);
              }}
              onCancel={() => setShowEndPicker(false)}
            />
          </View>

          {/* Invite Friends - only creator can invite */}
          <View className="mb-4">
            <Text className="text-gray-600 text-base mb-2">Invite Friends</Text>
            {loading ? (
              <Text className="text-gray-400 p-3">Loading friends...</Text>
            ) : friends.length === 0 ? (
              <Text className="text-gray-400 p-3">You have no friends to invite.</Text>
            ) : editable ? (
              <View className="border border-gray-300 rounded-lg overflow-hidden">
                <RNPickerSelect
                  onValueChange={(val: string | null) => {
                    if (val && !inviteeIds.includes(val)) {
                      setInviteeIds([...inviteeIds, val]);
                    }
                    setSelectedInvitee(null);
                  }}
                  value={selectedInvitee}
                  placeholder={{ label: 'Select friend to invite', value: null }}
                  items={friendUsers.map((user) => ({
                    label: user.name,
                    value: user.$id,
                  }))}
                  style={{
                    inputIOS: {
                      paddingVertical: 12,
                      paddingHorizontal: 10,
                      fontSize: 16,
                      color: 'black',
                    },
                    inputAndroid: {
                      paddingVertical: 12,
                      paddingHorizontal: 10,
                      fontSize: 16,
                      color: 'black',
                    },
                    placeholder: {
                      color: '#A0A0A0',
                    },
                  }}
                />
              </View>
            ) : (
              <Text className="text-gray-400 p-3">Only the creator can invite friends.</Text>
            )}
          </View>

          {/* Show invited users */}
          {inviteeIds.length > 0 && (
            <View className="mb-4">
              <Text className="text-gray-600 text-base mb-2">Invited:</Text>
              {inviteeIds.map((id) => {
                const user = (users ?? []).find((u) => u.$id === id);
                return (
                  <View key={id} className="flex-row justify-between items-center bg-gray-100 p-3 rounded-lg mb-2">
                    <Text className="text-base">{user?.name || id}</Text>
                    {/* Only show remove button if creator and not self */}
                    {editable && id !== currentUserId && (
                      <TouchableOpacity
                        onPress={() => setInviteeIds(inviteeIds.filter((uid) => uid !== id))}
                        className="bg-red-500 px-3 py-1 rounded-md"
                      >
                        <Text className="text-white text-sm">Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Delete button only for creator */}
          {event && isCreator && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  await databases.deleteDocument(
                    config.databaseID!,
                    config.eventsCollectionID!,
                    event.$id
                  );
                  await refetchEvents();
                  onClose();
                } catch (err) {
                  console.error("Error deleting event:", err);
                  alert("Failed to delete event.");
                }
              }}
              className="bg-red-500 p-3 rounded-lg items-center mb-4"
            >
              <Text className="text-white text-lg font-semibold">Delete Event</Text>
            </TouchableOpacity>
          )}

          {/* If not creator, show join/leave button */}
          {event && !isCreator && (
            <View className="mb-4">
              {inviteeIds.includes(currentUserId) ? (
                <TouchableOpacity
                  onPress={async () => {
                    const updatedInvitees = inviteeIds.filter((id) => id !== currentUserId);
                    await databases.updateDocument(
                      config.databaseID!,
                      config.eventsCollectionID!,
                      event.$id,
                      { inviteeIds: updatedInvitees }
                    );
                    setInviteeIds(updatedInvitees);
                    await refetchEvents();
                    onClose();
                  }}
                  className="bg-orange-500 p-3 rounded-lg items-center"
                >
                  <Text className="text-white text-lg font-semibold">Leave Event</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={async () => {
                    const updatedInvitees = [...inviteeIds, currentUserId];
                    await databases.updateDocument(
                      config.databaseID!,
                      config.eventsCollectionID!,
                      event.$id,
                      { inviteeIds: updatedInvitees }
                    );
                    setInviteeIds(updatedInvitees);
                    await refetchEvents();
                    onClose();
                  }}
                  className="bg-green-500 p-3 rounded-lg items-center"
                >
                  <Text className="text-white text-lg font-semibold">Join Event</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}