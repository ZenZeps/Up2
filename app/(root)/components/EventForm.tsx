import { CATEGORIES } from '@/constants/categories';
import { getAllUsers } from '@/lib/api/user';
import { config, databases } from '@/lib/appwrite/appwrite';
import { Event } from '@/lib/types/Events';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useEvents } from '../context/EventContext';

// Conditional imports for third-party libraries
let DateTimePickerModal: any;
let RNPickerSelect: any;

try {
  DateTimePickerModal = require("react-native-modal-datetime-picker").default;
  RNPickerSelect = require('react-native-picker-select').default;
} catch (error) {
  console.error('Error importing third-party libraries:', error);
  // Fallback components will be used
}

// Fallback components for when third-party libraries fail
const FallbackDateTimePicker = ({ isVisible, onConfirm, onCancel, date, mode }: any) => {
  if (!isVisible) return null;
  
  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{ backgroundColor: 'white', padding: 20, borderRadius: 10, width: '80%' }}>
          <Text style={{ fontSize: 16, marginBottom: 10 }}>Date/Time Picker</Text>
          <Text style={{ marginBottom: 20 }}>Current: {dayjs(date).format('MMM D, YYYY h:mm A')}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <TouchableOpacity onPress={onCancel} style={{ padding: 10, backgroundColor: '#ccc', borderRadius: 5 }}>
              <Text>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onConfirm(date)} style={{ padding: 10, backgroundColor: '#007AFF', borderRadius: 5 }}>
              <Text style={{ color: 'white' }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const FallbackPickerSelect = ({ items, onValueChange, value, placeholder, style, disabled }: any) => {
  const [modalVisible, setModalVisible] = useState(false);
  
  const selectedItem = items.find((item: any) => item.value === value);
  
  return (
    <>
      <TouchableOpacity 
        onPress={() => !disabled && setModalVisible(true)}
        style={[
          { padding: 12, borderBottomWidth: 1, borderBottomColor: '#D1D5DB' },
          style?.inputIOS || style?.inputAndroid
        ]}
        disabled={disabled}
      >
        <Text style={{ color: selectedItem ? 'black' : '#A0A0A0' }}>
          {selectedItem ? selectedItem.label : placeholder?.label || 'Select...'}
        </Text>
      </TouchableOpacity>
      
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: 'white', maxHeight: '60%', width: '80%', borderRadius: 10 }}>
            <View style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Select Option</Text>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {items.map((item: any) => (
                <TouchableOpacity 
                  key={item.value} 
                  onPress={() => {
                    onValueChange(item.value);
                    setModalVisible(false);
                  }}
                  style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
                >
                  <Text>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              onPress={() => setModalVisible(false)}
              style={{ padding: 15, alignItems: 'center' }}
            >
              <Text style={{ color: '#007AFF', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

interface Props {
  visible: boolean;
  onClose: () => void;
  event?: Event;
  selectedDateTime: string;
  currentUserId: string;
  friends: string[];
}

export default function EventForm({ visible, onClose, event, selectedDateTime, currentUserId, friends }: Props) {
  console.log('=== EventForm: Starting render ===');
  console.log('EventForm: Component rendering with props', { 
    visible, 
    hasEvent: !!event, 
    selectedDateTime, 
    currentUserId, 
    friendsCount: friends?.length || 0 
  });

  // Add additional library availability checks
  console.log('EventForm: Checking third-party library availability...');
  console.log('DateTimePickerModal available:', !!DateTimePickerModal);
  console.log('RNPickerSelect available:', !!RNPickerSelect);

  try {
    console.log('EventForm: Checking visibility...');
    // Add safety checks for props
    if (!visible) {
      console.log('EventForm: Not visible, returning null');
      return null;
    }

    console.log('EventForm: Checking currentUserId...');
    if (!currentUserId) {
      console.error('EventForm: currentUserId is required');
      return null;
    }

    console.log('EventForm: Checking friends array...');
    if (!friends || !Array.isArray(friends)) {
      console.error('EventForm: friends array is required');
      return null;
    }

    console.log('EventForm: All prop checks passed, continuing...');
  } catch (error) {
    console.error('EventForm: Error in prop validation:', error);
    return null;
  }

  console.log('EventForm: Initializing state...');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [selectedInvitee, setSelectedInvitee] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  console.log('EventForm: Basic state initialized');
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

  console.log('EventForm: Initializing date state...');
  const [startDate, setStartDate] = useState<Date>(() => {
    try {
      console.log('EventForm: Calculating start date...');
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
      console.log('EventForm: Calculating end date...');
      if (event && event.endTime) {
        return safeParseDate(event.endTime);
      }
      // Default to 1 hour after start time
      const startTime = safeParseDate(selectedDateTime);
      return calculateEndTime(startTime, 60); // Default 1 hour duration
    } catch (error) {
      console.warn('Error initializing end date:', error);
      return new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    }
  });
  console.log('EventForm: Date state initialized');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        console.log('EventForm: Fetching users...');
        const allUsers = await getAllUsers();
        console.log('EventForm: Users fetched successfully', { count: allUsers.length });
        setUsers(allUsers);
      } catch (err) {
        console.error('EventForm: Error fetching users:', err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if the modal is visible and we don't have users yet
    if (visible && users.length === 0) {
      const timeoutId = setTimeout(() => {
        fetchUsers();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [visible, users.length]);

  const friendUsers = users.filter(
    (u) =>
      u.$id !== currentUserId &&
      friends.includes(u.$id) &&
      !inviteeIds.includes(u.$id)
  );

  const isCreator = event?.creatorId === currentUserId;

  const editable = !event || isCreator;

  console.log('EventForm: Accessing EventContext...');
  // Safely access EventContext
  const { refetchEvents, addEvent, updateEvent } = useEvents();
  console.log('EventForm: EventContext accessed successfully');

  // Test function to diagnose the issue (development only)
  const runDiagnosticTest = async () => {
    try {
      console.log('=== Running Event Creation Diagnostic Test ===');
      
      // Simple database configuration check
      console.log('Config test: Checking environment variables...');
      const hasRequiredConfig = !!(
        config.databaseID && 
        config.eventsCollectionID && 
        config.usersCollectionID
      );
      
      if (!hasRequiredConfig) {
        alert('Configuration Error: Missing required environment variables');
        return;
      }
      
      console.log('Config test: OK');
      
      // Test third-party library availability
      console.log('Library test: Checking third-party libraries...');
      console.log('DateTimePickerModal:', !!DateTimePickerModal ? 'Available' : 'Missing');
      console.log('RNPickerSelect:', !!RNPickerSelect ? 'Available' : 'Missing');
      
      // Test context availability
      console.log('Context test: Checking EventContext...');
      const hasContext = typeof refetchEvents === 'function' && typeof addEvent === 'function' && typeof updateEvent === 'function';
      console.log('EventContext functions:', hasContext ? 'Available' : 'Missing');
      
      // Test user data
      console.log('User test: Checking user data...');
      console.log('Users loaded:', users.length);
      console.log('Friends available:', friendUsers.length);
      
      console.log('=== Diagnostic Test Complete ===');
      alert(`Diagnostic test completed successfully!\n\nLibraries: ${DateTimePickerModal ? '✓' : '✗'} DatePicker, ${RNPickerSelect ? '✓' : '✗'} Picker\nContext: ${hasContext ? '✓' : '✗'} Available\nUsers: ${users.length} loaded\nFriends: ${friendUsers.length} available`);
      
    } catch (error) {
      console.error('Diagnostic test crashed:', error);
      alert(`Diagnostic test crashed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

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
    try {
      setTags(prev =>
        prev.includes(tagValue)
          ? prev.filter(t => t !== tagValue)
          : [...prev, tagValue]
      );
    } catch (error) {
      console.error('Error handling tag toggle:', error);
    }
  };

  const handleSave = async () => {
    // Prevent multiple simultaneous saves
    if (isProcessing) {
      console.log('Already processing, skipping save');
      return;
    }
    
    console.log('=== Starting Event Save Process ===');
    setIsProcessing(true);

    try {
      console.log('Step 1: Checking event context...');
      // Check if event context functions are available
      if (!refetchEvents || !addEvent || !updateEvent) {
        console.error('Event context functions are not available');
        throw new Error('Event context functions are not available');
      }
      console.log('Step 1: Event context OK');

      console.log('Step 2: Validating required fields...');
      // Validate required fields
      if (!title.trim()) {
        console.log('Step 2: Title validation failed');
        alert("Event title is required");
        return;
      }

      if (!startDate || !endDate) {
        console.log('Step 2: Date validation failed');
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

      // Validate currentUserId
      if (!currentUserId) {
        alert("User authentication required");
        return;
      }

      // Create the event object with safe date conversion
      const eventData = {
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

      // Use a try-catch specifically for the event operations
      try {
        if (event && event.$id) {
          // Update existing event using EventContext
          console.log("Updating existing event:", event.$id);
          await updateEvent({
            ...eventData,
            $id: event.$id,
          } as Event);
          console.log("Event updated successfully");
        } else {
          // Create new event using EventContext
          console.log("Creating new event");
          await addEvent(eventData);
          console.log("Event created successfully");
        }

        // Close the modal only after successful save
        onClose();
      } catch (eventError) {
        console.error("Event operation failed:", eventError);
        // Don't close the modal if the event operation fails
        throw eventError;
      }

    } catch (err) {
      console.error("Error saving event:", err);

      // More specific error handling
      let errorMessage = "Failed to save event";

      if (err instanceof Error) {
        if (err.message.includes('network')) {
          errorMessage = "Network error - please check your connection";
        } else if (err.message.includes('permission')) {
          errorMessage = "Permission denied - you may not have access to perform this action";
        } else if (err.message.includes('validation')) {
          errorMessage = "Invalid event data - please check your input";
        } else if (err.message.includes('database')) {
          errorMessage = "Database error - please try again later";
        } else {
          errorMessage = err.message;
        }
      }

      // Use a more gentle alert that won't crash the app
      setTimeout(() => {
        alert(`Error: ${errorMessage}`);
      }, 100);
    } finally {
      setIsProcessing(false);
    }
  };  // Handle date picker confirmations with proper time handling
  const handleStartDateConfirm = (date: Date) => {
    try {
      setShowStartPicker(false);
      setStartDate(date);

      // Update end date to maintain at least 1 hour duration if it was before the new start date
      if (endDate <= date) {
        setEndDate(calculateEndTime(date, 60)); // Default 1 hour
      }
    } catch (error) {
      console.error('Error handling start date confirm:', error);
      setShowStartPicker(false);
    }
  };

  const handleEndDateConfirm = (date: Date) => {
    try {
      setShowEndPicker(false);

      // Make sure end date is after start date
      if (date > startDate) {
        setEndDate(date);
      } else {
        // If selected end date is before start date, set it to start date + 1 hour
        setEndDate(calculateEndTime(startDate, 60));
        alert('End time must be after start time');
      }
    } catch (error) {
      console.error('Error handling end date confirm:', error);
      setShowEndPicker(false);
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
              <TouchableOpacity onPress={handleSave} className="p-2" disabled={isProcessing}>
                <Text className={`text-lg font-semibold ${isProcessing ? 'text-gray-400' : 'text-blue-500'}`}>
                  {isProcessing ? 'Saving...' : 'Done'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView className="flex-1 p-4">
            {/* Production error indicator */}
            {(!DateTimePickerModal || !RNPickerSelect) && (
              <View className="bg-yellow-100 border border-yellow-400 rounded-lg p-3 mb-4">
                <Text className="text-yellow-800 text-sm">
                  ⚠️ Using fallback components for better compatibility
                </Text>
              </View>
            )}
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

            {/* Diagnostic Test Button for Development */}
            {__DEV__ && (
              <TouchableOpacity
                onPress={runDiagnosticTest}
                className="bg-yellow-500 p-3 rounded-lg mb-4"
              >
                <Text className="text-white text-center font-semibold">
                  Run Diagnostic Test
                </Text>
              </TouchableOpacity>
            )}

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
                onPress={() => {
                  try {
                    if (editable) {
                      setShowStartPicker(true);
                    }
                  } catch (error) {
                    console.error('Error opening start picker:', error);
                  }
                }}
                className="border border-gray-300 p-3 rounded-lg"
                disabled={!editable}
              >
                <Text className="text-lg">{dayjs(startDate).format('MMM D, YYYY h:mm A')}</Text>
              </TouchableOpacity>
              {DateTimePickerModal ? (
                <DateTimePickerModal
                  isVisible={showStartPicker}
                  mode="datetime"
                  date={startDate}
                  onConfirm={handleStartDateConfirm}
                  onCancel={() => {
                    try {
                      setShowStartPicker(false);
                    } catch (error) {
                      console.error('Error canceling start picker:', error);
                    }
                  }}
                />
              ) : (
                <FallbackDateTimePicker
                  isVisible={showStartPicker}
                  mode="datetime"
                  date={startDate}
                  onConfirm={handleStartDateConfirm}
                  onCancel={() => {
                    try {
                      setShowStartPicker(false);
                    } catch (error) {
                      console.error('Error canceling start picker:', error);
                    }
                  }}
                />
              )}
            </View>

            <View className="mb-4">
              <Text className="text-gray-600 text-base mb-2">End Time</Text>
              <TouchableOpacity
                onPress={() => {
                  try {
                    if (editable) {
                      setShowEndPicker(true);
                    }
                  } catch (error) {
                    console.error('Error opening end picker:', error);
                  }
                }}
                className="border border-gray-300 p-3 rounded-lg"
                disabled={!editable}
              >
                <Text className="text-lg">{dayjs(endDate).format('MMM D, YYYY h:mm A')}</Text>
              </TouchableOpacity>
              {DateTimePickerModal ? (
                <DateTimePickerModal
                  isVisible={showEndPicker}
                  mode="datetime"
                  date={endDate}
                  minimumDate={startDate}
                  onConfirm={handleEndDateConfirm}
                  onCancel={() => {
                    try {
                      setShowEndPicker(false);
                    } catch (error) {
                      console.error('Error canceling end picker:', error);
                    }
                  }}
                />
              ) : (
                <FallbackDateTimePicker
                  isVisible={showEndPicker}
                  mode="datetime"
                  date={endDate}
                  onConfirm={handleEndDateConfirm}
                  onCancel={() => {
                    try {
                      setShowEndPicker(false);
                    } catch (error) {
                      console.error('Error canceling end picker:', error);
                    }
                  }}
                />
              )}
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
                  {RNPickerSelect ? (
                    <RNPickerSelect
                      onValueChange={(val: string | null) => {
                        try {
                          if (val && !inviteeIds.includes(val)) {
                            setInviteeIds([...inviteeIds, val]);
                          }
                          setSelectedInvitee(null);
                        } catch (error) {
                          console.error('Error handling picker value change:', error);
                        }
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
                  ) : (
                    <FallbackPickerSelect
                      onValueChange={(val: string | null) => {
                        try {
                          if (val && !inviteeIds.includes(val)) {
                            setInviteeIds([...inviteeIds, val]);
                          }
                          setSelectedInvitee(null);
                        } catch (error) {
                          console.error('Error handling fallback picker value change:', error);
                        }
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
                      }}
                      disabled={false}
                    />
                  )}
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