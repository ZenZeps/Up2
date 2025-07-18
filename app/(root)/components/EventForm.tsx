import { CATEGORIES } from '@/constants/categories';
import { createEvent } from '@/lib/api/event';
import { getAllUsers } from '@/lib/api/user';
import { config, databases, ID } from '@/lib/appwrite/appwrite';
import { Event } from '@/lib/types/Events';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import RNPickerSelect from 'react-native-picker-select';
import { useEvents } from '../context/EventContext';

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
  const [tags, setTags] = useState<string[]>([]);
  // Safely parse date with validation and proper time information
  const safeParseDate = (dateString: string): Date => {
    try {
      if (!dateString) {
        console.warn('Empty date string provided, using current date');
        return new Date();
      }

      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString, 'using current date');
        return new Date();
      }
      return date;
    } catch (error) {
      // Return current date if parsing fails
      console.warn('Failed to parse date:', dateString, error);
      return new Date();
    }
  };

  // Calculate end time based on start time and duration
  const calculateEndTime = (start: Date, durationMinutes: number): Date => {
    return new Date(start.getTime() + durationMinutes * 60000);
  };

  const [startDate, setStartDate] = useState<Date>(() => {
    try {
      if (event && event.startTime) {
        return safeParseDate(event.startTime);
      }
      return safeParseDate(selectedDateTime);
    } catch (error) {
      console.warn('Error initializing start date:', error);
      return new Date();
    }
  });

  const [endDate, setEndDate] = useState<Date>(() => {
    try {
      if (event && event.endTime) {
        return safeParseDate(event.endTime);
      }
      return calculateEndTime(safeParseDate(selectedDateTime), duration);
    } catch (error) {
      console.warn('Error initializing end date:', error);
      return new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    }
  });
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
      setTags(event.tags || []);

      // Safely set dates with validation
      try {
        const startTime = new Date(event.startTime);
        const endTime = new Date(event.endTime);

        if (!isNaN(startTime.getTime())) {
          setStartDate(startTime);
        }

        if (!isNaN(endTime.getTime())) {
          setEndDate(endTime);
        }
      } catch (error) {
        console.error('Error parsing event dates:', error);
      }
    } else {
      setTitle('');
      setLocation('');
      setDescription('');
      setInviteeIds([]);
      setTags([]);

      // Safely set default dates
      try {
        const newStartDate = new Date(selectedDateTime);
        if (!isNaN(newStartDate.getTime())) {
          setStartDate(newStartDate);
          setEndDate(dayjs(newStartDate).add(1, 'hour').toDate());
        }
      } catch (error) {
        console.error('Error setting default dates:', error);
        setStartDate(new Date());
        setEndDate(dayjs().add(1, 'hour').toDate());
      }
    }
  }, [event, selectedDateTime]);


  // Handle tag selection
  const handleTagToggle = (tagValue: string) => {
    setTags(prev =>
      prev.includes(tagValue)
        ? prev.filter(t => t !== tagValue)
        : [...prev, tagValue]
    );
  };

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!title.trim()) {
        alert("Event title is required");
        return;
      }

      if (!startDate || !endDate) {
        alert("Start and end dates are required");
        return;
      }

      if (startDate >= endDate) {
        alert("End date must be after start date");
        return;
      }

      // Validate dates are valid
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        alert("Invalid date selected");
        return;
      }

      // Create the event object with safe date conversion
      const eventData: Event = {
        $id: event?.$id || ID.unique(),
        id: event?.$id || ID.unique(),
        title: title.trim(),
        location: location.trim(),
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        creatorId: currentUserId,
        inviteeIds: inviteeIds.filter(id => id && id.trim()), // Filter out empty IDs
        attendees: event?.attendees || [],
        description: description.trim(),
        tags: tags.filter(tag => tag && tag.trim()), // Filter out empty tags
      };

      console.log("Saving event with data:", eventData);

      if (event && event.$id) {
        // Update existing event
        await databases.updateDocument(
          config.databaseID!,
          config.eventsCollectionID!,
          event.$id,
          eventData
        );
        console.log("Event updated successfully");
      } else {
        // Create new event
        await createEvent(eventData);
        console.log("Event created successfully");
      }

      await refetchEvents();
      onClose();
    } catch (err) {
      console.error("Error saving event:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to save event";
      alert(`Error: ${errorMessage}`);
    }
  };

  // Handle date picker confirmations with proper time handling
  const handleStartDateConfirm = (date: Date) => {
    setShowStartPicker(false);
    setStartDate(date);

    // Update end date based on duration if it was before the new start date
    if (endDate <= date) {
      setEndDate(calculateEndTime(date, duration));
    }
  };

  const handleEndDateConfirm = (date: Date) => {
    setShowEndPicker(false);

    // Make sure end date is after start date
    if (date > startDate) {
      setEndDate(date);

      // Update duration based on new end time
      const newDurationMinutes = Math.round((date.getTime() - startDate.getTime()) / 60000);
      if (newDurationMinutes > 0 && newDurationMinutes <= 180) {
        setDuration(newDurationMinutes);
      }
    } else {
      // If selected end date is before start date, set it to start date + duration
      setEndDate(calculateEndTime(startDate, duration));
      alert('End time must be after start time');
    }
  };

  // Handle duration changes
  const handleDurationChange = (newDuration: number) => {
    setDuration(newDuration);
    setEndDate(calculateEndTime(startDate, newDuration));
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

          {/* Tags Section */}
          <View className="mb-4">
            <Text className="text-gray-600 text-base mb-2">Event Tags</Text>
            <View className="flex-row flex-wrap">
              {CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  onPress={() => editable && handleTagToggle(category.value)}
                  className={`px-3 py-2 rounded-full border mr-2 mb-2 flex-row items-center`}
                  style={{
                    backgroundColor: tags.includes(category.value) ? '#007AFF' : '#F5F5F5',
                    borderColor: tags.includes(category.value) ? '#007AFF' : '#E0E0E0',
                  }}
                  disabled={!editable}
                >
                  <Text className="mr-1">{category.emoji}</Text>
                  <Text
                    style={{
                      color: tags.includes(category.value) ? 'white' : '#333',
                      fontSize: 14,
                    }}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

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
              onConfirm={handleStartDateConfirm}
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
              onConfirm={handleEndDateConfirm}
              onCancel={() => setShowEndPicker(false)}
            />
          </View>

          {/* Add Duration Picker */}
          <View className="mb-4">
            <Text className="text-gray-600 text-base mb-2">Duration (minutes)</Text>
            <View className="border border-gray-300 rounded-lg overflow-hidden">
              <RNPickerSelect
                onValueChange={(val: number) => {
                  if (val && editable) {
                    handleDurationChange(val);
                  }
                }}
                value={duration}
                disabled={!editable}
                items={durationOptions.map((mins) => ({
                  label: `${mins} minutes`,
                  value: mins,
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
                }}
              />
            </View>
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
                    label: userDisplayUtils.getFullName(user),
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
                    <Text className="text-base">{userDisplayUtils.getFullName(user, id)}</Text>
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