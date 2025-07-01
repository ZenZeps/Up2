import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useEvents } from './context/EventContext';
import { getCurrentUser, databases, config } from '@/lib/appwrite/appwrite';
import { useRouter } from 'expo-router';
import { Query } from 'react-native-appwrite';
import { getUserProfile, updateUserProfile } from '@/lib/api/user';


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
        config.friendRequestsCollectionID, // use config, not hardcoded string
        [Query.equal('to', userId), Query.equal('status', 'pending')]
      );
      setFriendRequests(res.documents);
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

  return (
    <ScrollView className="flex-1 bg-white p-4">
      {/* Friend Requests */}
      <Text className="text-2xl font-bold mb-4">Friend Requests</Text>
      {friendRequests.length === 0 ? (
        <Text className="text-gray-400 mb-4">No friend requests.</Text>
      ) : (
        friendRequests.map((req) => (
          <View key={req.$id} className="mb-4 p-4 bg-blue-100 rounded-lg">
            <Text className="mb-2">Friend request from: {req.from}</Text>
            <TouchableOpacity
              className="bg-green-500 rounded px-3 py-2"
              onPress={() => handleAcceptFriendRequest(req)}
            >
              <Text className="text-white text-center">Accept</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Event Invites */}
      <Text className="text-2xl font-bold mb-4">Event Invites</Text>
      {invites.length === 0 ? (
        <Text className="text-gray-400">No event invites yet.</Text>
      ) : (
        invites.map((event) => (
          <View
            key={event.$id}
            className="mb-4 p-4 bg-gray-100 rounded-lg"
          >
            <Text className="text-lg font-semibold">{event.title}</Text>
            <Text className="text-gray-500">{event.location}</Text>
            <Text className="text-gray-400 text-xs">
              {new Date(event.startTime).toLocaleString()} - {new Date(event.endTime).toLocaleString()}
            </Text>
            <TouchableOpacity
              className="bg-green-500 rounded px-3 py-2 mt-2"
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
              <Text className="text-white text-center">Accept</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}