import { getEventEmoji } from '@/constants/categories';
import icons from '@/constants/icons';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getFriends, getUserProfile, getUsersByIds } from '@/lib/api/user';
import { config, databases, getCurrentUser } from '@/lib/appwrite/appwrite';
import { sendEventInviteNotification } from '@/lib/notifications/notificationUtils';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import dayjs from 'dayjs';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import ShareInviteModal from '../../../components/ShareInviteModal';
import UserAvatar from '../components/UserAvatar';
import { useEvents } from '../context/EventContext';

const EventDetail = () => {
  const { eventId } = useLocalSearchParams();
  const router = useRouter();
  const { refetchEvents } = useEvents();
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
        const res = await databases.getDocument(
          config.databaseID!,
          config.eventsCollectionID!,
          String(eventId)
        );
        setEvent(res);

        const user = await getCurrentUser();
        setUserId(user?.$id || '');
        setAttending(res.attendees?.includes(user?.$id));

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
      Alert.alert('Info', 'You are already attending this event.');
      return;
    }

    try {
      const updatedAttendees = [...(event.attendees || []), userId];
      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        event.$id,
        {
          attendees: updatedAttendees,
        }
      );
      setEvent({ ...event, attendees: updatedAttendees });
      setAttending(true);
      Alert.alert('Success', 'You are now attending this event!');
      refetchEvents();
    } catch (err) {
      console.error('Attend event error:', err);
      Alert.alert('Error', 'Failed to attend event');
    }
  };

  const handleNotAttend = async () => {
    if (!event || !userId) return;

    try {
      const updatedAttendees = (event.attendees || []).filter((id: string) => id !== userId);
      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        event.$id,
        {
          attendees: updatedAttendees,
        }
      );
      setEvent({ ...event, attendees: updatedAttendees });
      setAttending(false);
      Alert.alert('Success', 'You are no longer attending this event.');
      refetchEvents();
    } catch (err) {
      console.error('Not attend event error:', err);
      Alert.alert('Error', 'Failed to un-attend event');
    }
  };

  const handleInviteFriend = async () => {
    try {
      const friendsList = await getFriends(userId);
      // Filter out friends who are already attendees or invitees
      const availableFriends = friendsList.filter(friend =>
        !event.attendees?.includes(friend.$id) &&
        !event.inviteeIds?.includes(friend.$id)
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

  const inviteFreind = async (friendId: string) => {
    try {
      setInviting(true);

      // Update the event's inviteeIds
      const updatedInviteeIds = [...(event.inviteeIds || []), friendId];

      await databases.updateDocument(
        config.databaseID!,
        config.eventsCollectionID!,
        event.$id,
        {
          inviteeIds: updatedInviteeIds,
        }
      );

      // Update local state
      setEvent({ ...event, inviteeIds: updatedInviteeIds });

      // Reload invitee profiles
      const invitees = await getUsersByIds(updatedInviteeIds);
      setInviteeProfiles(invitees);

      // Send push notification to the invited friend
      await sendEventInviteNotification([friendId], event.title, creatorName, event.$id);

      Alert.alert('Success', 'Friend invited to the event!');
      setShowInviteModal(false);

    } catch (error) {
      console.error('Error inviting friend:', error);
      Alert.alert('Error', 'Failed to invite friend');
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
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#0061FF" />
        <Text className="mt-4 text-gray-500">Loading event...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-red-500">Event not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-100 pt-8">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => router.push('/(root)/(tabs)/Explore')}>
          <Text className="text-lg font-rubik-medium text-black">Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-rubik-semibold">Event Details</Text>
        <View className="flex-row items-center space-x-3">
          <TouchableOpacity onPress={() => setShowShareModal(true)} className="p-1">
            <Image source={icons.send} className="w-6 h-6" resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleInviteFriend} className="p-1">
            <Image source={icons.people} className="w-6 h-6" resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Event Emoji Container */}
        <View className="w-full h-64 bg-gray-100 justify-center items-center">
          <Text className="text-8xl">{getEventEmoji(event?.tags)}</Text>
        </View>

        {/* Creator Info */}
        <View className="flex-row items-center p-4 bg-white border-b border-gray-200">
          <UserAvatar
            photoUrl={creatorPhotoUrl}
            name={creatorName}
            size={40}
            className="mr-3"
          />
          <Text className="font-rubik-semibold text-base">{creatorName}</Text>
        </View>

        {/* Event Details */}
        <View className="p-4 bg-white mb-4">
          <Text className="font-rubik-bold text-2xl mb-2">{event.title}</Text>
          <TouchableOpacity onPress={() => openInMaps(event.location)} className="flex-row items-center mb-2">
            <Image source={icons.location} className="w-4 h-4 mr-1" resizeMode="contain" />
            <Text className="text-blue-600 underline text-base">{event.location}</Text>
          </TouchableOpacity>
          <Text className="text-gray-700 text-sm mb-2">
            {dayjs(event.startTime).format('MMM D, YYYY h:mm A')} - {dayjs(event.endTime).format('h:mm A')}
          </Text>
          <Text className="text-gray-800 text-base">{event.description}</Text>
        </View>

        {/* Attendees and Actions */}
        <View className="p-4 bg-white">
          <Text className="font-rubik-semibold text-lg mb-3">Attendees:</Text>
          {attendeeProfiles.length > 0 ? (
            <View className="mb-4">
              <View className="flex-row flex-wrap items-center">
                {attendeeProfiles.map((profile, index) => (
                  <View key={profile.$id} className="items-center mr-3 mb-3">
                    <UserAvatar
                      photoUrl={attendeePhotoUrls[profile.$id]}
                      firstName={profile.firstName}
                      lastName={profile.lastName}
                      size={40}
                      className="mb-1"
                    />
                    <Text className="text-xs text-gray-600 text-center" numberOfLines={1}>
                      {userDisplayUtils.getFirstName(profile)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text className="text-gray-600 mb-4">No attendees yet.</Text>
          )}

          <Text className="font-rubik-semibold text-lg mb-3">Invitees:</Text>
          {inviteeProfiles.length > 0 ? (
            <View className="mb-4">
              <View className="flex-row flex-wrap items-center">
                {inviteeProfiles.map((profile, index) => (
                  <View key={profile.$id} className="items-center mr-3 mb-3">
                    <UserAvatar
                      photoUrl={inviteePhotoUrls[profile.$id]}
                      firstName={profile.firstName}
                      lastName={profile.lastName}
                      size={40}
                      className="mb-1"
                    />
                    <Text className="text-xs text-gray-600 text-center" numberOfLines={1}>
                      {userDisplayUtils.getFirstName(profile)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text className="text-gray-600 mb-4">No invitees yet.</Text>
          )}

          {!attending ? (
            <TouchableOpacity
              onPress={handleAttend}
              className="bg-primary-300 py-3 rounded-lg items-center mb-4"
            >
              <Text className="text-white font-rubik-semibold text-lg">Attend Event</Text>
            </TouchableOpacity>
          ) : (
            <View className="mb-4">
              <View className="flex-row items-center justify-center bg-green-100 py-3 rounded-lg mb-2">
                <Image source={icons.check} className="w-5 h-5 mr-2" resizeMode="contain" tintColor="#22C55E" />
                <Text className="text-green-600 font-rubik-semibold text-lg">You are attending this event</Text>
              </View>
              <TouchableOpacity
                onPress={handleNotAttend}
                className="bg-gray-500 py-3 rounded-lg items-center"
              >
                <Text className="text-white font-rubik-semibold text-lg">Not Attending</Text>
              </TouchableOpacity>
            </View>
          )}


        </View>
      </ScrollView>

      {/* Invite Friends Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowInviteModal(false)}>
              <Text className="text-lg font-rubik-medium text-black">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-xl font-rubik-semibold">Invite Friends</Text>
            <View style={{ width: 60 }} />
          </View>

          <FlatList
            data={friends}
            keyExtractor={(item) => item.$id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => inviteFreind(item.$id)}
                disabled={inviting}
                className="flex-row items-center p-4 border-b border-gray-100"
              >
                <UserAvatar
                  photoUrl={friendPhotoUrls[item.$id]}
                  firstName={item.firstName}
                  lastName={item.lastName}
                  size={40}
                  className="mr-3"
                />
                <View className="flex-1">
                  <Text className="font-rubik-semibold text-base">
                    {userDisplayUtils.getFullName(item)}
                  </Text>
                </View>
                <Text className="text-blue-500 font-rubik-medium">
                  {inviting ? 'Inviting...' : 'Invite'}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center p-8">
                <Text className="text-gray-500 text-center">
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
    </SafeAreaView>
  );
};

export default EventDetail;