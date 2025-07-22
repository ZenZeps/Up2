import { getGroupById, getGroupEvents } from '@/lib/api/group';
import { getFriends } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { Event } from '@/lib/types/Events';
import { Group } from '@/lib/types/Groups';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventForm from '../components/EventForm';
import EventItem from '../components/EventItems';

const GroupCalendar = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useGlobalContext();
  const { colors } = useTheme();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  useEffect(() => {
    const loadGroupData = async () => {
      if (!id || typeof id !== 'string') return;

      try {
        setLoading(true);
        
        // Load group details and events in parallel
        const [groupData, groupEvents, userFriends] = await Promise.all([
          getGroupById(id),
          getGroupEvents(id),
          getFriends(user?.$id || '')
        ]);

        setGroup(groupData);
        setEvents((groupEvents || []) as unknown as Event[]);
        setFriends(userFriends || []);
      } catch (error) {
        console.error('Error loading group data:', error);
        Alert.alert('Error', 'Failed to load group information');
      } finally {
        setLoading(false);
      }
    };

    loadGroupData();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 font-rubik" style={{ color: colors.text }}>Loading group calendar...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="flex-1 justify-center items-center px-4">
          <Text className="text-lg font-rubik-semibold mb-2" style={{ color: colors.text }}>Group Not Found</Text>
          <Text className="text-center font-rubik mb-6" style={{ color: colors.textSecondary }}>
            This group may no longer exist or you don't have access to it.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-blue-500 px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-rubik-medium">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleEventPress = (event: Event) => {
    router.push(`/event/${event.$id}`);
  };

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setFormVisible(true);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-4 py-4 border-b" style={{ borderBottomColor: colors.border }}>
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-blue-500 font-rubik-medium">← Back</Text>
          </TouchableOpacity>
          
          <View className="flex-1 items-center mx-4">
            <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>
              {group.title}
            </Text>
            <Text className="text-sm font-rubik" style={{ color: colors.textSecondary }}>
              {group.users?.length || 0} members
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleCreateEvent}
            className="bg-blue-500 px-3 py-1 rounded-lg"
          >
            <Text className="text-white font-rubik-medium text-sm">+ Event</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Events List */}
      <View className="flex-1 px-4 pt-4">
        <Text className="text-lg font-rubik-semibold mb-4" style={{ color: colors.text }}>
          Group Events
        </Text>
        
        <FlatList
          data={events}
          keyExtractor={(item) => item.$id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleEventPress(item)}>
              <EventItem event={item} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center py-12">
              <Text className="text-lg font-rubik-semibold mb-2" style={{ color: colors.text }}>
                No Events Yet
              </Text>
              <Text className="text-center font-rubik mb-6" style={{ color: colors.textSecondary }}>
                Be the first to create an event for this group!
              </Text>
              <TouchableOpacity
                onPress={handleCreateEvent}
                className="bg-blue-500 px-6 py-3 rounded-lg"
              >
                <Text className="text-white font-rubik-medium">Create First Event</Text>
              </TouchableOpacity>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Event Form Modal */}
      {formVisible && (
        <EventForm
          visible={formVisible}
          onClose={() => {
            setFormVisible(false);
            // Refresh events after creating/editing
            const loadGroupData = async () => {
              if (!id || typeof id !== 'string') return;
              try {
                const groupEvents = await getGroupEvents(id);
                setEvents((groupEvents || []) as unknown as Event[]);
              } catch (error) {
                console.error('Error reloading events:', error);
              }
            };
            loadGroupData();
          }}
          event={editingEvent || undefined}
          selectedDateTime={new Date().toISOString()}
          currentUserId={user?.$id || ''}
          friends={friends}
          groupId={group?.$id} // Pass the group ID so events are assigned to this group
        />
      )}
    </SafeAreaView>
  );
};

export default GroupCalendar;
