import { EventPhotoUpload } from '@/components/EventPhotoUpload';
import { Background } from '@/components/ui/Background';
import { CATEGORIES } from '@/constants/categories';
import { addEventAttendee, addEventInvitation, cleanupOrphanedAttendanceRecords, removeEventAttendee } from '@/lib/api/event';
import { getUserFriends } from '@/lib/api/friendship';
import { addEventToGroup } from '@/lib/api/group';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getUsersByIds } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Event } from '@/lib/types/Events';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useEvents } from '../../context/EventContext';
import BudgetPlaceAutocomplete from '../autocomplete/BudgetPlaceAutocomplete';
import PlaceAutocomplete from '../autocomplete/PlaceAutocomplete';
import UserAvatar from '../UserAvatar';

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
  const { t } = useLanguage();

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View style={styles.fallbackPickerOverlay}>
        <View style={styles.fallbackPickerContainer}>
          <View style={styles.fallbackPickerHeader}>
            <Text style={styles.fallbackPickerTitle}>{t('eventForm.dateTimePicker')}</Text>
            <Text style={styles.fallbackPickerSubtitle}>Selected: {date.toLocaleDateString()}</Text>
          </View>
          <View style={styles.fallbackPickerButtons}>
            <TouchableOpacity style={styles.fallbackCancelButton} onPress={onCancel}>
              <Text style={styles.fallbackCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fallbackConfirmButton} onPress={() => onConfirm(date)}>
              <Text style={styles.fallbackConfirmText}>{t('common.ok')}</Text>
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
  // Debug: Log component render
  console.log('🔥 EventForm render:', { visible, currentUserId, hasEvent: !!event, groupId });

  // Basic state initialization
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [photoId, setPhotoId] = useState<string | undefined>(undefined);
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

  const { colors, isColorful } = useTheme();
  const { t } = useLanguage();
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
      setIsPrivate(Boolean(event.isPrivate)); // Explicitly convert to boolean to preserve true values
      setPhotoId((event as any).photoId || undefined);

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
      setPhotoId(undefined);

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
        ...(photoId ? { photoId } : {}),
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
        console.log('🔥 EventForm: Adding event to group:', { eventId: savedEvent.$id, groupId });
        try {
          await addEventToGroup(groupId, savedEvent.$id);
          console.log('🔥 EventForm: Successfully added event to group');
        } catch (error) {
          console.error('🔥 EventForm: Error adding event to group:', error);
          // Don't fail the entire operation if group assignment fails
        }
      } else {
        console.log('🔥 EventForm: Not adding to group:', { hasGroupId: !!groupId, hasSavedEvent: !!savedEvent });
      }

      await refetchEvents();
      onClose(true);
    } catch (error: any) {
      console.error('🔥 EventForm: Error saving event:', error);

      // Log detailed error information for debugging
      console.error('🔥 EventForm: Error details:', {
        message: error?.message || 'Unknown error',
        type: error?.type || 'unknown',
        code: error?.code || 'unknown',
        stack: error?.stack
      });

      // Show more specific error message
      const errorMessage = error?.message || 'Failed to save event';
      Alert.alert('Error', `Failed to save event: ${errorMessage}`);
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
      {isColorful ? (
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
                {event ? t('eventForm.updateEvent') : t('eventForm.createEvent')}
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
                    {isProcessing ? t('common.loading') : t('common.save')}
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

              {/* DEBUG: Cleanup Button - Remove after fixing the issue */}
              <TouchableOpacity
                onPress={async () => {
                  try {
                    Alert.alert(
                      'Clean Up Database',
                      'This will remove orphaned attendance records. Continue?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Clean Up',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              console.log('🧹 Starting cleanup...');
                              const deletedCount = await cleanupOrphanedAttendanceRecords();
                              Alert.alert('Success', `Cleaned up ${deletedCount} orphaned records`);
                              console.log(`✅ Cleanup complete: ${deletedCount} records removed`);
                            } catch (error) {
                              console.error('❌ Cleanup failed:', error);
                              Alert.alert('Error', 'Cleanup failed. Check console for details.');
                            }
                          }
                        }
                      ]
                    );
                  } catch (error) {
                    console.error('Cleanup error:', error);
                  }
                }}
                style={{
                  backgroundColor: 'rgba(255,193,7,0.2)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,193,7,0.5)',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <MaterialIcons name="cleaning-services" size={20} color="#FFC107" style={{ marginRight: 12 }} />
                <Text style={{ color: '#FFC107', fontSize: 14, fontWeight: '600' }}>
                  🧹 Clean Orphaned Database Records (DEBUG)
                </Text>
              </TouchableOpacity>

              {/* Event Name */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('eventForm.eventName') || 'Event Name'}</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="event" size={20} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                  <TextInput
                    placeholder={t('eventForm.whatsHappening') || "What's happening?"}
                    value={title}
                    onChangeText={setTitle}
                    style={styles.textInput}
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    editable={editable}
                  />
                </View>
              </View>

              {/* Event Photo */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Event Photo</Text>
                <View style={styles.photoUploadContainer}>
                  {editable ? (
                    <>
                      <EventPhotoUpload
                        eventId={event?.$id || 'temp-event-' + Date.now()}
                        currentUserId={currentUserId}
                        currentPhotoId={photoId}
                        onPhotoUploaded={(newPhotoId: string) => {
                          setPhotoId(newPhotoId);
                        }}
                        onPhotoDeleted={() => {
                          setPhotoId(undefined);
                        }}
                        size={120}
                      />
                      <View style={styles.photoUploadInfo}>
                        <Text style={styles.photoUploadText}>
                          Add a photo to make your event more appealing
                        </Text>
                        <Text style={styles.photoUploadSubtext}>
                          Photos help people discover and join your event
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.photoUploadPlaceholder}>
                      <MaterialIcons name="visibility" size={48} color="rgba(255,255,255,0.4)" />
                      <View style={styles.photoUploadInfo}>
                        <Text style={styles.photoUploadText}>
                          Event Photo (View Only)
                        </Text>
                        <Text style={styles.photoUploadSubtext}>
                          Only the event creator can modify photos
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Location */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('eventForm.location')}</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="location-on" size={20} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                  <View style={{ flex: 1 }}>
                    {USE_BUDGET_MODE ? (
                      <BudgetPlaceAutocomplete
                        value={location}
                        onChangeText={(v: string) => {
                          // Limit location to 50 characters as per database constraint
                          const truncatedLocation = v.length > 50 ? v.substring(0, 50) : v;
                          setLocation(truncatedLocation);
                          // Clear coordinates when user types manually
                          setLocationLat(null);
                          setLocationLng(null);
                        }}
                        onSelect={(address: string, lat?: number, lng?: number) => {
                          // Limit location to 50 characters as per database constraint
                          const truncatedAddress = address.length > 50 ? address.substring(0, 50) : address;
                          setLocation(truncatedAddress);
                          if (typeof lat === 'number' && typeof lng === 'number') {
                            setLocationLat(lat);
                            setLocationLng(lng);
                            console.log('FREE location selected:', { address, lat, lng });
                          } else {
                            console.log('Manual location selected:', address);
                          }
                        }}
                        placeholder={t('eventForm.searchLocationFree')}
                      />
                    ) : (
                      <PlaceAutocomplete
                        value={location}
                        onChangeText={(v: string) => {
                          // Limit location to 50 characters as per database constraint
                          const truncatedLocation = v.length > 50 ? v.substring(0, 50) : v;
                          setLocation(truncatedLocation);
                          // Clear coordinates when user types manually
                          setLocationLat(null);
                          setLocationLng(null);
                        }}
                        onSelect={(address: string, lat?: number, lng?: number) => {
                          // Limit location to 50 characters as per database constraint
                          const truncatedAddress = address.length > 50 ? address.substring(0, 50) : address;
                          setLocation(truncatedAddress);
                          if (typeof lat === 'number' && typeof lng === 'number') {
                            setLocationLat(lat);
                            setLocationLng(lng);
                            console.log('Google Places location selected:', { address, lat, lng });
                          } else {
                            console.log('Location selected without coordinates:', address);
                          }
                        }}
                        placeholder={t('eventForm.searchLocation')}
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
                <Text style={styles.inputLabel}>{t('eventForm.description')}</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="description" size={20} color="rgba(255,255,255,0.7)" style={[styles.inputIcon, { alignSelf: 'flex-start', marginTop: 12 }]} />
                  <TextInput
                    placeholder={t('eventForm.tellMoreAboutEvent')}
                    value={description}
                    onChangeText={setDescription}
                    style={[styles.textInput, styles.textInputMultiline]}
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    multiline
                    editable={editable}
                  />
                </View>
              </View>

              {/* Enhanced Date & Time Section */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t('eventForm.dateTime')}</Text>

                {/* Modern Date Time Card */}
                <TouchableOpacity
                  onPress={() => {
                    if (editable) {
                      setShowGoogleDatePicker(true);
                    }
                  }}
                  style={styles.modernDateTimeCard}
                  disabled={!editable}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dateTimeGradient}
                  >
                    {/* Header Row */}
                    <View style={styles.dateTimeHeader}>
                      <View style={styles.dateTimeIconWrapper}>
                        <MaterialIcons name="event" size={24} color="#fff" />
                      </View>
                      <View style={styles.dateTimeHeaderText}>
                        <Text style={styles.dateTimeTitle}>Event Schedule</Text>
                        <Text style={styles.dateTimeSubtitle}>
                          {dayjs(startDate).isSame(endDate, 'day') ? 'Same day event' : 'Multi-day event'}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={24} color="rgba(255,255,255,0.6)" />
                    </View>

                    {/* Date Range Display */}
                    <View style={styles.dateRangeContainer}>
                      <View style={styles.dateBlock}>
                        <Text style={styles.dateBlockLabel}>Start</Text>
                        <Text style={styles.dateBlockDate}>
                          {dayjs(startDate).format('ddd, MMM D')}
                        </Text>
                        <Text style={styles.dateBlockYear}>
                          {dayjs(startDate).format('YYYY')}
                        </Text>
                      </View>

                      {!dayjs(startDate).isSame(endDate, 'day') && (
                        <>
                          <View style={styles.dateArrowContainer}>
                            <MaterialIcons name="arrow-forward" size={20} color="rgba(255,255,255,0.7)" />
                          </View>
                          <View style={styles.dateBlock}>
                            <Text style={styles.dateBlockLabel}>End</Text>
                            <Text style={styles.dateBlockDate}>
                              {dayjs(endDate).format('ddd, MMM D')}
                            </Text>
                            <Text style={styles.dateBlockYear}>
                              {dayjs(endDate).format('YYYY')}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>

                    {/* Time Display */}
                    <View style={styles.timeDisplayContainer}>
                      {isAllDay ? (
                        <View style={styles.allDayBadge}>
                          <MaterialIcons name="wb-sunny" size={16} color="#FFB800" />
                          <Text style={styles.allDayBadgeText}>All Day Event</Text>
                        </View>
                      ) : (
                        <View style={styles.timeRangeDisplay}>
                          <View style={styles.timeBlock}>
                            <MaterialIcons name="schedule" size={16} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.timeText}>
                              {dayjs(startDate).format('h:mm A')}
                            </Text>
                          </View>
                          <Text style={styles.timeToText}>to</Text>
                          <View style={styles.timeBlock}>
                            <Text style={styles.timeText}>
                              {dayjs(endDate).format('h:mm A')}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Duration Badge */}
                      <View style={styles.durationBadge}>
                        <MaterialIcons name="timer" size={14} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.durationText}>
                          {isAllDay
                            ? `${dayjs(endDate).diff(startDate, 'day') + 1} day${dayjs(endDate).diff(startDate, 'day') !== 0 ? 's' : ''}`
                            : `${Math.ceil(dayjs(endDate).diff(startDate, 'minute') / 60)}h`
                          }
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Tags Section */}
              <View style={styles.tagsContainer}>
                <Text style={styles.inputLabel}>{t('eventForm.eventTags')}</Text>
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
                <Text style={styles.inputLabel}>{t('eventForm.privacy')}</Text>
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
                    <Text style={styles.privacyTitle}>{t('eventForm.privateEvent')}</Text>
                    <Text style={styles.privacyDescription}>
                      Only invited users can see this event
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Friend Invitations */}
              {editable && (
                <View style={styles.inviteSection}>
                  <Text style={styles.inputLabel}>{t('eventForm.inviteFriends')}</Text>
                  <TouchableOpacity onPress={handleOpenFriendPicker} style={styles.inviteButton}>
                    <MaterialIcons name="person-add" size={20} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.inviteButtonText}>{t('eventForm.addFriends')}</Text>
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
                  <Text style={styles.actionButtonText}>{t('eventForm.runDiagnosticTest')}</Text>
                </TouchableOpacity>
              )}

              {/* Date Time Pickers */}
              {DateTimePickerModal ? (
                <>
                  <DateTimePickerModal
                    isVisible={showStartPicker}
                    mode="datetime"
                    display="spinner"
                    date={startDate}
                    onConfirm={handleStartDateConfirm}
                    onCancel={() => setShowStartPicker(false)}
                    pickerStyleIOS={{
                      backgroundColor: '#ffffff',
                    }}
                    textColor="#000000"
                    buttonTextColorIOS="#000000"
                  />
                  <DateTimePickerModal
                    isVisible={showEndPicker}
                    mode="datetime"
                    display="spinner"
                    date={endDate}
                    onConfirm={handleEndDateConfirm}
                    onCancel={() => setShowEndPicker(false)}
                    pickerStyleIOS={{
                      backgroundColor: '#ffffff',
                    }}
                    textColor="#000000"
                    buttonTextColorIOS="#000000"
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
                              // 🚀 Use cascade deletion to remove event and ALL related data
                              const { deleteEvent } = await import('@/lib/api/event');
                              await deleteEvent(event.$id);
                              // Refresh list and close modal after successful cascade deletion
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
                  <Text style={styles.actionButtonText}>{t('eventForm.deleteEvent')}</Text>
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
                      <Text style={styles.actionButtonText}>{t('eventForm.leaveEvent')}</Text>
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
                      <Text style={styles.actionButtonText}>{t('eventForm.joinEvent')}</Text>
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
              {isColorful ? (
                <LinearGradient
                  colors={['#FF6B6B', '#4ECDC4', '#45B7D1']}
                  style={styles.gradientContainer}
                >
                  <SafeAreaView style={styles.safeArea}>
                    <View style={styles.friendPickerHeader}>
                      <TouchableOpacity onPress={() => setShowFriendPicker(false)}>
                        <Text style={styles.friendPickerCancel}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                      <Text style={styles.friendPickerTitle}>{t('eventForm.selectFriends')}</Text>
                      <View style={{ width: 60 }} />
                    </View>

                    {loadingFriends ? (
                      <View style={styles.friendPickerEmpty}>
                        <MaterialIcons name="people" size={48} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.friendPickerEmptyText}>{t('common.loading')}</Text>
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
                              {t('eventForm.noFriendsToInvite')}
                            </Text>
                          </View>
                        }
                      />
                    )}
                  </SafeAreaView>
                </LinearGradient>
              ) : (
                <Background>
                  <SafeAreaView style={styles.safeArea}>
                    <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                      <TouchableOpacity onPress={() => setShowFriendPicker(false)} style={styles.headerButton}>
                        <MaterialIcons name="close" size={24} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={[styles.headerTitle, { color: colors.text }]}>Invite Friends</Text>
                      <View style={{ width: 40 }} />
                    </View>
                    {/* Non-colorful content would go here */}
                  </SafeAreaView>
                </Background>
              )}
            </Modal>
          </SafeAreaView>
        </LinearGradient>
      ) : (
        <Background>
          <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => onClose(false)} style={styles.headerButton}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {event ? t('eventForm.updateEvent') : t('eventForm.createEvent')}
              </Text>
              {editable && (
                <TouchableOpacity
                  onPress={handleSave}
                  style={styles.headerButton}
                  disabled={isProcessing}
                >
                  <Text style={[
                    styles.headerButtonText,
                    { color: colors.text },
                    isProcessing && { color: colors.textSecondary }
                  ]}>
                    {isProcessing ? t('common.loading') : t('common.save')}
                  </Text>
                </TouchableOpacity>
              )}
              {!editable && <View style={{ width: 48 }} />}
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
              {/* Production error indicator */}
              {!DateTimePickerModal && (
                <View style={[styles.warningContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <MaterialIcons name="warning" size={20} color={colors.text} style={{ marginRight: 8 }} />
                  <Text style={[styles.warningText, { color: colors.text }]}>
                    Using fallback components for better compatibility
                  </Text>
                </View>
              )}

              {/* Event Name */}
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('eventForm.eventName') || 'Event Name'}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <MaterialIcons name="event" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    placeholder={t('eventForm.whatsHappening') || "What's happening?"}
                    value={title}
                    onChangeText={setTitle}
                    style={[styles.textInput, { color: colors.text }]}
                    placeholderTextColor={colors.textSecondary}
                    editable={editable}
                  />
                </View>
              </View>

              {/* Event Photo */}
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Event Photo</Text>
                <View style={styles.photoUploadContainer}>
                  {editable ? (
                    <>
                      <EventPhotoUpload
                        eventId={event?.$id || 'temp-event-' + Date.now()}
                        currentUserId={currentUserId}
                        currentPhotoId={photoId}
                        onPhotoUploaded={(newPhotoId: string) => {
                          setPhotoId(newPhotoId);
                        }}
                        onPhotoDeleted={() => {
                          setPhotoId(undefined);
                        }}
                        size={120}
                      />
                      <View style={styles.photoUploadInfo}>
                        <Text style={[styles.photoUploadText, { color: colors.text }]}>
                          Add a photo to make your event more appealing
                        </Text>
                        <Text style={[styles.photoUploadSubtext, { color: colors.textSecondary }]}>
                          Photos help people discover and join your event
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.photoUploadPlaceholder}>
                      <MaterialIcons name="visibility" size={48} color={colors.textSecondary} />
                      <View style={styles.photoUploadInfo}>
                        <Text style={[styles.photoUploadText, { color: colors.text }]}>
                          Event Photo (View Only)
                        </Text>
                        <Text style={[styles.photoUploadSubtext, { color: colors.textSecondary }]}>
                          Only the event creator can modify photos
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Location */}
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('eventForm.location')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <MaterialIcons name="location-on" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <View style={{ flex: 1 }}>
                    {USE_BUDGET_MODE ? (
                      <BudgetPlaceAutocomplete
                        value={location}
                        onChangeText={(v: string) => {
                          // Limit location to 50 characters as per database constraint
                          const truncatedLocation = v.length > 50 ? v.substring(0, 50) : v;
                          setLocation(truncatedLocation);
                          setLocationLat(null);
                          setLocationLng(null);
                        }}
                        onSelect={(address: string, lat?: number, lng?: number) => {
                          // Limit location to 50 characters as per database constraint
                          const truncatedAddress = address.length > 50 ? address.substring(0, 50) : address;
                          setLocation(truncatedAddress);
                          if (typeof lat === 'number' && typeof lng === 'number') {
                            setLocationLat(lat);
                            setLocationLng(lng);
                          }
                        }}
                        placeholder={t('eventForm.searchLocationFree')}
                      />
                    ) : (
                      <PlaceAutocomplete
                        value={location}
                        onChangeText={(v: string) => {
                          // Limit location to 50 characters as per database constraint
                          const truncatedLocation = v.length > 50 ? v.substring(0, 50) : v;
                          setLocation(truncatedLocation);
                          setLocationLat(null);
                          setLocationLng(null);
                        }}
                        onSelect={(address: string, lat?: number, lng?: number) => {
                          // Limit location to 50 characters as per database constraint
                          const truncatedAddress = address.length > 50 ? address.substring(0, 50) : address;
                          setLocation(truncatedAddress);
                          if (typeof lat === 'number' && typeof lng === 'number') {
                            setLocationLat(lat);
                            setLocationLng(lng);
                          }
                        }}
                        placeholder={t('eventForm.searchLocation')}
                      />
                    )}
                  </View>
                </View>
              </View>

              {/* Description */}
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('eventForm.description')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'flex-start' }]}>
                  <MaterialIcons name="description" size={20} color={colors.textSecondary} style={[styles.inputIcon, { marginTop: 12 }]} />
                  <TextInput
                    placeholder={t('eventForm.tellMoreAboutEvent')}
                    value={description}
                    onChangeText={setDescription}
                    style={[styles.textInput, { color: colors.text, minHeight: 80, textAlignVertical: 'top' }]}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    editable={editable}
                  />
                </View>
              </View>

              {/* Enhanced Date & Time Section */}
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('eventForm.dateTime')}</Text>

                {/* Modern Date Time Card */}
                <TouchableOpacity
                  onPress={() => setShowGoogleDatePicker(true)}
                  style={[styles.modernDateTimeCard, { backgroundColor: colors.card }]}
                  disabled={!editable}
                >
                  <View style={[styles.dateTimeGradient, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {/* Header Row */}
                    <View style={styles.dateTimeHeader}>
                      <View style={[styles.dateTimeIconWrapper, { backgroundColor: colors.primary + '20' }]}>
                        <MaterialIcons name="event" size={24} color={colors.primary} />
                      </View>
                      <View style={styles.dateTimeHeaderText}>
                        <Text style={[styles.dateTimeTitle, { color: colors.text }]}>Event Schedule</Text>
                        <Text style={[styles.dateTimeSubtitle, { color: colors.textSecondary }]}>
                          {dayjs(startDate).isSame(endDate, 'day') ? 'Same day event' : 'Multi-day event'}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                    </View>

                    {/* Date Range Display */}
                    <View style={styles.dateRangeContainer}>
                      <View style={[styles.dateBlock, { backgroundColor: colors.background + '80' }]}>
                        <Text style={[styles.dateBlockLabel, { color: colors.textSecondary }]}>Start</Text>
                        <Text style={[styles.dateBlockDate, { color: colors.text }]}>
                          {dayjs(startDate).format('ddd, MMM D')}
                        </Text>
                        <Text style={[styles.dateBlockYear, { color: colors.textSecondary }]}>
                          {dayjs(startDate).format('YYYY')}
                        </Text>
                      </View>

                      {!dayjs(startDate).isSame(endDate, 'day') && (
                        <>
                          <View style={styles.dateArrowContainer}>
                            <MaterialIcons name="arrow-forward" size={20} color={colors.textSecondary} />
                          </View>
                          <View style={[styles.dateBlock, { backgroundColor: colors.background + '80' }]}>
                            <Text style={[styles.dateBlockLabel, { color: colors.textSecondary }]}>End</Text>
                            <Text style={[styles.dateBlockDate, { color: colors.text }]}>
                              {dayjs(endDate).format('ddd, MMM D')}
                            </Text>
                            <Text style={[styles.dateBlockYear, { color: colors.textSecondary }]}>
                              {dayjs(endDate).format('YYYY')}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>

                    {/* Time Display */}
                    <View style={styles.timeDisplayContainer}>
                      {isAllDay ? (
                        <View style={[styles.allDayBadge, { backgroundColor: '#FFB800' + '20', borderColor: '#FFB800' + '40' }]}>
                          <MaterialIcons name="wb-sunny" size={16} color="#FFB800" />
                          <Text style={[styles.allDayBadgeText, { color: '#FFB800' }]}>All Day Event</Text>
                        </View>
                      ) : (
                        <View style={styles.timeRangeDisplay}>
                          <View style={[styles.timeBlock, { backgroundColor: colors.background + '60' }]}>
                            <MaterialIcons name="schedule" size={16} color={colors.textSecondary} />
                            <Text style={[styles.timeText, { color: colors.text }]}>
                              {dayjs(startDate).format('h:mm A')}
                            </Text>
                          </View>
                          <Text style={[styles.timeToText, { color: colors.textSecondary }]}>to</Text>
                          <View style={[styles.timeBlock, { backgroundColor: colors.background + '60' }]}>
                            <Text style={[styles.timeText, { color: colors.text }]}>
                              {dayjs(endDate).format('h:mm A')}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Duration Badge */}
                      <View style={[styles.durationBadge, { backgroundColor: colors.background + '60' }]}>
                        <MaterialIcons name="timer" size={14} color={colors.textSecondary} />
                        <Text style={[styles.durationText, { color: colors.textSecondary }]}>
                          {isAllDay
                            ? `${dayjs(endDate).diff(startDate, 'day') + 1} day${dayjs(endDate).diff(startDate, 'day') !== 0 ? 's' : ''}`
                            : `${Math.ceil(dayjs(endDate).diff(startDate, 'minute') / 60)}h`
                          }
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Event Tags */}
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('eventForm.eventTags')}</Text>
                <View style={styles.tagScrollContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagContainer}>
                    {CATEGORIES.map((category) => {
                      const isSelected = tags.includes(category.value);
                      return (
                        <TouchableOpacity
                          key={category.value}
                          onPress={() => {
                            if (!editable) return;
                            if (isSelected) {
                              setTags(tags.filter(t => t !== category.value));
                            } else {
                              setTags([...tags, category.value]);
                            }
                          }}
                          style={[
                            styles.tagChip,
                            {
                              backgroundColor: isSelected ? colors.primary : colors.card,
                              borderColor: isSelected ? colors.primary : colors.border,
                            }
                          ]}
                        >
                          <Text style={[
                            styles.tagText,
                            { color: isSelected ? '#fff' : colors.text }
                          ]}>
                            {category.emoji} {category.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              {/* Privacy */}
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('eventForm.privacy')}</Text>
                <TouchableOpacity
                  onPress={() => editable && setIsPrivate(!isPrivate)}
                  style={[styles.privacyToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
                  disabled={!editable}
                >
                  <View style={styles.privacyToggleContent}>
                    <MaterialIcons
                      name={isPrivate ? "lock" : "public"}
                      size={20}
                      color={colors.text}
                    />
                    <View style={styles.privacyToggleText}>
                      <Text style={[styles.privacyTitle, { color: colors.text }]}>{t('eventForm.privateEvent')}</Text>
                      <Text style={[styles.privacyDescription, { color: colors.textSecondary }]}>
                        {isPrivate ? 'Only invited friends can see this event' : 'Anyone can see this event'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.switch, { backgroundColor: isPrivate ? colors.primary : colors.border }]}>
                    <View style={[styles.switchThumb, {
                      backgroundColor: '#fff',
                      transform: [{ translateX: isPrivate ? 16 : 2 }]
                    }]} />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Invite Friends */}
              {isPrivate && (
                <View style={styles.inputContainer}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>{t('eventForm.inviteFriends')}</Text>
                  <TouchableOpacity onPress={() => setShowFriendPicker(true)} style={[styles.inviteButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.inviteButtonText, { color: colors.text }]}>{t('eventForm.addFriends')}</Text>
                    <MaterialIcons name="person-add" size={20} color={colors.text} />
                  </TouchableOpacity>

                  {inviteeIds.length > 0 && (
                    <View style={styles.invitedFriendsContainer}>
                      {inviteeIds.slice(0, 3).map((friendId) => {
                        const friend = friendProfiles.find(f => f.$id === friendId);
                        if (!friend) return null;

                        return (
                          <View key={friendId} style={styles.invitedFriendItem}>
                            <UserAvatar
                              photoUrl={friendPhotoUrls[friendId]}
                              firstName={friend.firstName}
                              lastName={friend.lastName}
                              name={friend.name}
                              size={32}
                            />
                            <Text style={[styles.invitedFriendName, { color: colors.text }]}>
                              {userDisplayUtils.getFullName(friend) || friend.name}
                            </Text>
                            <TouchableOpacity
                              onPress={() => setInviteeIds(inviteeIds.filter(id => id !== friendId))}
                              style={styles.removeInviteButton}
                            >
                              <MaterialIcons name="close" size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                      {inviteeIds.length > 3 && (
                        <Text style={[styles.privacyDescription, { color: colors.textSecondary }]}>
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
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                >
                  <MaterialIcons name="bug-report" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>{t('eventForm.runDiagnosticTest')}</Text>
                </TouchableOpacity>
              )}

              {/* Date Time Pickers */}
              {DateTimePickerModal ? (
                <>
                  <DateTimePickerModal
                    isVisible={showStartPicker}
                    mode="datetime"
                    display="spinner"
                    date={startDate}
                    onConfirm={handleStartDateConfirm}
                    onCancel={() => setShowStartPicker(false)}
                    pickerStyleIOS={{
                      backgroundColor: '#ffffff',
                    }}
                    textColor="#000000"
                    buttonTextColorIOS="#000000"
                  />
                  <DateTimePickerModal
                    isVisible={showEndPicker}
                    mode="datetime"
                    display="spinner"
                    date={endDate}
                    onConfirm={handleEndDateConfirm}
                    onCancel={() => setShowEndPicker(false)}
                    pickerStyleIOS={{
                      backgroundColor: '#ffffff',
                    }}
                    textColor="#000000"
                    buttonTextColorIOS="#000000"
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
                              // 🚀 Use cascade deletion to remove event and ALL related data
                              const { deleteEvent } = await import('@/lib/api/event');
                              await deleteEvent(event.$id);
                              // Refresh list and close modal after successful cascade deletion
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
                  <Text style={styles.actionButtonText}>{t('eventForm.deleteEvent')}</Text>
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
                      <Text style={styles.actionButtonText}>{t('eventForm.leaveEvent')}</Text>
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
                      <Text style={styles.actionButtonText}>{t('eventForm.joinEvent')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Background>
      )}

      {/* Premium Date & Time Picker Modal */}
      {showGoogleDatePicker && (
        <Modal
          visible={showGoogleDatePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowGoogleDatePicker(false)}
        >
          <View style={styles.premiumPickerOverlay}>
            <LinearGradient
              colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.premiumPickerContainer}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pickerHeaderGradient}
              >
                {/* Header */}
                <View style={styles.premiumPickerHeader}>
                  <TouchableOpacity
                    onPress={() => setShowGoogleDatePicker(false)}
                    style={styles.premiumCloseButton}
                  >
                    <MaterialIcons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.pickerHeaderContent}>
                    <Text style={styles.premiumPickerTitle}>Schedule Event</Text>
                    <Text style={styles.premiumPickerSubtitle}>Set your perfect timing</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowGoogleDatePicker(false)}
                    style={styles.premiumDoneButton}
                  >
                    <Text style={styles.premiumDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* Content */}
              <View style={styles.premiumPickerContent}>
                {/* Quick Presets */}
                <View style={styles.quickPresetsContainer}>
                  <Text style={styles.quickPresetsTitle}>Quick Options</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickPresetsScroll}>
                    {[
                      { label: 'This Evening', hours: 19, duration: 3, addDays: 0 },
                      { label: 'Tomorrow', hours: 14, duration: 2, addDays: 1 },
                      { label: 'This Weekend', hours: 10, duration: 8, addDays: dayjs().day() >= 6 ? 7 : (6 - dayjs().day()) },
                      { label: 'All Day', hours: 0, duration: 24, addDays: 0, allDay: true },
                    ].map((preset, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => {
                          const baseDate = dayjs().add(preset.addDays, 'day');
                          if (preset.allDay) {
                            setIsAllDay(true);
                            setStartDate(baseDate.startOf('day').toDate());
                            setEndDate(baseDate.endOf('day').toDate());
                          } else {
                            setIsAllDay(false);
                            setStartDate(baseDate.hour(preset.hours).minute(0).toDate());
                            setEndDate(baseDate.hour(preset.hours).minute(0).add(preset.duration, 'hour').toDate());
                          }
                        }}
                        style={styles.quickPresetButton}
                      >
                        <Text style={styles.quickPresetText}>{preset.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* All Day Toggle */}
                <View style={styles.premiumToggleContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      setIsAllDay(!isAllDay);
                      if (!isAllDay) {
                        // When enabling all day, set to full day
                        setStartDate(dayjs(startDate).startOf('day').toDate());
                        setEndDate(dayjs(startDate).endOf('day').toDate());
                      } else {
                        // When disabling all day, set reasonable times
                        setStartDate(dayjs(startDate).hour(14).minute(0).toDate());
                        setEndDate(dayjs(startDate).hour(16).minute(0).toDate());
                      }
                    }}
                    style={styles.premiumToggleButton}
                  >
                    <View style={styles.toggleIconWrapper}>
                      <MaterialIcons
                        name={isAllDay ? "wb-sunny" : "schedule"}
                        size={20}
                        color={isAllDay ? "#FFB800" : "#6366F1"}
                      />
                    </View>
                    <View style={styles.toggleTextContent}>
                      <Text style={styles.premiumToggleText}>All Day Event</Text>
                      <Text style={styles.premiumToggleSubtext}>
                        {isAllDay ? 'Full day celebration' : 'Set specific times'}
                      </Text>
                    </View>
                    <View style={[
                      styles.premiumToggleSwitch,
                      { backgroundColor: isAllDay ? '#4ECDC4' : '#E5E7EB' }
                    ]}>
                      <View style={[
                        styles.premiumToggleThumb,
                        {
                          backgroundColor: '#fff',
                          transform: [{ translateX: isAllDay ? 22 : 2 }]
                        }
                      ]} />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Date & Time Sections */}
                <View style={styles.dateTimeSectionsContainer}>
                  {/* Start Date & Time */}
                  <View style={styles.premiumDateTimeSection}>
                    <Text style={styles.premiumSectionTitle}>Event Starts</Text>
                    <TouchableOpacity
                      onPress={() => setShowStartPicker(true)}
                      style={styles.premiumDateTimeButton}
                    >
                      <View style={styles.dateTimeButtonContent}>
                        <View style={styles.dateTimeIconContainer}>
                          <MaterialIcons name="play-arrow" size={20} color="#10B981" />
                        </View>
                        <View style={styles.dateTimeTextContainer}>
                          <Text style={styles.premiumDateText}>
                            {dayjs(startDate).format('dddd, MMM D')}
                          </Text>
                          {!isAllDay && (
                            <Text style={styles.premiumTimeText}>
                              {dayjs(startDate).format('h:mm A')}
                            </Text>
                          )}
                        </View>
                        <MaterialIcons name="edit" size={18} color="#9CA3AF" />
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* End Date & Time */}
                  <View style={styles.premiumDateTimeSection}>
                    <Text style={styles.premiumSectionTitle}>Event Ends</Text>
                    <TouchableOpacity
                      onPress={() => setShowEndPicker(true)}
                      style={styles.premiumDateTimeButton}
                    >
                      <View style={styles.dateTimeButtonContent}>
                        <View style={styles.dateTimeIconContainer}>
                          <MaterialIcons name="stop" size={20} color="#EF4444" />
                        </View>
                        <View style={styles.dateTimeTextContainer}>
                          <Text style={styles.premiumDateText}>
                            {dayjs(endDate).format('dddd, MMM D')}
                          </Text>
                          {!isAllDay && (
                            <Text style={styles.premiumTimeText}>
                              {dayjs(endDate).format('h:mm A')}
                            </Text>
                          )}
                        </View>
                        <MaterialIcons name="edit" size={18} color="#9CA3AF" />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Duration Summary */}
                <View style={styles.durationSummaryContainer}>
                  <LinearGradient
                    colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                    style={styles.durationSummaryGradient}
                  >
                    <MaterialIcons name="timelapse" size={24} color="#6366F1" />
                    <View style={styles.durationSummaryText}>
                      <Text style={styles.durationSummaryTitle}>Duration</Text>
                      <Text style={styles.durationSummaryValue}>
                        {isAllDay
                          ? `${dayjs(endDate).diff(startDate, 'day') + 1} day${dayjs(endDate).diff(startDate, 'day') !== 0 ? 's' : ''}`
                          : `${Math.max(1, Math.ceil(dayjs(endDate).diff(startDate, 'minute') / 60))} hour${Math.ceil(dayjs(endDate).diff(startDate, 'minute') / 60) !== 1 ? 's' : ''}`
                        }
                      </Text>
                    </View>
                  </LinearGradient>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Modern Date Time Card Styles
  modernDateTimeCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dateTimeGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
  },
  dateTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateTimeIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dateTimeHeaderText: {
    flex: 1,
  },
  dateTimeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  dateTimeSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  dateBlock: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  dateBlockLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dateBlockDate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  dateBlockYear: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  dateArrowContainer: {
    paddingHorizontal: 12,
  },
  timeDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allDayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,184,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  allDayBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFB800',
    marginLeft: 6,
  },
  timeRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
  },
  timeToText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginHorizontal: 8,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 4,
  },

  // Premium Date Time Picker Styles
  premiumPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  premiumPickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  pickerHeaderGradient: {
    paddingBottom: 4,
  },
  premiumPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  premiumCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerHeaderContent: {
    flex: 1,
    alignItems: 'center',
  },
  premiumPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  premiumPickerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  premiumDoneButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  premiumDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  premiumPickerContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  quickPresetsContainer: {
    marginBottom: 24,
  },
  quickPresetsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  quickPresetsScroll: {
    flexDirection: 'row',
  },
  quickPresetButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
  },
  quickPresetText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  premiumToggleContainer: {
    marginBottom: 24,
  },
  premiumToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
  },
  toggleIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleTextContent: {
    flex: 1,
  },
  premiumToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  premiumToggleSubtext: {
    fontSize: 13,
    color: '#6B7280',
  },
  premiumToggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    position: 'relative',
  },
  premiumToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  dateTimeSectionsContainer: {
    marginBottom: 24,
  },
  premiumDateTimeSection: {
    marginBottom: 16,
  },
  premiumSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  premiumDateTimeButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FAFBFC',
  },
  dateTimeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  dateTimeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  dateTimeTextContainer: {
    flex: 1,
  },
  premiumDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  premiumTimeText: {
    fontSize: 14,
    color: '#6B7280',
  },
  durationSummaryContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  durationSummaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  durationSummaryText: {
    marginLeft: 12,
  },
  durationSummaryTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 2,
  },
  durationSummaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
  },

  // Legacy Enhanced DateTimePicker styles (kept for fallback)
  enhancedPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  enhancedPickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 34, // Safe area padding
  },
  enhancedPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerCloseButton: {
    padding: 4,
    width: 60,
  },
  enhancedPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  pickerDoneButton: {
    padding: 4,
    width: 60,
    alignItems: 'flex-end',
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  enhancedPickerContent: {
    padding: 20,
  },
  allDayToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 20,
  },
  allDayToggleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    position: 'relative',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
  },
  dateTimeSection: {
    marginBottom: 20,
  },
  dateTimeSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  legacyTimeText: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Fallback DateTimePicker styles (keep for compatibility)
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

  // Missing styles for non-colorful mode
  dateTimeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  allDayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  tagScrollContainer: {
    marginTop: 8,
  },
  tagContainer: {
    paddingHorizontal: 4,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  privacyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  privacyToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  privacyToggleText: {
    marginLeft: 12,
    flex: 1,
  },
  switch: {
    width: 40,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  invitedFriendsContainer: {
    marginTop: 12,
  },
  invitedFriendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  invitedFriendName: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  removeInviteButton: {
    padding: 4,
  },
  photoUploadContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  photoUploadInfo: {
    flex: 1,
    marginLeft: 16,
  },
  photoUploadText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  photoUploadSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 16,
  },
  photoUploadPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
});
