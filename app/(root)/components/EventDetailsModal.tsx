import { getEventEmoji } from '@/constants/categories';
import icons from '@/constants/icons';
import { addEventAttendee, addEventInvitation, getEventAttendees, getEventInvitees, isUserAttendingEvent, removeEventAttendee } from '@/lib/api/event';
import { getUserFriends } from '@/lib/api/friendship';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getUsersByIds } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { sendEventInviteNotification } from '@/lib/notifications/notificationUtils';
import { useCreatorInfo } from '@/lib/utils/creatorInfoManager';
import { realTimeUI } from '@/lib/utils/realTimeUI';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Linking, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ShareInviteModal from '../../../components/ShareInviteModal';
import { useEvents } from '../context/EventContext';
import UserAvatar from './UserAvatar';

import { Event } from '@/lib/types/Events';

interface EventDetailsModalProps {
  event: Event;
  isCreator: boolean;
  onClose: () => void;
  onEdit: (event: Event) => void;
  onAttend: () => void;
  onNotAttend: () => void;
  onChat?: (event: Event) => void;
  currentUserId: string;
}

const EventDetailsModal = ({
  event,
  isCreator,
  onClose,
  onEdit,
  onAttend,
  onNotAttend,
  onChat,
  currentUserId
}: EventDetailsModalProps) => {
  const router = useRouter();
  const { colors } = useTheme();
  const { refetchEvents } = useEvents();

  // Get creator info using the CreatorInfoManager
  const { getCreatorName, getCreatorPhotoUrl } = useCreatorInfo([event?.creatorId].filter(Boolean), 1);

  const [attendeeProfiles, setAttendeeProfiles] = useState<any[]>([]);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [attendeePhotoUrls, setAttendeePhotoUrls] = useState<Record<string, string | null>>({});
  const [friends, setFriends] = useState<any[]>([]);
  const [friendPhotoUrls, setFriendPhotoUrls] = useState<Record<string, string | null>>({});
  const [inviting, setInviting] = useState(false);
  const [isAttending, setIsAttending] = useState<boolean>(false);
  const [checkingAttendance, setCheckingAttendance] = useState<boolean>(true);

  // Check attendance status using junction table
  useEffect(() => {
    const checkAttendance = async () => {
      if (!currentUserId || !event?.$id) {
        setCheckingAttendance(false);
        return;
      }

      try {
        const attending = await isUserAttendingEvent(currentUserId, event.$id);
        setIsAttending(attending);
      } catch (error) {
        console.error('Error checking attendance:', error);
        setIsAttending(false);
      } finally {
        setCheckingAttendance(false);
      }
    };

    checkAttendance();
  }, [currentUserId, event?.$id]);

  // Refresh attendance status
  const refreshAttendanceStatus = async () => {
    if (!currentUserId || !event?.$id) return;

    try {
      const attending = await isUserAttendingEvent(currentUserId, event.$id);
      setIsAttending(attending);
    } catch (error) {
      console.error('Error refreshing attendance status:', error);
    }
  };

  // Enhanced attend handler
  const handleAttendClick = async () => {
    if (onAttend) {
      await onAttend();
    } else {
      // fallback: call internal attendee API with real-time UI feedback
      try {
        if (!currentUserId) return;

        console.log('🔥 EventDetailsModal: Applying attend action for event', event.$id);
        // Apply immediate UI feedback via realTimeUI
        realTimeUI.applyAction(event.$id, 'attend');

        await addEventAttendee(event.$id, currentUserId);

        console.log('🔥 EventDetailsModal: Clearing attend action for event', event.$id);
        // Clear the pending action since DB update succeeded
        realTimeUI.clearAction(event.$id);

        // Trigger a global refetch so Feed/Home/Explore reflect the mutation
        try { refetchEvents?.(); } catch (e) { console.warn('EventDetailsModal: refetchEvents failed', e); }
      } catch (err) {
        console.error('Fallback attend error:', err);

        console.log('🔥 EventDetailsModal: Attend action failed for event', event.$id);
        // Rollback on failure - clear the pending action
        realTimeUI.clearAction(event.$id);

        // If the server disallowed attending a private event, show a clearer message
        if (err instanceof Error && /not invited to this private event/i.test(err.message)) {
          Alert.alert('Private Event', 'You are not invited to this private event. Ask the organizer to invite you.');
        } else {
          Alert.alert('Error', 'Failed to attend event');
        }
        return;
      }
    }
    // Refresh attendance status after a brief delay to ensure backend is updated
    setTimeout(refreshAttendanceStatus, 500);
  };

  // Enhanced not attend handler
  const handleNotAttendClick = async () => {
    if (onNotAttend) {
      await onNotAttend();
    } else {
      try {
        if (!currentUserId) return;

        console.log('🔥 EventDetailsModal: Applying unattend action for event', event.$id);
        // Apply immediate UI feedback via realTimeUI
        realTimeUI.applyAction(event.$id, 'unattend');

        await removeEventAttendee(event.$id, currentUserId);

        console.log('🔥 EventDetailsModal: Clearing unattend action for event', event.$id);
        // Clear the pending action since DB update succeeded
        realTimeUI.clearAction(event.$id);

        // Trigger a global refetch so Feed/Home/Explore reflect the mutation
        try { refetchEvents?.(); } catch (e) { console.warn('EventDetailsModal: refetchEvents failed', e); }
      } catch (err) {
        console.error('Fallback not-attend error:', err);

        // Rollback on failure - clear the pending action
        realTimeUI.clearAction(event.$id);

        Alert.alert('Error', 'Failed to un-attend event');
        return;
      }
    }
    // Refresh attendance status after a brief delay to ensure backend is updated
    setTimeout(refreshAttendanceStatus, 500);
  };

  useEffect(() => {
    const fetchAttendeeProfiles = async () => {
      // Prefer junction table for attendees; fallback to legacy array only if junction fails
      let attendeeIds: string[] = [];
      try {
        // Prefer junction table
        const junction = await getEventAttendees(event.$id);
        if (Array.isArray(junction) && junction.length > 0) {
          attendeeIds = junction;
        }
      } catch (err) {
        // fallback to legacy in-document attendees if present
        if (Array.isArray(event?.attendees)) attendeeIds = event.attendees;
      }

      if (attendeeIds.length > 0) {
        try {
          const profiles = await getUsersByIds(attendeeIds);
          setAttendeeProfiles(profiles);

          // Fetch profile photos for attendees
          const photoUrls: Record<string, string | null> = {};
          for (const profile of profiles) {
            try {
              const photoUrl = await getUserProfilePhotoUrl(profile.$id);
              photoUrls[profile.$id] = photoUrl;
            } catch (error) {
              console.error(`Error fetching photo for attendee ${profile.$id}:`, error);
              photoUrls[profile.$id] = null;
            }
          }
          setAttendeePhotoUrls(photoUrls);
        } catch (error) {
          console.error('Error fetching attendee profiles:', error);
        }
      }
    };

    fetchAttendeeProfiles();
  }, [event?.$id]);

  if (!event) return null;

  const handleInviteFriend = async () => {
    try {
      // Use the new friendship system to get friend IDs
      const friendIds = await getUserFriends(currentUserId);

      // Convert friend IDs to friend profiles
      const friendsList = friendIds.length > 0 ? await getUsersByIds(friendIds) : [];

      // Filter out friends who are already attendees or invitees using junction-derived IDs when available
      const attendeeIdSet = new Set(attendeeProfiles.map((p: any) => p.$id));
      let inviteeIds: string[] = [];
      try {
        const junctionInvites = await getEventInvitees(event.$id);
        if (Array.isArray(junctionInvites) && junctionInvites.length > 0) inviteeIds = junctionInvites;
      } catch (err) {
        // fallback to legacy field
        if (Array.isArray((event as any).inviteeIds)) inviteeIds = (event as any).inviteeIds as string[];
      }
      const inviteeIdSet = new Set(inviteeIds);
      const availableFriends = friendsList.filter((friend: any) =>
        !attendeeIdSet.has(friend.$id) && !inviteeIdSet.has(friend.$id)
      );

      if (availableFriends.length === 0) {
        Alert.alert('No Friends Available', 'All your friends are already invited or attending this event.');
        return;
      }

      setFriends(availableFriends);

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

      setShowInviteModal(true);
    } catch (error) {
      console.error('Error loading friends:', error);
      Alert.alert('Error', 'Failed to load friends list');
    }
  };

  const inviteFriend = async (friendId: string) => {
    try {
      setInviting(true);

      // Create invitation record via junction table
      await addEventInvitation(event.$id, friendId);

      // Send push notification to the invited friend
      await sendEventInviteNotification(
        [friendId],
        event.title,
        getCreatorName(event.creatorId) || 'Someone',
        event.$id
      );

      Alert.alert('Success', 'Friend invited to the event!');
      setShowInviteModal(false);

    } catch (error) {
      console.error('Error inviting friend:', error);
      Alert.alert('Error', 'Failed to invite friend');
    } finally {
      setInviting(false);
    }
  };

  if (!event) return null;

  // AttendeesList component
  interface AttendeeProfile {
    $id: string;
    firstName?: string;
    lastName?: string;
    name?: string; // Fallback for backwards compatibility
  }

  interface AttendeesListProps {
    profiles: AttendeeProfile[];
    limit?: number | null;
    onPress?: (() => void) | null;
  }

  const AttendeesList = ({ profiles, limit = null, onPress = null }: AttendeesListProps) => (
    <View style={styles.attendeesContainer}>
      <View style={styles.attendeesRow}>
        {(limit ? profiles.slice(0, limit) : profiles).map((profile: AttendeeProfile, index: number) => (
          <View key={profile.$id} style={[styles.attendeeItem, index > 0 && { marginLeft: 4 }]}>
            <UserAvatar
              photoUrl={attendeePhotoUrls[profile.$id]}
              firstName={profile.firstName}
              lastName={profile.lastName}
              name={profile.name} // Fallback for backwards compatibility
              size={32}
            />
            {!limit && <Text style={styles.attendeeName}>{userDisplayUtils.getFirstName(profile)}</Text>}
          </View>
        ))}
        {limit && profiles.length > limit && (
          <View style={[styles.attendeeItem, { marginLeft: 4 }]}>
            <View style={styles.moreAttendeesCircle}>
              <Text style={styles.moreAttendeesText}>+{profiles.length - limit}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={!!event}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          {/* Header with black background and invite button */}
          <View style={[styles.header, { backgroundColor: colors.primary }]}>
            <Text style={[styles.headerTitle, { color: colors.buttonText }]}>{event.title}</Text>
            <View style={styles.headerButtons}>
              {isAttending && onChat && (
                <TouchableOpacity style={styles.headerButton} onPress={() => onChat(event)}>
                  <Image source={icons.chat} style={[styles.headerChatIcon, { tintColor: colors.buttonText }]} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.headerButton} onPress={() => setShowShareModal(true)}>
                <MaterialIcons name="share" size={24} color={colors.buttonText} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={handleInviteFriend}>
                <MaterialIcons name="person-add" size={24} color={colors.buttonText} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={onClose}>
                <MaterialIcons name="close" size={24} color={colors.buttonText} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.contentContainer} contentContainerStyle={{ minHeight: 300 }}>
            {/* Event Emoji */}
            <View style={styles.eventEmojiContainer}>
              <Text style={styles.eventEmoji}>{getEventEmoji(event.tags || [])}</Text>
            </View>

            {/* Creator Info */}
            <View style={styles.creatorInfo}>
              <UserAvatar
                photoUrl={getCreatorPhotoUrl(event.creatorId)}
                name={getCreatorName(event.creatorId) || 'Unknown Creator'}
                size={20}
              />
              <Text style={styles.creatorName}>
                {getCreatorName(event.creatorId) || 'Unknown Creator'}
              </Text>
            </View>

            {/* Event Details */}
            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => {
                try {
                  const evAny = event as any;
                  if (evAny.locationLat && evAny.locationLng) {
                    const url = `https://www.google.com/maps/search/?api=1&query=${evAny.locationLat},${evAny.locationLng}`;
                    Linking.openURL(url);
                  } else if (event.location) {
                    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;
                    Linking.openURL(url);
                  }
                } catch (err) {
                  console.error('Failed to open maps:', err);
                }
              }}
            >
              <Image source={icons.location} style={styles.detailIcon} />
              <Text style={[styles.detailText, { textDecorationLine: 'underline' }]}>{event.location}</Text>
            </TouchableOpacity>
            <View style={styles.detailRow}>
              <Image source={icons.calendar} style={styles.detailIcon} />
              <Text style={styles.detailText}>
                {event.startTime && dayjs(event.startTime).isValid() ? dayjs(event.startTime).format('MMM D, YYYY h:mm A') : 'Invalid date'}
                {' - '}
                {event.endTime && dayjs(event.endTime).isValid() ? dayjs(event.endTime).format('h:mm A') : 'Invalid date'}
              </Text>
            </View>

            {/* Event Description */}
            <Text style={[styles.description, { color: colors.text }]}>{event.description || 'No description available.'}</Text>

            {/* Attendees Section */}
            {attendeeProfiles.length > 0 && (
              <View style={styles.attendeesSection}>
                <Pressable onPress={() => setShowAttendeesModal(true)}>
                  <Text style={styles.attendeesTitle}>
                    Attending ({attendeeProfiles.length})
                  </Text>
                </Pressable>
                <AttendeesList profiles={attendeeProfiles} limit={5 as any} />
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {!isCreator && (
                <TouchableOpacity
                  style={[
                    styles.button,
                    isAttending ? styles.notAttendingButton : styles.attendingButton,
                    { backgroundColor: isAttending ? colors.error : colors.primary }
                  ]}
                  onPress={isAttending ? handleNotAttendClick : handleAttendClick}
                >
                  <Text style={[styles.buttonText, { color: colors.buttonText }]}>
                    {checkingAttendance ? 'Loading...' : (isAttending ? 'Not Attending' : 'Attend Event')}
                  </Text>
                </TouchableOpacity>
              )}

              {isCreator && (
                <TouchableOpacity
                  style={[styles.button, styles.editButtonBottom, { backgroundColor: colors.primary }]}
                  onPress={() => onEdit(event)}
                >
                  <Text style={[styles.buttonText, { color: colors.buttonText }]}>Edit Event</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Full Attendees List Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAttendeesModal}
        onRequestClose={() => setShowAttendeesModal(false)}
      >
        <View style={styles.centeredView}>
          <View style={[styles.modalView, styles.attendeesModalView]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowAttendeesModal(false)}
            >
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>

            <Text style={styles.attendeesModalTitle}>Attendees</Text>

            <ScrollView style={styles.attendeesModalList}>
              <AttendeesList profiles={attendeeProfiles} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Invite Friends Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.inviteModalHeader}>
            <TouchableOpacity onPress={() => setShowInviteModal(false)}>
              <Text style={[styles.inviteModalCancel, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.inviteModalTitle, { color: colors.text }]}>Invite Friends</Text>
            <View style={{ width: 60 }} />
          </View>

          <FlatList
            data={friends}
            keyExtractor={(item) => item.$id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => inviteFriend(item.$id)}
                disabled={inviting}
                style={styles.inviteFriendItem}
              >
                <UserAvatar
                  photoUrl={friendPhotoUrls[item.$id]}
                  firstName={item.firstName}
                  lastName={item.lastName}
                  name={item.name}
                  size={40}
                />
                <View style={styles.inviteFriendInfo}>
                  <Text style={[styles.inviteFriendName, { color: colors.text }]}>
                    {userDisplayUtils.getFullName(item) || item.name}
                  </Text>
                </View>
                <Text style={[styles.inviteButtonText, { color: colors.primary }]}>
                  {inviting ? 'Inviting...' : 'Invite'}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyInviteList}>
                <Text style={styles.emptyInviteText}>
                  No friends available to invite
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Share Invite Modal */}
      <ShareInviteModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        eventId={event.$id}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 1,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 0,
  },
  creatorName: {
    fontSize: 16,
    color: '#666',
    marginLeft: 12,
  },
  eventEmojiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 120,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginBottom: 15,
  },
  eventEmoji: {
    fontSize: 48,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  detailText: {
    fontSize: 16,
    color: '#666',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginVertical: 15,
  },
  attendeesSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  attendeesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  attendeesContainer: {
    marginTop: 5,
  },
  attendeesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeItem: {
    alignItems: 'center',
    marginRight: 2, // Reduce spacing between attendees for better balance
  },
  attendeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
  attendeeName: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  moreAttendeesCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  moreAttendeesText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  actionButtons: {
    marginTop: 20,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 5,
  },
  editButton: {
    // backgroundColor set inline via theme
  },
  editButtonBottom: {
    // backgroundColor set inline via theme
  },
  attendingButton: {
    // backgroundColor set inline via theme
  },
  notAttendingButton: {
    // backgroundColor set inline via theme
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  attendingText: {
  },
  notAttendingText: {
  },
  attendeesModalView: {
    padding: 20,
    width: '90%',
    maxHeight: '70%',
  },
  attendeesModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  attendeesModalList: {
    width: '100%',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 10,
  },
  chatIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 5,
  },
  headerButton: {
    padding: 5,
  },
  headerChatIcon: {
    width: 20,
    height: 20,
    tintColor: 'white',
  },
  contentContainer: {
    padding: 20,
  },
  inviteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  inviteModalCancel: {
    fontSize: 18,
    fontWeight: '500',
  },
  inviteModalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  inviteFriendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  inviteFriendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  inviteFriendName: {
    fontSize: 16,
    fontWeight: '600',
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyInviteList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyInviteText: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default EventDetailsModal;