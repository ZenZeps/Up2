import { addEventAttendee, removeEventInvitation } from '@/lib/api/event';
import { acceptFriendRequest, declineFriendRequest } from '@/lib/api/friendship';
import { acceptGroupInvite, declineGroupInvite, getGroupById, getUserGroupInvites } from '@/lib/api/group';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getUserProfile } from '@/lib/api/user';
import { config, databases } from '@/lib/appwrite/appwrite';
import { useAlert, useAlertHelpers } from '@/lib/context/AlertContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { sendFriendRequestAcceptedNotification } from '@/lib/notifications/notificationUtils';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Query } from 'react-native-appwrite';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserAvatar from './components/UserAvatar';
import { useEvents } from './context/EventContext';


export default function Invites() {
  const { events, refetchEvents } = useEvents();
  const { user: globalUser } = useGlobalContext();
  const [userId, setUserId] = useState('');
  const router = useRouter();
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [groupInvites, setGroupInvites] = useState<any[]>([]);
  const [senderPhotoUrls, setSenderPhotoUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const { showError, showSuccess } = useAlertHelpers();


  // Set user ID from global context
  useEffect(() => {
    if (globalUser?.$id) {
      setUserId(globalUser.$id);
    }
  }, [globalUser]);

  // Fetch friend requests for this user
  useEffect(() => {
    const fetchFriendRequests = async () => {
      if (!userId) {
        return; // Early return if no userId
      }
      try {
        setLoading(true);
        const res = await databases.listDocuments(
          config.databaseID!,
          config.userFriendshipsCollectionID,
          [
            Query.and([
              Query.or([
                Query.equal('userId1', userId),
                Query.equal('userId2', userId)
              ]),
              Query.equal('status', 'pending'),
              Query.notEqual('requesterId', userId) // Exclude requests we sent
            ])
          ]
        );
        const requestsWithSenderNames = await Promise.all(
          res.documents.map(async (req: any) => {
            // Debug the request structure
            console.log('Processing friend request:', {
              id: req.$id,
              userId1: req.userId1,
              userId2: req.userId2,
              requesterId: req.requesterId,
              status: req.status
            });

            // Get the requester ID (the person who sent the request)
            // The requesterId should be the person who initiated the friendship
            let senderProfile = null;
            let actualSenderId = req.requesterId;

            // Fallback logic: if requesterId is missing, determine who sent the request
            if (!actualSenderId) {
              // If userId1 != current user, then userId1 sent the request
              // If userId2 != current user, then userId2 sent the request
              if (req.userId1 && req.userId1 !== userId) {
                actualSenderId = req.userId1;
              } else if (req.userId2 && req.userId2 !== userId) {
                actualSenderId = req.userId2;
              }
            }

            if (actualSenderId && typeof actualSenderId === 'string') {
              try {
                senderProfile = await getUserProfile(actualSenderId);
              } catch (error) {
                console.error('Error fetching sender profile:', actualSenderId, error);
              }
            }

            return {
              ...req,
              requesterId: actualSenderId, // Ensure we have the correct requester ID
              senderName: userDisplayUtils.getFullName(senderProfile || {}, 'Unknown User'),
              from: actualSenderId, // For backward compatibility with existing UI logic
              to: userId
            };
          })
        );
        setFriendRequests(requestsWithSenderNames);

        // Fetch profile photos for senders
        const photoUrls: Record<string, string | null> = {};
        for (const req of res.documents) {
          try {
            const photoUrl = await getUserProfilePhotoUrl(req.from);
            photoUrls[req.from] = photoUrl;
          } catch (error) {
            console.error(`Error fetching photo for sender ${req.from}:`, error);
            photoUrls[req.from] = null;
          }
        }
        setSenderPhotoUrls(photoUrls);
      } catch (error) {
        console.error('Error fetching friend requests:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFriendRequests();
  }, [userId]);

  const handleAcceptFriendRequest = async (request: any) => {
    try {
      // Use the new friendship API for accepting requests
      const result = await acceptFriendRequest(request.$id);

      if (!result.success) {
        showError('Error', `Could not accept friend request: ${result.message}`);
        return;
      }

      // Send notification to the original sender that their request was accepted
      let toProfile = null;
      if (request.to && typeof request.to === 'string') {
        try {
          toProfile = await getUserProfile(request.to);
        } catch (error) {
          console.error('Error fetching profile for notification:', request.to, error);
        }
      }
      if (toProfile) {
        try {
          const accepterName = `${toProfile.firstName} ${toProfile.lastName}`;
          await sendFriendRequestAcceptedNotification(request.from, accepterName, request.to);
        } catch (error) {
          console.error('Error sending friend request notification:', error);
          // Don't fail the whole operation if notification fails
        }
      }

      // Remove the request from the list
      setFriendRequests((prev) => prev.filter((req) => req.$id !== request.$id));
      showSuccess('Success', 'Friend request accepted!');
    } catch (error) {
      console.error('Error accepting friend request:', error);
      showError('Error', 'Could not accept friend request.');
    }
  };

  const handleDeclineFriendRequest = async (request: any) => {
    try {
      // Use the new friendship API for declining requests
      const result = await declineFriendRequest(request.$id);

      if (!result.success) {
        showError('Error', `Could not decline friend request: ${result.message}`);
        return;
      }

      // Remove the request from the list
      setFriendRequests((prev) => prev.filter((req) => req.$id !== request.$id));
      showAlert('Request Declined', 'Friend request declined.', [{ text: 'OK' }], 'info');
    } catch (error) {
      console.error('Error declining friend request:', error);
      showError('Error', 'Could not decline friend request.');
    }
  };

  // Fetch group invites for this user
  useEffect(() => {
    const fetchGroupInvites = async () => {
      if (!userId) return;

      try {
        const invites = await getUserGroupInvites(userId);

        // Enrich invites with group and sender details
        // Note: New system uses groupId, userId, and invitedBy fields
        const invitesArray = Array.isArray(invites) ? invites : [];
        const enrichedInvites = await Promise.all(
          invitesArray.map(async (invite: any) => {
            let group = null;
            let senderProfile = null;

            try {
              group = await getGroupById(invite.groupId);
            } catch (error) {
              console.error('Error fetching group:', invite.groupId, error);
            }

            // Use invitedBy field instead of fromUserId
            if (invite.invitedBy && typeof invite.invitedBy === 'string') {
              try {
                senderProfile = await getUserProfile(invite.invitedBy);
              } catch (error) {
                console.error('Error fetching invite sender profile:', invite.invitedBy, error);
              }
            }

            return {
              ...invite,
              groupTitle: group?.title || 'Unknown Group',
              senderName: userDisplayUtils.getFullName(senderProfile || {}, 'Unknown User')
            };
          })
        );

        setGroupInvites(enrichedInvites);
      } catch (error) {
        console.error('Error fetching group invites:', error);
      }
    };

    fetchGroupInvites();
  }, [userId]);

  const handleAcceptGroupInvite = async (invite: any) => {
    try {
      // New signature: acceptGroupInvite now takes only the membership ID
      const success = await acceptGroupInvite(invite.$id);
      if (success) {
        setGroupInvites(prev => prev.filter(i => i.$id !== invite.$id));
        showAlert('Success', 'You have joined the group!', [{ text: 'OK' }], 'success');
        // The user can navigate to see their groups naturally - don't force navigation
      } else {
        Alert.alert('Error', 'Failed to join group');
      }
    } catch (error) {
      console.error('Error accepting group invite:', error);
      Alert.alert('Error', 'Failed to join group');
    }
  }; const handleDeclineGroupInvite = async (invite: any) => {
    try {
      const success = await declineGroupInvite(invite.$id);
      if (success) {
        setGroupInvites(prev => prev.filter(i => i.$id !== invite.$id));
        showAlert('Invite Declined', 'Group invite declined', [{ text: 'OK' }], 'info');
      } else {
        showError('Error', 'Failed to decline group invite');
      }
    } catch (error) {
      console.error('Error declining group invite:', error);
      showError('Error', 'Failed to decline group invite');
    }
  };

  // Event invites: events where user is invited but not the creator
  const invites = events.filter(
    (event) =>
      userId &&
      event.inviteeIds.includes(userId) &&
      event.creatorId !== userId
  );

  const [invitesWithCreatorNames, setInvitesWithCreatorNames] = useState<any[]>([]);

  useEffect(() => {
    const fetchCreatorNames = async () => {
      const updatedInvites = await Promise.all(
        invites.map(async (event) => {
          let creatorProfile = null;
          if (event.creatorId && typeof event.creatorId === 'string') {
            try {
              creatorProfile = await getUserProfile(event.creatorId);
            } catch (error) {
              console.error('Error fetching event creator profile:', event.creatorId, error);
            }
          }
          return { ...event, creatorName: userDisplayUtils.getFullName(creatorProfile || {}, 'Unknown User') };
        })
      );
      setInvitesWithCreatorNames(updatedInvites);
    };
    if (invites.length > 0) {
      fetchCreatorNames();
    }
  }, [invites]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Enhanced Header with Black Gradient */}
        <View style={styles.header}>
          <LinearGradient
            colors={['#000000', '#1a1a1a', '#2d2d2d']}
            start={[0, 0]}
            end={[1, 1]}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <MaterialIcons name="arrow-back" size={20} color="white" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Invites</Text>
              <View style={styles.headerSpacer} />
            </View>
          </LinearGradient>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Friend Requests Card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <MaterialIcons name="person-add" size={20} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Friend Requests</Text>
                </View>
              </View>

              {friendRequests.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="people-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                    No friend requests
                  </Text>
                </View>
              ) : (
                friendRequests.map((req) => (
                  <View key={req.$id} style={[styles.requestItem, { borderColor: colors.border }]}>
                    <View style={styles.requestInfo}>
                      <UserAvatar
                        photoUrl={senderPhotoUrls[req.from]}
                        name={req.senderName}
                        size={56}
                      />
                      <View style={styles.requestDetails}>
                        <Text style={[styles.requestName, { color: colors.text }]}>
                          {req.senderName}
                        </Text>
                        <Text style={[styles.requestLabel, { color: colors.textSecondary }]}>
                          Wants to be friends
                        </Text>
                      </View>
                    </View>

                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        onPress={() => handleAcceptFriendRequest(req)}
                        style={[styles.acceptButton, { backgroundColor: colors.primary }]}
                      >
                        <MaterialIcons name="check" size={16} color={colors.buttonText} />
                        <Text style={[styles.acceptButtonText, { color: colors.buttonText }]}>Accept</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeclineFriendRequest(req)}
                        style={[styles.declineButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                      >
                        <MaterialIcons name="close" size={16} color={colors.text} />
                        <Text style={[styles.declineButtonText, { color: colors.text }]}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Event Invites Card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <MaterialIcons name="event" size={20} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Event Invites</Text>
                </View>
              </View>

              {invitesWithCreatorNames.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="event-available" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                    No event invites yet
                  </Text>
                </View>
              ) : (
                invitesWithCreatorNames.map((event) => (
                  <View key={event.$id} style={[styles.eventItem, { borderColor: colors.border }]}>
                    <View style={styles.eventHeader}>
                      <Text style={[styles.eventTitle, { color: colors.text }]}>
                        {event.title}
                      </Text>
                      <Text style={[styles.eventCreator, { color: colors.textSecondary }]}>
                        by {event.creatorName}
                      </Text>
                    </View>

                    <View style={styles.eventDetails}>
                      <View style={styles.eventDetailRow}>
                        <MaterialIcons name="location-on" size={16} color={colors.primary} />
                        <Text style={[styles.eventDetailText, { color: colors.textSecondary }]}>
                          {event.location}
                        </Text>
                      </View>
                      <View style={styles.eventDetailRow}>
                        <MaterialIcons name="access-time" size={16} color={colors.primary} />
                        <Text style={[styles.eventDetailText, { color: colors.textSecondary }]}>
                          {new Date(event.startTime).toLocaleDateString()} at {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.acceptButton, { backgroundColor: colors.primary, alignSelf: 'flex-start' }]}
                      onPress={async () => {
                        try {
                          // Use junction table helpers to accept invite
                          await addEventAttendee(event.$id, userId);
                          await removeEventInvitation(event.$id, userId);
                          if (typeof refetchEvents === 'function') {
                            await refetchEvents();
                          }
                          // Remove from local state
                          setInvitesWithCreatorNames(prev => prev.filter(e => e.$id !== event.$id));
                        } catch (err) {
                          console.error("Error accepting event invite:", err);
                        }
                      }}
                    >
                      <MaterialIcons name="check" size={16} color={colors.buttonText} />
                      <Text style={[styles.acceptButtonText, { color: colors.buttonText }]}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* Group Invites Card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <MaterialIcons name="group" size={20} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Group Invites</Text>
                </View>
              </View>

              {groupInvites.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="group-add" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                    No group invites yet
                  </Text>
                </View>
              ) : (
                groupInvites.map((invite) => (
                  <View key={invite.$id} style={[styles.requestItem, { borderColor: colors.border }]}>
                    <View style={styles.requestInfo}>
                      <View style={[styles.groupIcon, { backgroundColor: colors.primary }]}>
                        <MaterialIcons name="group" size={24} color="white" />
                      </View>
                      <View style={styles.requestDetails}>
                        <Text style={[styles.requestName, { color: colors.text }]}>
                          {invite.groupTitle}
                        </Text>
                        <Text style={[styles.requestLabel, { color: colors.textSecondary }]}>
                          Invited by {invite.senderName}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.groupInviteActions}>
                      <TouchableOpacity
                        onPress={() => handleAcceptGroupInvite(invite)}
                        style={[styles.acceptButton, { backgroundColor: colors.primary }]}
                      >
                        <MaterialIcons name="check" size={16} color={colors.buttonText} />
                        <Text style={[styles.acceptButtonText, { color: colors.buttonText }]}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeclineGroupInvite(invite)}
                        style={[styles.declineButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <MaterialIcons name="close" size={16} color={colors.textSecondary} />
                        <Text style={[styles.declineButtonText, { color: colors.textSecondary }]}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 36,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestDetails: {
    marginLeft: 16,
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
  },
  requestLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginLeft: 4,
  },
  requestActions: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    minWidth: 120,
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  eventItem: {
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  eventHeader: {
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventCreator: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  eventDetails: {
    marginBottom: 12,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventDetailText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  groupIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInviteActions: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    minWidth: 120,
  },
  declineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
});