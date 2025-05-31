// components/EventForm.tsx
import { View, TextInput, Modal, Button, Text } from 'react-native';
import React, { useState, useEffect } from 'react';
import RNPickerSelect from 'react-native-picker-select';
import { Event } from '../types/Events';
import { useEvents } from '../context/EventContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  event?: Event;
  selectedDateTime: string;
}

const durationOptions = Array.from({ length: 12 }, (_, i) => (i + 1) * 15); // 15 to 180 mins

export default function EventForm({ visible, onClose, event, selectedDateTime }: Props) {
  const { addEvent, updateEvent } = useEvents();

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState(60); // default to 60 mins

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setLocation(event.location);
      setDuration(event.duration ?? 60);
    } else {
      setTitle('');
      setLocation('');
      setDuration(60);
    }
  }, [event]);

  const handleSave = () => {
    const newEvent: Event = {
      id: event?.id ?? Date.now().toString(),
      title,
      location,
      dateTime: selectedDateTime,
      duration,
    };

    event ? updateEvent(newEvent) : addEvent(newEvent);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View className="p-4">
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

        <Button title={event ? 'Update' : 'Add Event'} onPress={handleSave} />
        <View className="mt-2">
          <Button title="Cancel" color="gray" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
