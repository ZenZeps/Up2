import { View, TextInput, Modal, Button, Text, ScrollView } from 'react-native';
import React, { useState, useEffect } from 'react';
import RNPickerSelect from 'react-native-picker-select';
import { Event } from '../types/Events';
import { useAppwrite } from '@/lib/useAppwrite';
import { fetchAllUsers } from '@/lib/api/user';
import { databases, config } from '@/lib/appwrite';
import { ID } from 'react-native-appwrite';
import { useEvents } from '../context/EventContext'; // <-- import useEvents
import DateTimePickerModal from "react-native-modal-datetime-picker";
import dayjs from 'dayjs';

interface Props {
  visible: boolean;
  onClose: () => void;
  event?: Event;
  selectedDateTime: string;
  currentUserId: string;
}

const durationOptions = Array.from({ length: 12 }, (_, i) => (i + 1) * 15); // 15–180 mins

export default function EventForm({ visible, onClose, event, selectedDateTime, currentUserId }: Props) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState(60);
  const [description, setDescription] = useState('');
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [selectedInvitee, setSelectedInvitee] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date>(event ? new Date(event.dateTime) : new Date(selectedDateTime));
  const [endDate, setEndDate] = useState<Date>(
    event
      ? dayjs(event.dateTime).add(event.duration ?? 60, 'minute').toDate()
      : dayjs(selectedDateTime).add(60, 'minute').toDate()
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const { data: users = [], loading } = useAppwrite({
    fn: fetchAllUsers,
  });

  const { refetchEvents } = useEvents(); // <-- get refetchEvents

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setLocation(event.location || '');
      setDescription((event as any).description || '');
      setDuration(event.duration ?? 60);
      setInviteeIds(event.inviteeIds ?? []);
      setStartDate(new Date(event.dateTime));
      setEndDate(dayjs(event.dateTime).add(event.duration ?? 60, 'minute').toDate());
    } else {
      setTitle('');
      setLocation('');
      setDescription('');
      setDuration(60);
      setInviteeIds([]);
      setStartDate(new Date(selectedDateTime));
      setEndDate(dayjs(selectedDateTime).add(60, 'minute').toDate());
    }
  }, [event, selectedDateTime]);

  const handleSave = async () => {
    const duration = dayjs(endDate).diff(dayjs(startDate), 'minute');
    const newEvent: Event = {
      id: event?.id ?? ID.unique(),
      title,
      location,
      dateTime: startDate.toISOString(),
      duration,
      creatorId: currentUserId,
      inviteeIds,
    };

    const payload = {
      ...newEvent,
      description,
    };

    try {
      if (event) {
        await databases.updateDocument(
          config.databaseID!,
          config.eventsCollectionID!,
          event.id,
          payload
        );
      } else {
        await databases.createDocument(
          config.databaseID!,
          config.eventsCollectionID!,
          newEvent.id,
          payload
        );
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
        />

        <TextInput
          placeholder="Location"
          value={location}
          onChangeText={setLocation}
          className="border p-2 mb-2"
        />

        <TextInput
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
          className="border p-2 mb-4"
        />

        <Text className="mb-1 font-medium">Duration (minutes)</Text>
        <View className="border rounded mb-4">
          <RNPickerSelect
            onValueChange={setDuration}
            value={duration}
            items={durationOptions.map((min) => ({
              label: `${min} minutes`,
              value: min,
            }))}
          />
        </View>

        <Text className="mb-1 font-medium">Invite Friends</Text>
        <View className="border rounded mb-4">
          <RNPickerSelect
            onValueChange={(val: string | null) => {
              if (val && !inviteeIds.includes(val)) {
                setInviteeIds([...inviteeIds, val]);
              }
              setSelectedInvitee(null);
            }}
            value={selectedInvitee}
            placeholder={{ label: 'Select user to invite', value: null }}
            items={(users ?? []).filter((u) => u.id !== currentUserId && !inviteeIds.includes(u.id))
              .map((user) => ({
                label: user.name,
                value: user.id,
              }))}
          />
        </View>

        {inviteeIds.length > 0 && (
          <View className="mb-4">
            <Text className="font-medium mb-1">Invited:</Text>
            {inviteeIds.map((id) => {
              const user = (users ?? []).find((u) => u.id === id);
              return (
                <View key={id} className="flex-row justify-between items-center mb-1">
                  <Text>{user?.name || id}</Text>
                  <Button
                    title="Remove"
                    color="red"
                    onPress={() => setInviteeIds(inviteeIds.filter((uid) => uid !== id))}
                  />
                </View>
              );
            })}
          </View>
        )}

        <Button title={event ? 'Update Event' : 'Create Event'} onPress={handleSave} />
        <View className="mt-2">
          <Button title="Cancel" color="gray" onPress={onClose} />
        </View>
      </ScrollView>
    </Modal>
  );
}
// This code defines an EventForm component that allows users to create or edit events.