import { getEventEmoji } from '@/constants/categories';
import { addEventAttendee, addEventInvitation, getEventById, removeEventAttendee } from '@/lib/api/event';
import { getUserFriends } from '@/lib/api/friendship';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { useAlert, useAlertHelpers } from '@/lib/context/AlertContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { sendEventInviteNotification } from '@/lib/notifications/notificationUtils';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Linking, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ShareInviteModal from '../../../components/ShareInviteModal';
import UserAvatar from '../components/UserAvatar';
import { useEvents } from '../context/EventContext';

const EventDetail = () => {
  const params = useLocalSearchParams();
  const { eventId } = params as { eventId?: string; from?: string };
  const fromParam = (params as any)?.from as string | undefined;
  const router = useRouter();
  const { refetchEvents } = useEvents();
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const { showSuccess, showError, showInfo, showConfirm } = useAlertHelpers();
  const { user: globalUser } = useGlobalContext();
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [attending, setAttending] = useState(false);
  const [creatorName, setCreatorName] = useState('');
  const [creatorPhotoUrl, setCreatorPhotoUrl] = useState<string | null>(null);
  const [attendeeProfiles, setAttendeeProfiles] = useState<any[]>([]);
  const [inviteeProfiles, setInviteeProfiles] = useState<any[]>([]);
  const [attendeePhotoUrls, setAttendeePhotoUrls] = useState<Record<string, string | null>>({});
  const [inviteePhotoUrls, setInviteePhotoUrls] = useState<Record<string, string | null>>({});
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendPhotoUrls, setFriendPhotoUrls] = useState<Record<string, string | null>>({});
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const fetchEventAndCreator = async () => {
      try {
        // Use the proper API function instead of direct database call
        const res = await getEventById(String(eventId));
        if (!res) {
          console.error('Event not found');
          return;
        }
        setEvent(res);

        if (!globalUser?.$id) {
          console.error('No current user found');
          return;
        }
        setUserId(globalUser.$id);
        setAttending(res.attendees?.includes(globalUser.$id));

        // Fetch creator's profile and photo
        const creatorProfile = await getUserProfile(res.creatorId);
        setCreatorName(userDisplayUtils.getFullName(creatorProfile || {}) || 'Unknown');

        // Fetch creator photo
        try {
          const creatorPhoto = await getUserProfilePhotoUrl(res.creatorId);
          setCreatorPhotoUrl(creatorPhoto);
        } catch (error) {
          console.error('Error fetching creator photo:', error);
        }

        // Fetch attendee profiles and photos
        if (res.attendees && res.attendees.length > 0) {
          const attendees = await getUsersByIds(res.attendees);
          setAttendeeProfiles(attendees);

          // Fetch photos for attendees
          const photoUrls: Record<string, string | null> = {};
          for (const attendee of attendees) {
            try {
              const photoUrl = await getUserProfilePhotoUrl(attendee.$id);
              photoUrls[attendee.$id] = photoUrl;
            } catch (error) {
              console.error('Error fetching attendee photo:', error);
              photoUrls[attendee.$id] = null;
            }
          }
          setAttendeePhotoUrls(photoUrls);
        }

        // Fetch invitee profiles and photos
        if (res.inviteeIds && res.inviteeIds.length > 0) {
          const invitees = await getUsersByIds(res.inviteeIds);
          setInviteeProfiles(invitees);

          // Fetch photos for invitees
          const photoUrls: Record<string, string | null> = {};
          for (const invitee of invitees) {
            try {
              const photoUrl = await getUserProfilePhotoUrl(invitee.$id);
              photoUrls[invitee.$id] = photoUrl;
            } catch (error) {
              console.error('Error fetching invitee photo:', error);
              photoUrls[invitee.$id] = null;
            }
          }
          setInviteePhotoUrls(photoUrls);
        }

      } catch (err) {
        console.error('Failed to fetch event or creator:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEventAndCreator();
  }, [eventId]);

  const handleAttend = async () => {
    if (!event || !userId) return;
    if (event.attendees?.includes(userId)) {
      showInfo('Already Attending', 'You are already attending this event.');
      return;
    }

    try {
      await addEventAttendee(event.$id, userId);
      setEvent({ ...event, attendees: [...(event.attendees || []), userId] });
      setAttending(true);
      showSuccess('Attending Event!', 'You are now attending this event!');
      refetchEvents();
    } catch (err) {
      console.error('Attend event error:', err);
      showError('Error', 'Failed to attend event');
    }
  };

  const handleNotAttend = async () => {
    if (!event || !userId) return;

    try {
      await removeEventAttendee(event.$id, userId);
      setEvent({ ...event, attendees: (event.attendees || []).filter((id: string) => id !== userId) });
      setAttending(false);
      showSuccess('No Longer Attending', 'You are no longer attending this event.');
      refetchEvents();
    } catch (err) {
      console.error('Not attend event error:', err);
      showError('Error', 'Failed to un-attend event');
    }
  };

  const handleInviteFriend = async () => {
    try {
      // Use the new friendship API
      const friendIds = await getUserFriends(userId);
      const friendsList = friendIds.length > 0 ? await getUsersByIds(friendIds) : [];

      // Filter out friends who are already attendees or invitees
      const availableFriends = friendsList.filter((friend: any) =>
        !event.attendees?.includes(friend.$id) &&
        !event.inviteeIds?.includes(friend.$id)
      );

      if (availableFriends.length === 0) {
        showInfo('No Friends Available', 'All your friends are already invited or attending this event.');
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
      showError('Error', 'Failed to load friends list');
    }
  };

  const inviteFreind = async (friendId: string) => {
    try {
      setInviting(true);

      // Create an invitation using the junction table helper
      await addEventInvitation(event.$id, friendId);

      // Update local state to include the new invitee for immediate feedback
      const updatedInviteeIds = [...(event.inviteeIds || []), friendId];
      setEvent({ ...event, inviteeIds: updatedInviteeIds });

      // Reload invitee profiles
      const invitees = await getUsersByIds(updatedInviteeIds);
      setInviteeProfiles(invitees);

      // Send push notification to the invited friend
      await sendEventInviteNotification([friendId], event.title, creatorName, event.$id);

      showSuccess('Friend Invited!', 'Friend invited to the event!');
      setShowInviteModal(false);

    } catch (error) {
      console.error('Error inviting friend:', error);
      showError('Error', 'Failed to invite friend');
    } finally {
      setInviting(false);
    }
  };

  const openInMaps = (location: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading event...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <MaterialIcons name="error-outline" size={64} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>Event not found</Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleOpenChat = () => {
    // Navigate to event chat - implement based on your chat system
    showInfo('Chat Feature', 'Event chat is coming soon!');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero Section with Gradient Overlay */}
      <View style={styles.heroSection}>
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
          style={styles.heroGradient}
        />

        {/* Header Actions */}
        <View style={[styles.headerActions, {
          top: insets.top + 16,
          zIndex: 100
        }]}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
            onPress={() => {
              if (fromParam === 'feed') {
                router.push('/(root)/Feed' as any);
                return;
              }
              if (fromParam === 'explore') {
                router.push('/(root)/Explore' as any);
                return;
              }
              router.back();
            }}
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <View style={styles.actionButtons}>
            {attending && (
              <TouchableOpacity
                style={[styles.headerButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                onPress={handleOpenChat}
              >
                <MaterialIcons name="chat" size={24} color="white" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.headerButton, {
                backgroundColor: 'rgba(255,255,255,0.2)',
                zIndex: 101
              }]}
              onPress={() => {
                console.log('Share button pressed, opening modal...');
                setShowShareModal(true);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="share" size={24} color={colors.buttonText} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, {
                backgroundColor: 'rgba(255,255,255,0.2)',
                zIndex: 101
              }]}
              onPress={handleInviteFriend}
              activeOpacity={0.7}
            >
              <MaterialIcons name="person-add" size={24} color={colors.buttonText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Event Emoji & Title Overlay */}
        <View style={styles.heroContent} pointerEvents="box-none">
          <Text style={styles.eventEmoji}>{getEventEmoji(event?.tags)}</Text>
          <Text style={styles.eventTitle}>{event.title}</Text>

          {/* Creator Info */}
          <View style={styles.creatorInfo}>
            <UserAvatar
              photoUrl={creatorPhotoUrl}
              name={creatorName}
              size={32}
            />
            <Text style={styles.creatorName}>Created by {creatorName}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Attend Event Button */}
        <View style={styles.attendButtonSection}>
          {attending ? (
            <TouchableOpacity
              style={[styles.primaryButton, styles.attendingButton, { backgroundColor: colors.success }]}
              onPress={handleNotAttend}
            >
              <MaterialIcons name="check-circle" size={20} color={colors.buttonText} />
              <Text style={[styles.buttonText, { color: colors.buttonText }]}>Attending</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleAttend}
            >
              <MaterialIcons name="event-available" size={20} color={colors.buttonText} />
              <Text style={[styles.buttonText, { color: colors.buttonText }]}>Attend Event</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Event Details Card */}
        <View style={[styles.detailsCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <View style={styles.detailsHeader}>
            <MaterialIcons name="schedule" size={20} color={colors.primary} />
            <Text style={[styles.detailsHeaderText, { color: colors.text }]}>Event Details</Text>
          </View>

          {/* Date & Time */}
          <View style={styles.detailRow}>
            <MaterialIcons name="event" size={20} color={colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Date & Time</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {dayjs(event.startTime).format('MMM D, YYYY h:mm A')} - {dayjs(event.endTime).format('h:mm A')}
              </Text>
            </View>
          </View>

          {/* Location */}
          <TouchableOpacity style={styles.detailRow} onPress={() => openInMaps(event.location)}>
            <MaterialIcons name="place" size={20} color={colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Location</Text>
              <Text style={[styles.detailValue, styles.linkText, { color: colors.primary }]}>
                {event.location}
              </Text>
            </View>
            <MaterialIcons name="open-in-new" size={16} color={colors.primary} />
          </TouchableOpacity>

          {/* Description */}
          {event.description && (
            <View style={styles.detailRow}>
              <MaterialIcons name="description" size={20} color={colors.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Description</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{event.description}</Text>
              </View>
            </View>
          )}

          {/* Privacy Status */}
          <View style={styles.detailRow}>
            <MaterialIcons
              name={event.isPrivate ? "lock" : "public"}
              size={20}
              color={colors.textSecondary}
            />
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Privacy</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {event.isPrivate ? "Private Event" : "Public Event"}
              </Text>
            </View>
          </View>

          {/* Event Tags */}
          {event.tags && event.tags.length > 0 && (
            <View style={styles.detailRow}>
              <MaterialIcons name="local-offer" size={20} color={colors.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Categories</Text>
                <View style={styles.tagsContainer}>
                  {event.tags.map((tag: string, index: number) => (
                    <View key={index} style={[styles.tagChip, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.tagText, { color: colors.text }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Attendance Card */}
        <View style={[styles.detailsCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <View style={styles.detailsHeader}>
            <MaterialIcons name="people" size={20} color={colors.primary} />
            <Text style={[styles.detailsHeaderText, { color: colors.text }]}>
              Attendance ({attendeeProfiles.length} attending)
            </Text>
          </View>

          {attendeeProfiles.length > 0 ? (
            <View style={styles.attendeesContainer}>
              <FlatList
                data={attendeeProfiles}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.$id}
                renderItem={({ item }) => (
                  <View style={styles.attendeeItem}>
                    <UserAvatar
                      photoUrl={attendeePhotoUrls[item.$id]}
                      name={userDisplayUtils.getFullName(item)}
                      size={50}
                    />
                    <Text style={[styles.attendeeName, { color: colors.text }]} numberOfLines={1}>
                      {userDisplayUtils.getFirstName(item)}
                    </Text>
                  </View>
                )}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                contentContainerStyle={styles.attendeesList}
              />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="people-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                No attendees yet
              </Text>
            </View>
          )}
        </View>

        {/* Invitees Card */}
        {inviteeProfiles.length > 0 && (
          <View style={[styles.detailsCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <View style={styles.detailsHeader}>
              <MaterialIcons name="mail" size={20} color={colors.warning} />
              <Text style={[styles.detailsHeaderText, { color: colors.text }]}>
                Invited ({inviteeProfiles.length} pending)
              </Text>
            </View>

            <View style={styles.attendeesContainer}>
              <FlatList
                data={inviteeProfiles}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.$id}
                renderItem={({ item }) => (
                  <View style={styles.attendeeItem}>
                    <View style={styles.pendingBadgeContainer}>
                      <UserAvatar
                        photoUrl={inviteePhotoUrls[item.$id]}
                        name={userDisplayUtils.getFullName(item)}
                        size={50}
                      />
                      <View style={[styles.pendingBadge, { backgroundColor: colors.warning }]}>
                        <MaterialIcons name="schedule" size={12} color="white" />
                      </View>
                    </View>
                    <Text style={[styles.attendeeName, { color: colors.text }]} numberOfLines={1}>
                      {userDisplayUtils.getFirstName(item)}
                    </Text>
                  </View>
                )}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                contentContainerStyle={styles.attendeesList}
              />
            </View>
          </View>
        )}

        {/* Bottom Padding */}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Invite Friends Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowInviteModal(false)}>
              <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Invite Friends</Text>
            <View style={{ width: 60 }} />
          </View>

          <FlatList
            data={friends}
            keyExtractor={(item) => item.$id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => inviteFreind(item.$id)}
                disabled={inviting}
                style={[styles.friendItem, { borderBottomColor: colors.border }]}
              >
                <UserAvatar
                  photoUrl={friendPhotoUrls[item.$id]}
                  name={userDisplayUtils.getFullName(item)}
                  size={40}
                />
                <View style={styles.friendInfo}>
                  <Text style={[styles.friendName, { color: colors.text }]}>
                    {userDisplayUtils.getFullName(item)}
                  </Text>
                </View>
                <Text style={[styles.inviteButtonText, { color: colors.primary }]}>
                  {inviting ? 'Inviting...' : 'Invite'}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyFriends}>
                <MaterialIcons name="people-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyFriendsText, { color: colors.textSecondary }]}>
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
        eventId={String(eventId)}
      />
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  heroSection: {
    height: height * 0.4,
    position: 'relative',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  headerActions: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroContent: {
    alignItems: 'center',
    zIndex: 2,
    paddingHorizontal: 16,
  },
  eventEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  creatorName: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 20,
  },
  attendButtonSection: {
    marginBottom: 8,
  },
  detailsCard: {
    borderRadius: 16,
    marginBottom: 16,
    padding: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailsHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    lineHeight: 22,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  attendeesContainer: {
    marginTop: 8,
  },
  attendeesList: {
    paddingHorizontal: 4,
  },
  attendeeItem: {
    alignItems: 'center',
    width: 70,
  },
  attendeeName: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  pendingBadgeContainer: {
    position: 'relative',
  },
  pendingBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  attendingButton: {
    // Additional styles for attending state
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyFriends: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyFriendsText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default EventDetail;