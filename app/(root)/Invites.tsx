import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEvents } from './context/EventContext';
import { getCurrentUser, databases, config } from '@/lib/appwrite/appwrite';
import { useRouter } from 'expo-router';
import { Query } from 'react-native-appwrite';
import { getUserProfile, updateUserProfile } from '@/lib/api/user';
import icons from '@/constants/icons';
import images from '@/constants/images';


export default function Invites() {
  const { events, refetchEvents } = useEvents();
  const [userId, setUserId] = useState('');
  const router = useRouter();
  const [friendRequests, setFriendRequests] = useState<any[]>([]);


  // Fetch current user ID
  useEffect(() => {
    const fetchUser = async () => {
      const user = await getCurrentUser();
      setUserId(user?.$id ?? '');
    };
    fetchUser();
  }, []);

  // Fetch friend requests for this user
  useEffect(() => {
    const fetchFriendRequests = async () => {
      if (!userId) return;
      const res = await databases.listDocuments(
        config.databaseID!,
        config.friendRequestsCollectionID,
        [Query.equal('to', userId), Query.equal('status', 'pending')]
      );
      const requestsWithSenderNames = await Promise.all(
        res.documents.map(async (req) => {
          const senderProfile = await getUserProfile(req.from);
          return { ...req, senderName: senderProfile?.name || 'Unknown User' };
        })
      );
      setFriendRequests(requestsWithSenderNames);
    };
    fetchFriendRequests();
  }, [userId]);

  const handleAcceptFriendRequest = async (request: any) => {
    try {
      const fromProfile = await getUserProfile(request.from);
      const toProfile = await getUserProfile(request.to);

      if (!fromProfile || !toProfile) {
        alert('Could not find user profiles.');
        return;
      }

      const fromFriends = Array.from(new Set([...(fromProfile.friends ?? []), request.to]));
      const toFriends = Array.from(new Set([...(toProfile.friends ?? []), request.from]));

      await updateUserProfile({
        $id: fromProfile.$id,
        name: fromProfile.name,
        email: fromProfile.email,
        isPublic: fromProfile.isPublic,
        preferences: fromProfile.preferences,
        friends: fromFriends,
      });
      await updateUserProfile({
        $id: toProfile.$id,
        name: toProfile.name,
        email: toProfile.email,
        isPublic: toProfile.isPublic,
        preferences: toProfile.preferences,
        friends: toFriends,
      });

      await databases.updateDocument(
        config.databaseID!,
        config.friendRequestsCollectionID,
        request.$id,
        { status: 'accepted' }
      );

      setFriendRequests((prev) => prev.filter((r) => r.$id !== request.$id));
      alert('Friend request accepted!');
    } catch (err) {
      alert('Failed to accept friend request');
      console.error("Accept friend request error:", err);
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
          const creatorProfile = await getUserProfile(event.creatorId);
          return { ...event, creatorName: creatorProfile?.name || 'Unknown User' };
        })
      );
      setInvitesWithCreatorNames(updatedInvites);
    };
    if (invites.length > 0) {
      fetchCreatorNames();
    }
  }, [invites]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-5 pt-5 flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity onPress={() => router.push('/(root)/(tabs)/Explore')}>
            <Image source={icons.backArrow} className="w-6 h-6" resizeMode="contain" />
          </TouchableOpacity>
          <Text className="text-xl font-rubik-semibold">Invites</Text>
          <View className="w-6 h-6" />{/* Spacer to balance header */}
        </View>

        <ScrollView className="flex-1">
          {/* Friend Requests */}
          <Text className="text-lg font-rubik-semibold mb-4">Friend Requests</Text>
          {friendRequests.length === 0 ? (
            <Text className="text-gray-500 mb-4 text-center font-rubik">No friend requests.</Text>
          ) : (
            friendRequests.map((req) => (
              <View key={req.$id} className="flex-row items-center justify-between bg-white p-3 rounded-lg shadow-sm mb-3 border border-gray-100">
                <View className="flex-row items-center">
                  <Image source={images.avatar} className="w-10 h-10 rounded-full mr-3" />
                  <Text className="text-base font-rubik-medium text-gray-800">{req.senderName}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleAcceptFriendRequest(req)}
                  className="bg-primary-300 px-4 py-2 rounded-full shadow-sm"
                >
                  <Text className="text-white font-rubik-medium text-sm">Accept</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* Event Invites */}
          <Text className="text-lg font-rubik-semibold mt-6 mb-4">Event Invites</Text>
          {invitesWithCreatorNames.length === 0 ? (
            <Text className="text-gray-500 mt-4 text-center font-rubik">No event invites yet.</Text>
          ) : (
            invitesWithCreatorNames.map((event) => (
              <View
                key={event.$id}
                className="bg-white p-4 rounded-lg shadow-sm mb-3 border border-gray-100"
              >
                <Text className="text-sm font-rubik text-gray-600 mb-1">Invite from: {event.creatorName}</Text>
                <Text className="text-lg font-rubik-semibold text-gray-900 mb-1">{event.title}</Text>
                <Text className="text-sm font-rubik text-gray-600">{event.location}</Text>
                <Text className="text-xs font-rubik text-gray-500 mt-1">
                  {new Date(event.startTime).toLocaleString()} - {new Date(event.endTime).toLocaleString()}
                </Text>
                <TouchableOpacity
                  className="bg-primary-300 px-4 py-2 rounded-full shadow-sm mt-3 self-start"
                  onPress={async () => {
                    try {
                      // Remove userId from inviteeIds, add to attendingIds
                      const updatedInvitees = event.inviteeIds.filter((id: string) => id !== userId);
                      const updatedAttendees = [...(event.attendees || []), userId];
                      await databases.updateDocument(
                        config.databaseID!,
                        config.eventsCollectionID!,
                        event.$id,
                        { inviteeIds: updatedInvitees, attendees: updatedAttendees }
                      );
                      if (typeof refetchEvents === 'function') {
                        await refetchEvents();
                      }
                      alert('Event invite accepted!');
                    } catch (err) {
                      console.error("Error accepting event invite:", err);
                      alert('Failed to accept event invite');
                    }
                  }}
                >
                  <Text className="text-white font-rubik-medium text-sm">Accept</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}