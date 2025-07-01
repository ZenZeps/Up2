import { View, TextInput, Modal, Button, Text, ScrollView, TouchableOpacity } from 'react-native';
import React, { useState, useEffect } from 'react';
import RNPickerSelect from 'react-native-picker-select';
import { Event } from '@/lib/types/Events';
import { useAppwrite } from '@/lib/appwrite/useAppwrite';
import { getAllUsers } from '@/lib/api/user';
import { databases, config } from '@/lib/appwrite/appwrite';
import { ID } from 'react-native-appwrite';
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
  title,
  location,
  startTime: startDate.toISOString(),
  endTime: endDate.toISOString(),
  creatorId: currentUserId,
  inviteeIds,
  description,
};

    const payload = {
      ...newEvent,
      description,
    };

const handleSave = async () => {
  try {
    if (event && event.$id) { // Ensure event and event.$id exist for update
      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        event.$id,
        payload
      );
    } else if (!event) { // Only create if event is undefined (new event)
      await databases.createDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        newEvent.$id,
        payload
      );
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
    <Modal visible={visible} animationType="slide">
      <ScrollView className="p-4">
        <Text className="text-lg font-bold mb-4">{event ? 'Edit Event' : 'New Event'}</Text>

        <TextInput
          placeholder="Event name"
          value={title}
          onChangeText={setTitle}
          className="border p-2 mb-2"
          editable={editable}
        />

        <TextInput
          placeholder="Location"
          value={location}
          onChangeText={setLocation}
          className="border p-2 mb-2"
          editable={editable}
        />

        <TextInput
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
          className="border p-2 mb-4"
          editable={editable}
        />

        <Text className="mb-1 font-medium">Start Time</Text>
        <TouchableOpacity
          onPress={() => editable && setShowStartPicker(true)}
          className="border p-2 mb-2 rounded"
          disabled={!editable}
        >
          <Text>{startDate.toLocaleString()}</Text>
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

        <Text className="mb-1 font-medium">End Time</Text>
        <TouchableOpacity
          onPress={() => editable && setShowEndPicker(true)}
          className="border p-2 mb-4 rounded"
          disabled={!editable}
        >
          <Text>{endDate.toLocaleString()}</Text>
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

        {/* Invite Friends - only creator can invite */}
        <Text className="mb-1 font-medium">Invite Friends</Text>
        
          <View className="border rounded mb-4">
            {loading ? (
              <Text className="text-gray-400 p-2">Loading friends...</Text>
            ) : friends.length === 0 ? (
              <Text className="text-gray-400 p-2">You have no friends to invite.</Text>
            ) : editable ? (
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
              />
            ) : (
              <Text className="text-gray-400 p-2">Only the creator can invite friends.</Text>
            )}
          </View>

        {/* Show invited users */}
        {inviteeIds.length > 0 && (
          <View className="mb-4">
            <Text className="font-medium mb-1">Attending:</Text>
            {inviteeIds.map((id) => {
              const user = (users ?? []).find((u) => u.$id === id);
              return (
                <View key={id} className="flex-row justify-between items-center mb-1">
                  <Text>{user?.name || id}</Text>
                  {/* Only show remove button if creator and not self */}
                  {editable && id !== currentUserId && (
                    <Button
                      title="Remove"
                      color="red"
                      onPress={() => setInviteeIds(inviteeIds.filter((uid) => uid !== id))}
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Save/Update button only for creator or new event */}
        {editable && (
          <Button title={event ? 'Update Event' : 'Create Event'} onPress={handleSave} />
        )}

        {/* Delete button only for creator */}
        {event && isCreator && (
          <View className="mb-2">
            <Button
              title="Delete Event"
              color="red"
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
            />
          </View>
        )}

        {/* If not creator, show join/leave button */}
        {event && !isCreator && (
          <View className="mb-2">
            {inviteeIds.includes(currentUserId) ? (
              <Button
                title="Leave Event"
                color="orange"
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
              />
            ) : (
              <Button
                title="Join Event"
                color="green"
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
              />
            )}
          </View>
        )}

        <View className="mt-2">
          <Button title="Cancel" color="gray" onPress={onClose} />
        </View>
      </ScrollView>
    </Modal>
  );
}