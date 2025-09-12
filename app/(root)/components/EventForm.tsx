import { CATEGORIES } from '@/constants/categories';
import { addEventAttendee, addEventInvitation, removeEventAttendee } from '@/lib/api/event';
import { getUserFriends } from '@/lib/api/friendship';
import { addEventToGroup } from '@/lib/api/group';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getUsersByIds } from '@/lib/api/user';
import { config, databases } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { Event } from '@/lib/types/Events';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useEvents } from '../context/EventContext';
import BudgetPlaceAutocomplete from './BudgetPlaceAutocomplete';
import GoogleCalendarDatePicker from './GoogleCalendarDatePicker';
import PlaceAutocomplete from './PlaceAutocomplete';
import UserAvatar from './UserAvatar';

// Budget-conscious location service configuration
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
const USE_BUDGET_MODE = !GOOGLE_PLACES_API_KEY; // Use free OpenStreetMap if no Google API key

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
      <View style={styles.fallbackPickerOverlay}>
        <View style={styles.fallbackPickerContainer}>
          <View style={styles.fallbackPickerHeader}>
            <Text style={styles.fallbackPickerTitle}>Date/Time Picker</Text>
            <Text style={styles.fallbackPickerSubtitle}>
              Current: {dayjs(date).format('MMM D, YYYY h:mm A')}
            </Text>
          </View>
          <View style={styles.fallbackPickerButtons}>
            <TouchableOpacity onPress={onCancel} style={styles.fallbackCancelButton}>
              <Text style={styles.fallbackCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onConfirm(date)}
              style={styles.fallbackConfirmButton}
            >
              <Text style={styles.fallbackConfirmText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface Props {
  visible: boolean;
  onClose: (eventWasModified?: boolean) => void;
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
  const [showGoogleDatePicker, setShowGoogleDatePicker] = useState(false);
  const [isAllDay, setIsAllDay] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  // Friend invitation state - enhanced approach
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friendProfiles, setFriendProfiles] = useState<any[]>([]);
  const [friendPhotoUrls, setFriendPhotoUrls] = useState<Record<string, string | null>>({});
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [isAttending, setIsAttending] = useState<boolean>(false);

  // Date state with proper initialization
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  const { colors } = useTheme();
  const { addEvent, updateEvent, refetchEvents } = useEvents();

  // Helper functions
  const safeParseDate = (dateString: string): Date => {
    try {
      if (!dateString) {
        console.warn('Empty date string provided, using current date');
        return new Date();
      }

      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString, 'using current date');
        return new Date();
      }
      return date;
    } catch (error) {
      console.warn('Failed to parse date:', dateString, error);
      return new Date();
    }
  };

  const calculateEndTime = (startTime: Date, durationMinutes: number): Date => {
    return new Date(startTime.getTime() + durationMinutes * 60000);
  };

  const runDiagnosticTest = () => {
    console.log('=== Event Form Diagnostic Test ===');
    console.log('Title:', title);
    console.log('Location:', location, { lat: locationLat, lng: locationLng });
    console.log('Description:', description);
    console.log('Tags:', tags);
    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);
    console.log('Is Private:', isPrivate);
    console.log('Invitees:', inviteeIds.length);
    console.log('Current User ID:', currentUserId);
    console.log('Event being edited:', event?.$id);
    Alert.alert('Diagnostic Complete', 'Check console for details');
  };

  // Determine if this is a creator or if editing is allowed
  const isCreator = event ? event.creatorId === currentUserId : true;
  const editable = !event || isCreator;

  // Initialize form data when component mounts or event changes
  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setLocation(event.location || '');
      setDescription(event.description || '');
      setTags(Array.isArray(event.tags) ? event.tags : []);
      setIsPrivate(event.isPrivate || false);

      const safeStartDate = safeParseDate(event.startTime);
      const safeEndDate = safeParseDate(event.endTime);
      setStartDate(safeStartDate);
      setEndDate(safeEndDate);

      // Check if event is all day (starts at midnight and ends at 11:59 PM or similar)
      const startHour = safeStartDate.getHours();
      const startMinute = safeStartDate.getMinutes();
      const endHour = safeEndDate.getHours();
      const endMinute = safeEndDate.getMinutes();
      const isEventAllDay = (startHour === 0 && startMinute === 0) &&
        ((endHour === 23 && endMinute >= 59) ||
          (endHour === 0 && endMinute === 0 && dayjs(safeEndDate).isAfter(safeStartDate, 'day')));
      setIsAllDay(isEventAllDay);

      setInviteeIds((event as any).inviteeIds || []);
    } else {
      setTitle('');
      setLocation('');
      setDescription('');
      setTags([]);
      setInviteeIds([]);
      setIsPrivate(false);
      setIsAttending(false);
      setIsAllDay(false);

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

  const loadFriendProfiles = async () => {
    setLoadingFriends(true);
    try {
      const friendIds = await getUserFriends(currentUserId);
      const friendsList = friendIds.length > 0 ? await getUsersByIds(friendIds) : [];

      const availableFriends = friendsList.filter((friend: any) =>
        !inviteeIds.includes(friend.$id)
      );

      setFriendProfiles(availableFriends);

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
    if (isProcessing) {
      console.log('Already processing, skipping save');
      return;
    }

    setIsProcessing(true);

    try {
      if (!refetchEvents || !addEvent || !updateEvent) {
        throw new Error('Event context functions are not available');
      }

      if (!title.trim()) {
        Alert.alert("Error", "Event title is required");
        return;
      }

      if (!location.trim()) {
        Alert.alert("Error", "Event location is required");
        return;
      }

      if (!startDate || !endDate) {
        Alert.alert("Error", "Start and end dates are required");
        return;
      }

      if (startDate >= endDate) {
        Alert.alert("Error", "End date must be after start date");
        return;
      }

      if (!currentUserId) {
        Alert.alert("Error", "User authentication required");
        return;
      }

      const eventData = {
        title: title.trim(),
        location: location.trim(),
        ...(locationLat !== null && locationLng !== null ? { locationLat, locationLng } : {}),
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        creatorId: currentUserId,
        description: description.trim(),
        tags: tags,
        isPrivate: isPrivate,
      };

      let savedEvent;
      if (event) {
        savedEvent = await updateEvent({ ...event, ...eventData });
      } else {
        savedEvent = await addEvent(eventData);
      }

      if (savedEvent && inviteeIds.length > 0) {
        for (const inviteeId of inviteeIds) {
          try {
            await addEventInvitation(savedEvent.$id, inviteeId, currentUserId);
          } catch (error) {
            console.error('Error sending invitation to:', inviteeId, error);
          }
        }
      }

      if (groupId && savedEvent) {
        try {
          await addEventToGroup(savedEvent.$id, groupId);
        } catch (error) {
          console.error('Error adding event to group:', error);
        }
      }

      await refetchEvents();
      onClose(true);
    } catch (error) {
      console.error('Error saving event:', error);
      Alert.alert('Error', 'Failed to save event');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartDateConfirm = (date: Date) => {
    try {
      setShowStartPicker(false);
      setStartDate(date);

      if (endDate <= date) {
        setEndDate(calculateEndTime(date, 60));
      }
    } catch (error) {
      console.error('Error handling start date confirm:', error);
      setShowStartPicker(false);
    }
  };

  const handleEndDateConfirm = (date: Date) => {
    try {
      setShowEndPicker(false);

      if (date > startDate) {
        setEndDate(date);
      } else {
        setEndDate(calculateEndTime(startDate, 60));
        Alert.alert('Error', 'End time must be after start time');
      }
    } catch (error) {
      console.error('Error handling end date confirm:', error);
      setShowEndPicker(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => onClose(false)}>
      <LinearGradient
        colors={['#FF6B6B', '#4ECDC4', '#45B7D1']}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => onClose(false)} style={styles.headerButton}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {event ? 'Edit Event' : 'New Event'}
            </Text>
            {editable && (
              <TouchableOpacity
                onPress={handleSave}
                style={styles.headerButton}
                disabled={isProcessing}
              >
                <Text style={[
                  styles.headerButtonText,
                  isProcessing && styles.headerButtonTextDisabled
                ]}>
                  {isProcessing ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            )}
            {!editable && <View style={{ width: 48 }} />}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
            {/* Production error indicator */}
            {!DateTimePickerModal && (
              <View style={styles.warningContainer}>
                <MaterialIcons name="warning" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.warningText}>
                  Using fallback components for better compatibility
                </Text>
              </View>
            )}

            {/* Event Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Event Name</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="event" size={20} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                <TextInput
                  placeholder="What's happening?"
                  value={title}
                  onChangeText={setTitle}
                  style={styles.textInput}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  editable={editable}
                />
              </View>
            </View>

            {/* Location */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Location</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="location-on" size={20} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                <View style={{ flex: 1 }}>
                  {USE_BUDGET_MODE ? (
                    <BudgetPlaceAutocomplete
                      value={location}
                      onChangeText={(v: string) => {
                        setLocation(v);
                        // Clear coordinates when user types manually
                        setLocationLat(null);
                        setLocationLng(null);
                      }}
                      onSelect={(address: string, lat?: number, lng?: number) => {
                        setLocation(address);
                        if (typeof lat === 'number' && typeof lng === 'number') {
                          setLocationLat(lat);
                          setLocationLng(lng);
                          console.log('FREE location selected:', { address, lat, lng });
                        } else {
                          console.log('Manual location selected:', address);
                        }
                      }}
                      placeholder="Search restaurants, venues, addresses... (FREE)"
                    />
                  ) : (
                    <PlaceAutocomplete
                      value={location}
                      onChangeText={(v: string) => {
                        setLocation(v);
                        // Clear coordinates when user types manually
                        setLocationLat(null);
                        setLocationLng(null);
                      }}
                      onSelect={(address: string, lat?: number, lng?: number) => {
                        setLocation(address);
                        if (typeof lat === 'number' && typeof lng === 'number') {
                          setLocationLat(lat);
                          setLocationLng(lng);
                          console.log('Google Places location selected:', { address, lat, lng });
                        } else {
                          console.log('Location selected without coordinates:', address);
                        }
                      }}
                      placeholder="Search for restaurants, venues, addresses..."
                    />
                  )}
                </View>
              </View>

              {/* Location validation indicator */}
              {location.length > 0 && (
                <View style={styles.locationValidationContainer}>
                  {locationLat && locationLng ? (
                    <View style={styles.locationValidated}>
                      <MaterialIcons name="verified-user" size={16} color="#10B981" />
                      <Text style={styles.locationValidatedText}>
                        {USE_BUDGET_MODE ? 'FREE verified location with GPS coordinates' : 'Verified location with GPS coordinates'}
                      </Text>
                    </View>
                  ) : location.length > 3 ? (
                    <View style={styles.locationUnverified}>
                      <MaterialIcons name="info" size={16} color="#F59E0B" />
                      <Text style={styles.locationUnverifiedText}>
                        {USE_BUDGET_MODE ? 'Select from FREE suggestions for GPS coordinates' : 'Select from suggestions for accurate location'}
                      </Text>
                    </View>
                  ) : null}

                  {/* Budget mode indicator */}
                  {USE_BUDGET_MODE && (
                    <View style={styles.budgetModeIndicator}>
                      <MaterialIcons name="savings" size={14} color="#10B981" />
                      <Text style={styles.budgetModeText}>
                        Using FREE OpenStreetMap • No API costs
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Description */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="description" size={20} color="rgba(255,255,255,0.7)" style={[styles.inputIcon, { alignSelf: 'flex-start', marginTop: 12 }]} />
                <TextInput
                  placeholder="Tell people more about your event..."
                  value={description}
                  onChangeText={setDescription}
                  style={[styles.textInput, styles.textInputMultiline]}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  multiline
                  editable={editable}
                />
              </View>
            </View>

            {/* Date & Time - Google Calendar Style */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Date & Time</Text>
              <TouchableOpacity
                onPress={() => {
                  if (editable) {
                    setShowGoogleDatePicker(true);
                  }
                }}
                style={styles.googleDatePickerButton}
                disabled={!editable}
              >
                <View style={styles.dateTimeDisplay}>
                  <View style={styles.dateTimeRow}>
                    <MaterialIcons name="event" size={20} color="rgba(255,255,255,0.7)" />
                    <View style={styles.dateTimeInfo}>
                      <Text style={styles.dateRangeText}>
                        {dayjs(startDate).format('MMM D')}
                        {!dayjs(startDate).isSame(endDate, 'day') &&
                          ` - ${dayjs(endDate).format('MMM D')}`}
                      </Text>
                      {!isAllDay && (
                        <Text style={styles.timeRangeText}>
                          {dayjs(startDate).format('h:mm A')} - {dayjs(endDate).format('h:mm A')}
                        </Text>
                      )}
                      {isAllDay && (
                        <Text style={styles.allDayText}>All day</Text>
                      )}
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.5)" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Tags Section */}
            <View style={styles.tagsContainer}>
              <Text style={styles.inputLabel}>Event Tags</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagsScrollView}
              >
                {CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.value}
                    onPress={() => editable && handleTagToggle(category.value)}
                    style={[
                      styles.tagButton,
                      tags.includes(category.value)
                        ? styles.tagButtonSelected
                        : styles.tagButtonUnselected
                    ]}
                    disabled={!editable}
                  >
                    <Text style={styles.tagEmoji}>{category.emoji}</Text>
                    <Text style={[
                      styles.tagText,
                      tags.includes(category.value)
                        ? styles.tagTextSelected
                        : styles.tagTextUnselected
                    ]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Privacy Section */}
            <View style={styles.privacyContainer}>
              <Text style={styles.inputLabel}>Privacy</Text>
              <TouchableOpacity
                onPress={() => editable && setIsPrivate(!isPrivate)}
                style={styles.privacyOption}
                disabled={!editable}
              >
                <View style={[
                  styles.checkbox,
                  isPrivate ? styles.checkboxChecked : styles.checkboxUnchecked
                ]}>
                  {isPrivate && (
                    <MaterialIcons name="check" size={14} color="#000" />
                  )}
                </View>
                <View style={styles.privacyTextContainer}>
                  <Text style={styles.privacyTitle}>Private Event</Text>
                  <Text style={styles.privacyDescription}>
                    Only invited users can see this event
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Friend Invitations */}
            {editable && (
              <View style={styles.inviteSection}>
                <Text style={styles.inputLabel}>Invite Friends</Text>
                <TouchableOpacity onPress={handleOpenFriendPicker} style={styles.inviteButton}>
                  <MaterialIcons name="person-add" size={20} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.inviteButtonText}>Add Friends</Text>
                </TouchableOpacity>

                {inviteeIds.length > 0 && (
                  <View style={styles.inviteesContainer}>
                    {inviteeIds.slice(0, 3).map((inviteeId) => {
                      const friendProfile = friendProfiles.find(f => f.$id === inviteeId);
                      return (
                        <View key={inviteeId} style={styles.inviteeItem}>
                          <UserAvatar
                            photoUrl={friendPhotoUrls[inviteeId]}
                            firstName={friendProfile?.firstName}
                            lastName={friendProfile?.lastName}
                            name={friendProfile?.name}
                            size={32}
                          />
                          <View style={styles.inviteeInfo}>
                            <Text style={styles.inviteeName}>
                              {userDisplayUtils.getFullName(friendProfile) || friendProfile?.name || 'Unknown'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setInviteeIds(inviteeIds.filter(id => id !== inviteeId))}
                            style={styles.removeButton}
                          >
                            <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.7)" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                    {inviteeIds.length > 3 && (
                      <Text style={styles.privacyDescription}>
                        +{inviteeIds.length - 3} more invited
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Diagnostic Test Button for Development */}
            {__DEV__ && (
              <TouchableOpacity
                onPress={runDiagnosticTest}
                style={[styles.actionButton, { backgroundColor: 'rgba(251,191,36,0.9)' }]}
              >
                <MaterialIcons name="bug-report" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Run Diagnostic Test</Text>
              </TouchableOpacity>
            )}

            {/* Google Calendar Style Date Picker */}
            <GoogleCalendarDatePicker
              visible={showGoogleDatePicker}
              onClose={() => setShowGoogleDatePicker(false)}
              onSave={(newStartDate, newEndDate, newIsAllDay) => {
                setStartDate(newStartDate);
                setEndDate(newEndDate);
                setIsAllDay(newIsAllDay);
              }}
              initialStartDate={startDate}
              initialEndDate={endDate}
              initialIsAllDay={isAllDay}
              title={title}
            />

            {/* Fallback Date Time Pickers (for legacy support) */}
            {DateTimePickerModal ? (
              <>
                <DateTimePickerModal
                  isVisible={showStartPicker}
                  mode="datetime"
                  date={startDate}
                  onConfirm={handleStartDateConfirm}
                  onCancel={() => setShowStartPicker(false)}
                />
                <DateTimePickerModal
                  isVisible={showEndPicker}
                  mode="datetime"
                  date={endDate}
                  onConfirm={handleEndDateConfirm}
                  onCancel={() => setShowEndPicker(false)}
                />
              </>
            ) : (
              <>
                <FallbackDateTimePicker
                  isVisible={showStartPicker}
                  mode="datetime"
                  date={startDate}
                  onConfirm={handleStartDateConfirm}
                  onCancel={() => setShowStartPicker(false)}
                />
                <FallbackDateTimePicker
                  isVisible={showEndPicker}
                  mode="datetime"
                  date={endDate}
                  onConfirm={handleEndDateConfirm}
                  onCancel={() => setShowEndPicker(false)}
                />
              </>
            )}

            {/* Delete Event Button - Only for creators */}
            {event && isCreator && (
              <TouchableOpacity
                onPress={async () => {
                  Alert.alert(
                    'Delete Event',
                    'Are you sure you want to delete this event? This action cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await databases.deleteDocument(
                              config.databaseID!,
                              config.eventsCollectionID!,
                              event.$id
                            );
                            await refetchEvents();
                            onClose(true);
                          } catch (err) {
                            console.error("Error deleting event:", err);
                            Alert.alert("Error", "Failed to delete event.");
                          }
                        }
                      }
                    ]
                  );
                }}
                style={[styles.actionButton, styles.deleteButton]}
              >
                <MaterialIcons name="delete" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Delete Event</Text>
              </TouchableOpacity>
            )}

            {/* Join/Leave Event - Only for non-creators */}
            {event && !isCreator && (
              <View>
                {(inviteeIds.includes(currentUserId) || isAttending) ? (
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await removeEventAttendee(event.$id, currentUserId);
                        setInviteeIds(inviteeIds.filter((id) => id !== currentUserId));
                        setIsAttending(false);
                        await refetchEvents();
                        onClose(true);
                      } catch (err) {
                        console.error("Error leaving event:", err);
                        Alert.alert("Error", "Failed to leave event.");
                      }
                    }}
                    style={[styles.actionButton, styles.leaveButton]}
                  >
                    <MaterialIcons name="exit-to-app" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Leave Event</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await addEventAttendee(event.$id, currentUserId);
                        setInviteeIds([...inviteeIds, currentUserId]);
                        setIsAttending(true);
                        await refetchEvents();
                        onClose(true);
                      } catch (err) {
                        console.error("Error joining event:", err);
                        Alert.alert("Error", "Failed to join event.");
                      }
                    }}
                    style={[styles.actionButton, styles.joinButton]}
                  >
                    <MaterialIcons name="check" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Join Event</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>

          {/* Friend Picker Modal */}
          <Modal
            visible={showFriendPicker}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowFriendPicker(false)}
          >
            <LinearGradient
              colors={['#FF6B6B', '#4ECDC4', '#45B7D1']}
              style={styles.gradientContainer}
            >
              <SafeAreaView style={styles.safeArea}>
                <View style={styles.friendPickerHeader}>
                  <TouchableOpacity onPress={() => setShowFriendPicker(false)}>
                    <Text style={styles.friendPickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.friendPickerTitle}>Invite Friends</Text>
                  <View style={{ width: 60 }} />
                </View>

                {loadingFriends ? (
                  <View style={styles.friendPickerEmpty}>
                    <MaterialIcons name="people" size={48} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.friendPickerEmptyText}>Loading friends...</Text>
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
                        style={styles.friendItem}
                      >
                        <UserAvatar
                          photoUrl={friendPhotoUrls[item.$id]}
                          firstName={item.firstName}
                          lastName={item.lastName}
                          name={item.name}
                          size={40}
                        />
                        <View style={styles.friendItemInfo}>
                          <Text style={styles.friendItemName}>
                            {userDisplayUtils.getFullName(item) || item.name}
                          </Text>
                        </View>
                        <TouchableOpacity style={styles.friendItemButton}>
                          <Text style={styles.friendItemButtonText}>Invite</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={styles.friendPickerEmpty}>
                        <MaterialIcons name="people" size={48} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.friendPickerEmptyText}>
                          No friends available to invite
                        </Text>
                      </View>
                    }
                  />
                )}
              </SafeAreaView>
            </LinearGradient>
          </Modal>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Fallback DateTimePicker styles
  fallbackPickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  fallbackPickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fallbackPickerHeader: {
    marginBottom: 24,
  },
  fallbackPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  fallbackPickerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  fallbackPickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  fallbackCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  fallbackCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  fallbackConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#000',
    borderRadius: 12,
    alignItems: 'center',
  },
  fallbackConfirmText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },

  // Main form styles
  gradientContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerButtonText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#fff',
  },
  headerButtonTextDisabled: {
    color: 'rgba(255,255,255,0.5)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },

  // Warning styles
  warningContainer: {
    backgroundColor: 'rgba(255,193,7,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,193,7,0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },

  // Input styles
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 12,
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Location validation styles
  locationValidationContainer: {
    marginTop: 8,
  },
  locationValidated: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationValidatedText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  locationUnverified: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationUnverifiedText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  budgetModeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  budgetModeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },

  // Date picker button styles
  datePickerButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  datePickerText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },

  // Google Calendar Style Date Picker
  googleDatePickerButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dateTimeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateTimeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  dateRangeText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 2,
  },
  timeRangeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  allDayText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
  },

  // Tag styles
  tagsContainer: {
    marginBottom: 24,
  },
  tagsScrollView: {
    paddingHorizontal: 4,
  },
  tagButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  tagButtonSelected: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  tagButtonUnselected: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  tagEmoji: {
    marginRight: 6,
    fontSize: 14,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tagTextSelected: {
    color: '#000',
  },
  tagTextUnselected: {
    color: '#fff',
  },

  // Privacy section styles
  privacyContainer: {
    marginBottom: 24,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxUnchecked: {
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    borderColor: '#fff',
    backgroundColor: '#fff',
  },
  privacyTextContainer: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  privacyDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },

  // Invite section styles
  inviteSection: {
    marginBottom: 24,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  inviteButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    marginLeft: 12,
  },
  inviteesContainer: {
    marginTop: 16,
  },
  inviteeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  inviteeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  inviteeName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
  removeButton: {
    padding: 4,
  },

  // Action button styles
  actionButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(220,38,38,0.9)',
  },
  joinButton: {
    backgroundColor: 'rgba(34,197,94,0.9)',
  },
  leaveButton: {
    backgroundColor: 'rgba(251,146,60,0.9)',
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },

  // Friend picker modal styles
  friendPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  friendPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  friendPickerCancel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  friendItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  friendItemButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  friendItemButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  friendPickerEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  friendPickerEmptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 16,
  },
});
