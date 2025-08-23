import { CATEGORIES } from '@/constants/categories';
import { addEventAttendee, addEventInvitation, removeEventAttendee } from '@/lib/api/event';
import { addEventToGroup } from '@/lib/api/group';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getFriends, getUserProfile } from '@/lib/api/user';
import { config, databases } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { sendEventInviteNotification } from '@/lib/notifications/notificationUtils';
import { Event } from '@/lib/types/Events';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useEvents } from '../context/EventContext';
import PlaceAutocomplete from './PlaceAutocomplete';
import UserAvatar from './UserAvatar';

// Conditional imports for third-party libraries
let DateTimePickerModal: any;

try {
  DateTimePickerModal = require("react-native-modal-datetime-picker").default;
} catch (error) {
  console.error('Failed to load DateTimePickerModal:', error);
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

interface Props {
  visible: boolean;
  onClose: () => void;
  event?: Event;
  selectedDateTime: string;
  currentUserId: string;
  friends: string[];
  groupId?: string;
}

export default function EventForm({ visible, onClose, event, selectedDateTime, currentUserId, friends, groupId }: Props) {
  // Basic state initialization
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  // Friend invitation state - enhanced approach
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friendProfiles, setFriendProfiles] = useState<any[]>([]);
  const [friendPhotoUrls, setFriendPhotoUrls] = useState<Record<string, string | null>>({});
  const [loadingFriends, setLoadingFriends] = useState(false);

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

  // Date state initialization
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
      // Default to 1 hour after start time
      const startTime = safeParseDate(selectedDateTime);
      return calculateEndTime(startTime, 60); // Default 1 hour duration
    } catch (error) {
      console.warn('Error initializing end date:', error);
      return new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    }
  });

  // EventContext access
  const eventContext = useEvents();
  const { refetchEvents, addEvent, updateEvent } = eventContext;

  const { colors } = useTheme();

  // Validation checks (only run when component first renders)
  useEffect(() => {
    console.log('EventForm: Component mounted with props', {
      visible,
      hasEvent: !!event,
      selectedDateTime,
      currentUserId,
      friendsCount: friends?.length || 0
    });

    if (!visible) {
      console.log('EventForm: Not visible');
      return;
    }

    if (!currentUserId) {
      console.error('EventForm: currentUserId is required');
      return;
    }

    console.log('EventForm: Validation passed');
  }, [visible, currentUserId, !!event, selectedDateTime]); // Remove friends?.length dependency

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setLocation(event.location || '');
      setDescription(event.description || '');
      setTags(event.tags || []);
      setInviteeIds(event.inviteeIds || []);
      setIsPrivate(event.isPrivate === true); // Fix: properly handle boolean value

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
      setTags([]);
      setInviteeIds([]);
      setIsPrivate(false);

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

  // Early return for visibility check
  if (!visible) {
    return null;
  }

  // Early return for missing currentUserId
  if (!currentUserId) {
    console.error('EventForm: currentUserId is required');
    return null;
  }

  const isCreator = event?.creatorId === currentUserId;
  const editable = !event || isCreator;

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

      // Test context availability
      console.log('Context test: Checking EventContext...');
      const hasContext = typeof refetchEvents === 'function' && typeof addEvent === 'function' && typeof updateEvent === 'function';
      console.log('EventContext functions:', hasContext ? 'Available' : 'Missing');

      console.log('=== Diagnostic Test Complete ===');
      console.log(`Diagnostic test completed successfully!\n\nLibraries: ${DateTimePickerModal ? '✓' : '✗'} DatePicker\nContext: ${hasContext ? '✓' : '✗'} Available\nFriends: ${friends.length} total`);

    } catch (error) {
      console.error('Diagnostic test crashed:', error);
      console.log(`Diagnostic test crashed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Load friend profiles when friend picker is opened
  const loadFriendProfiles = async () => {
    try {
      setLoadingFriends(true);
      const friendsList = await getFriends(currentUserId);

      // Filter out friends who are already invited
      const availableFriends = friendsList.filter(friend =>
        !inviteeIds.includes(friend.$id) && friend.$id !== currentUserId
      );

      setFriendProfiles(availableFriends);

      // Fetch photos for friends
      const photoUrls: Record<string, string | null> = {};
      for (const friend of availableFriends) {
        try {
          const photoUrl = await getUserProfilePhotoUrl(friend.$id);
          photoUrls[friend.$id] = photoUrl;
        } catch (error) {
          console.error('Error fetching friend photo:', error);
          photoUrls[friend.$id] = null;
        }
      }
      setFriendPhotoUrls(photoUrls);
    } catch (error) {
      console.error('Error loading friends:', error);
      Alert.alert('Error', 'Failed to load friends list');
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleOpenFriendPicker = () => {
    loadFriendProfiles();
    setShowFriendPicker(true);
  };


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
        // Include coordinates when available for precise mapping
        ...(locationLat !== null && locationLng !== null ? { locationLat, locationLng } : {}),
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        creatorId: currentUserId,
        description: description.trim(),
        tags: tags.filter(tag => tag && tag.trim()), // Filter out empty tags
        isPrivate: isPrivate,
        groupId: groupId || undefined, // Include group ID if provided
      };

      // Do not include inviteeIds in the initial create payload; we'll create invitations after event is created

      console.log("Saving event with data:", eventData);

      // Use a try-catch specifically for the event operations
      try {
        let savedEvent: Event;

        if (event && event.$id) {
          // Update existing event using EventContext
          console.log("Updating existing event:", event.$id);
          await updateEvent({
            ...eventData,
            $id: event.$id,
          } as Event);
          console.log("Event updated successfully");
          savedEvent = { ...eventData, $id: event.$id } as Event;
        } else {
          // Create new event using EventContext
          console.log("Creating new event");
          savedEvent = await addEvent(eventData as any); // Cast to any since addEvent creates the $id internally
          console.log("Event created successfully with ID:", savedEvent.$id);

          // Create invitations in junction table for selected invitees
          if (inviteeIds && inviteeIds.length > 0 && savedEvent.$id) {
            try {
              // Create invitation records
              for (const uid of inviteeIds) {
                try {
                  await addEventInvitation(savedEvent.$id, uid);
                } catch (e) {
                  console.warn('Failed to create invitation for', uid, e);
                }
              }

              // Send push notifications to invitees (best-effort)
              try {
                const creatorProfile = await getUserProfile(currentUserId);
                const creatorName = creatorProfile ? `${creatorProfile.firstName || ''} ${creatorProfile.lastName || ''}`.trim() : '';
                await sendEventInviteNotification(inviteeIds, savedEvent.title || eventData.title, creatorName, savedEvent.$id);
              } catch (notifyErr) {
                console.warn('Failed to send invite notifications:', notifyErr);
              }
            } catch (invErr) {
              console.warn('Error creating invitations for new event:', invErr);
            }
          }
        }

        // If this event is being created for a group, associate it with the group
        if (groupId && savedEvent.$id) {
          console.log("Associating event with group:", groupId);
          const success = await addEventToGroup(groupId, savedEvent.$id);
          if (!success) {
            console.warn("Failed to associate event with group, but event was created");
          } else {
            console.log("Event successfully associated with group");
          }
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
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 bg-black">
          <TouchableOpacity onPress={onClose} className="p-2">
            <Text className="text-white text-lg">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-xl font-bold text-white">{event ? 'Edit Event' : 'New Event'}</Text>
          {editable && (
            <TouchableOpacity onPress={handleSave} className="p-2" disabled={isProcessing}>
              <Text className={`text-lg font-semibold ${isProcessing ? 'text-gray-400' : 'text-white'}`}>
                {isProcessing ? 'Saving...' : 'Done'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Production error indicator */}
          {!DateTimePickerModal && (
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

          <PlaceAutocomplete
            value={location}
            onChangeText={(v: string) => {
              setLocation(v);
              setLocationLat(null);
              setLocationLng(null);
            }}
            onSelect={(address: string, lat?: number, lng?: number) => {
              setLocation(address);
              if (typeof lat === 'number' && typeof lng === 'number') {
                setLocationLat(lat);
                setLocationLng(lng);
              }
            }}
            placeholder="Location"
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 4 }}
            >
              {CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  onPress={() => editable && handleTagToggle(category.value)}
                  className={`px-3 py-2 rounded-full border mr-3 flex-row items-center`}
                  style={{
                    backgroundColor: tags.includes(category.value) ? '#000000' : '#F5F5F5',
                    borderColor: tags.includes(category.value) ? '#000000' : '#E0E0E0',
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
            </ScrollView>
          </View>

          {/* Privacy Section */}
          <View className="mb-4">
            <Text className="text-gray-600 text-base mb-2">Privacy</Text>
            <TouchableOpacity
              onPress={() => editable && setIsPrivate(!isPrivate)}
              className="flex-row items-center"
              disabled={!editable}
            >
              <View className={`w-6 h-6 rounded border-2 mr-3 items-center justify-center ${isPrivate ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                }`}>
                {isPrivate && (
                  <Text className="text-white text-sm font-bold">✓</Text>
                )}
              </View>
              <View>
                <Text className="text-lg">Private Event</Text>
                <Text className="text-gray-500 text-sm">
                  Only invited users can see this event
                </Text>
              </View>
            </TouchableOpacity>
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

          {/* Invite Friends Section - Enhanced */}
          <View className="mb-4">
            <Text className="text-gray-600 text-base mb-2">Invite Friends</Text>
            {editable ? (
              <TouchableOpacity
                onPress={handleOpenFriendPicker}
                className="border border-gray-300 p-3 rounded-lg"
              >
                <Text className="text-lg">Select friends to invite...</Text>
              </TouchableOpacity>
            ) : (
              <Text className="text-gray-400 p-3">Only the creator can invite friends.</Text>
            )}
          </View>

          {/* Show invited users */}
          {inviteeIds.length > 0 && (
            <View className="mb-4">
              <Text className="text-gray-600 text-base mb-2">Invited:</Text>
              {inviteeIds.map((id) => {
                // Simple display using ID for now - will be resolved by database lookup
                const displayName = `Friend (${id.slice(-4)})`;
                return (
                  <View key={id} className="flex-row justify-between items-center bg-gray-100 p-3 rounded-lg mb-2">
                    <Text className="text-base">{displayName}</Text>
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

          {/* Enhanced Friend Picker Modal */}
          <Modal
            visible={showFriendPicker}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowFriendPicker(false)}
          >
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}>
                <TouchableOpacity onPress={() => setShowFriendPicker(false)}>
                  <Text style={{
                    fontSize: 18,
                    fontWeight: '500',
                    color: colors.text,
                  }}>Cancel</Text>
                </TouchableOpacity>
                <Text style={{
                  fontSize: 20,
                  fontWeight: '600',
                  color: colors.text,
                }}>Invite Friends</Text>
                <View style={{ width: 60 }} />
              </View>

              {loadingFriends ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text>Loading friends...</Text>
                </View>
              ) : (
                <FlatList
                  data={friendProfiles}
                  keyExtractor={(item) => item.$id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => {
                        setInviteeIds([...inviteeIds, item.$id]);
                        setShowFriendPicker(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: '#F3F4F6',
                      }}
                    >
                      <UserAvatar
                        photoUrl={friendPhotoUrls[item.$id]}
                        firstName={item.firstName}
                        lastName={item.lastName}
                        name={item.name}
                        size={40}
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: colors.text,
                        }}>
                          {userDisplayUtils.getFullName(item) || item.name}
                        </Text>
                      </View>
                      <Text style={{
                        color: colors.primary,
                        fontSize: 16,
                        fontWeight: '500',
                      }}>
                        Invite
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={{
                      flex: 1,
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: 32,
                    }}>
                      <Text style={{
                        color: '#6B7280',
                        textAlign: 'center',
                        fontSize: 16,
                      }}>
                        No friends available to invite
                      </Text>
                    </View>
                  }
                />
              )}
            </SafeAreaView>
          </Modal>

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
              className="bg-black p-3 rounded-lg items-center mb-4"
            >
              <Text className="text-white text-lg font-semibold">Delete Event</Text>
            </TouchableOpacity>
          )}

          {/* Join/Leave event functionality */}
          {event && !isCreator && (
            <View className="mb-4">
              {inviteeIds.includes(currentUserId) || event?.attendees?.includes(currentUserId) ? (
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      // Remove user attendance/invitation using junction helpers
                      await removeEventAttendee(event.$id, currentUserId);
                      // Also remove from local invitee state if present
                      setInviteeIds(inviteeIds.filter((id) => id !== currentUserId));
                      await refetchEvents();
                      onClose();
                    } catch (err) {
                      console.error("Error leaving event:", err);
                      alert("Failed to leave event.");
                    }
                  }}
                  className="bg-orange-500 p-3 rounded-lg items-center"
                >
                  <Text className="text-white text-lg font-semibold">Leave Event</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      // Mark user as attending using junction helper
                      await addEventAttendee(event.$id, currentUserId);
                      // Optionally add to local invitee state for UX
                      setInviteeIds([...inviteeIds, currentUserId]);
                      await refetchEvents();
                      onClose();
                    } catch (err) {
                      console.error("Error joining event:", err);
                      alert("Failed to join event.");
                    }
                  }}
                  className="bg-green-500 p-3 rounded-lg items-center"
                >
                  <Text className="text-white text-lg font-semibold">Join Event</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Join/Leave event functionality - REMOVED */}
          {/* Event participation management has been removed */}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

}