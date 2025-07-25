import { getEventColor } from '@/constants/categories';
import { getGroupById, getGroupEvents, leaveGroup } from '@/lib/api/group';
import { getProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getUsersByIds } from '@/lib/api/user';
import { config, databases } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { Event as AppEvent } from '@/lib/types/Events';
import { Group } from '@/lib/types/Groups';
import { UserProfile } from '@/lib/types/Users';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventDetailsModal from '../components/EventDetailsModal';
import EventForm from '../components/EventForm';
import UserAvatar from '../components/UserAvatar';

// Define available calendar view modes
const viewModes: Mode[] = ['week', 'month'];

type TabType = 'calendar' | 'agenda';

const GroupPage = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useGlobalContext();
    const { colors } = useTheme();


    // Extract stable values to prevent infinite loops
    const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
    const userId = user?.$id;

    const [group, setGroup] = useState<Group | null>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [members, setMembers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('calendar');
    const [formVisible, setFormVisible] = useState(false);
    const [membersModalVisible, setMembersModalVisible] = useState(false);
    const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);

    // Memoize friends array to prevent infinite re-renders
    const friendIds = useMemo(() => {
        if (!members || !Array.isArray(members)) return [];
        return members.map(m => m.$id);
    }, [members]);

    // Memoize default datetime to prevent re-renders - only calculate once
    const defaultDateTime = useMemo(() => new Date().toISOString(), []);

    // Calendar state - use stable initial values to prevent re-renders
    const [viewMode, setViewMode] = useState<Mode>('week');
    const [date, setDate] = useState(() => new Date()); // Use function to initialize once
    const [startHour] = useState(() => new Date().getHours() - 4); // Use function to initialize once
    const [endHour] = useState(() => new Date().getHours() + 4);   // Use function to initialize once

    useEffect(() => {
        const loadGroupData = async () => {
            if (!groupId || typeof groupId !== 'string') return;

            // Get current user ID inside the function to avoid dependency issues
            const currentUserId = user?.$id;

            try {
                setLoading(true);

                // Load group details and events
                const [groupData, groupEvents] = await Promise.all([
                    getGroupById(groupId),
                    getGroupEvents(groupId)
                ]);

                if (groupData) {
                    setGroup(groupData);
                    console.log('Group data loaded:', groupData);
                    console.log('Group users array:', groupData.users);

                    // Format events for big calendar
                    const formattedEvents = (groupEvents || []).map(event => ({
                        ...event,
                        start: new Date(event.startTime),
                        end: new Date(event.endTime),
                        title: event.title,
                        color: getEventColor(event.tags || []), // Use tags instead of category
                        isAttending: event.attendees?.includes(currentUserId || '') || false,
                    }));
                    setEvents(formattedEvents);

                    // Load member details
                    if (groupData.users && groupData.users.length > 0) {
                        console.log('Raw group users array:', JSON.stringify(groupData.users, null, 2));

                        // Extract user IDs - handle both string IDs and user objects
                        const userIds = groupData.users.map((user: any) => {
                            if (typeof user === 'string') {
                                return user;
                            } else if (user && typeof user === 'object' && user.$id) {
                                return user.$id;
                            } else if (user && typeof user === 'object' && user.id) {
                                return user.id;
                            }
                            console.warn('Invalid user in group.users:', user);
                            return null;
                        }).filter((id: any) => id && typeof id === 'string' && id.length <= 36);

                        console.log('Extracted user IDs:', userIds);

                        if (userIds.length > 0) {
                            const memberProfiles = await getUsersByIds(userIds);
                            setMembers(memberProfiles);
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading group data:', error);
                Alert.alert('Error', 'Failed to load group information');
            } finally {
                setLoading(false);
            }
        };

        loadGroupData();
    }, [groupId]); // Remove userId dependency to prevent infinite loops

    // Memoize event handlers to prevent re-renders
    const handleEventPress = useCallback((event: AppEvent) => {
        setSelectedEvent(event);
        setDetailsModalVisible(true);
    }, []);

    const handleCreateEvent = useCallback(() => {
        setEditingEvent(null);
        setFormVisible(true);
    }, []);

    const handleAttendEvent = useCallback(async (event: AppEvent) => {
        if (!user?.$id) return;

        if (event.attendees?.includes(user.$id)) {
            Alert.alert('Info', 'You are already attending this event.');
            return;
        }

        try {
            const updatedAttendees = [...(event.attendees || []), user.$id];
            await databases.updateDocument(
                config.databaseID!,
                config.eventsCollectionID!,
                event.$id,
                { attendees: updatedAttendees }
            );

            // Update local state
            setEvents(prevEvents =>
                prevEvents.map(e =>
                    e.$id === event.$id
                        ? { ...e, attendees: updatedAttendees, isAttending: true }
                        : e
                )
            );

            Alert.alert('Success', 'You are now attending this event!');
        } catch (err) {
            console.error('Attend event error:', err);
            Alert.alert('Error', 'Failed to attend event');
        }
    }, [user?.$id]);

    const handleNotAttend = useCallback(async (event: AppEvent) => {
        if (!user?.$id) return;

        try {
            const updatedAttendees = (event.attendees || []).filter(id => id !== user.$id);
            await databases.updateDocument(
                config.databaseID!,
                config.eventsCollectionID!,
                event.$id,
                { attendees: updatedAttendees }
            );

            // Update local state
            setEvents(prevEvents =>
                prevEvents.map(e =>
                    e.$id === event.$id
                        ? { ...e, attendees: updatedAttendees, isAttending: false }
                        : e
                )
            );

            Alert.alert('Success', 'You are no longer attending this event.');
        } catch (err) {
            console.error('Not attend event error:', err);
            Alert.alert('Error', 'Failed to update attendance');
        }
    }, [user?.$id]);

    const handleLeaveGroup = useCallback(async () => {
        if (!user?.$id || !groupId || !group) return;

        // Don't allow creator to leave their own group
        if (group.creatorId === user.$id) {
            Alert.alert('Cannot Leave', 'As the group creator, you cannot leave the group. You can delete the group instead.');
            return;
        }

        Alert.alert(
            'Leave Group',
            `Are you sure you want to leave "${group.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await leaveGroup(groupId, user.$id);
                            if (success) {
                                Alert.alert('Success', 'You have left the group.', [
                                    { text: 'OK', onPress: () => router.back() }
                                ]);
                            } else {
                                Alert.alert('Error', 'Failed to leave the group.');
                            }
                        } catch (error) {
                            console.error('Leave group error:', error);
                            Alert.alert('Error', 'Failed to leave the group.');
                        }
                    }
                }
            ]
        );
    }, [user?.$id, groupId, group, router]);

    // Memoize calendar change handler to prevent re-renders
    const handleDateChange = useCallback((dates: any) => {
        if (Array.isArray(dates)) {
            setDate(dates[0]);
        } else {
            setDate(dates);
        }
    }, []);

    const refreshEvents = useCallback(async () => {
        if (!groupId || typeof groupId !== 'string') return;

        // Get current user ID inside the function
        const currentUserId = user?.$id;

        try {
            const groupEvents = await getGroupEvents(groupId);
            const formattedEvents = (groupEvents || []).map(event => ({
                ...event,
                start: new Date(event.startTime),
                end: new Date(event.endTime),
                title: event.title,
                color: getEventColor(event.tags || []), // Use tags instead of category
                isAttending: event.attendees?.includes(currentUserId || '') || false,
            }));
            setEvents(formattedEvents);
        } catch (error) {
            console.error('Error reloading events:', error);
        }
    }, [groupId, user?.$id]);

    // Memoize modal callbacks to prevent re-renders
    const handleModalClose = useCallback(() => {
        setDetailsModalVisible(false);
        setSelectedEvent(null);
    }, []);

    const handleEventEdit = useCallback((event: any) => {
        console.log('Editing event:', event.title);
        setDetailsModalVisible(false);
        setSelectedEvent(null);
    }, []);

    const handleFormClose = useCallback(() => {
        setFormVisible(false);
        refreshEvents();
    }, [refreshEvents]);

    if (loading) {
        return (
            <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text className="mt-4 font-rubik" style={{ color: colors.text }}>Loading group...</Text>
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

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            {/* Header */}
            <View className="px-4 py-4 border-b" style={{ borderBottomColor: colors.border }}>
                <View className="flex-row items-center justify-between mb-3">
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

                    <View className="flex-row space-x-2">
                        <TouchableOpacity
                            onPress={handleCreateEvent}
                            className="bg-blue-500 px-3 py-1 rounded-lg"
                        >
                            <Text className="text-white font-rubik-medium text-sm">+ Event</Text>
                        </TouchableOpacity>

                        {/* Only show Leave Group button if user is not the creator */}
                        {group.creatorId !== user?.$id && (
                            <TouchableOpacity
                                onPress={handleLeaveGroup}
                                className="bg-red-500 px-3 py-1 rounded-lg"
                            >
                                <Text className="text-white font-rubik-medium text-sm">Leave</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Action Buttons */}
                <View className="flex-row justify-center space-x-4">
                    <TouchableOpacity
                        onPress={() => setMembersModalVisible(true)}
                        className="flex-1 bg-gray-100 py-2 rounded-lg mr-2"
                        style={{ backgroundColor: colors.card }}
                    >
                        <Text className="text-center font-rubik-medium" style={{ color: colors.text }}>
                            Members ({members?.length || 0})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => Alert.alert('Coming Soon', 'Messaging functionality will be implemented soon!')}
                        className="flex-1 bg-gray-100 py-2 rounded-lg ml-2"
                        style={{ backgroundColor: colors.card }}
                    >
                        <Text className="text-center font-rubik-medium" style={{ color: colors.text }}>
                            Messages
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Tab Navigation */}
            <View className="flex-row px-4 py-2 border-b" style={{ borderBottomColor: colors.border }}>
                <TouchableOpacity
                    onPress={() => setActiveTab('calendar')}
                    className={`flex-1 py-2 ${activeTab === 'calendar' ? 'border-b-2' : ''}`}
                    style={{ borderBottomColor: activeTab === 'calendar' ? colors.primary : 'transparent' }}
                >
                    <Text
                        className="text-center font-rubik-medium"
                        style={{
                            color: activeTab === 'calendar' ? colors.primary : colors.textSecondary
                        }}
                    >
                        Calendar
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('agenda')}
                    className={`flex-1 py-2 ${activeTab === 'agenda' ? 'border-b-2' : ''}`}
                    style={{ borderBottomColor: activeTab === 'agenda' ? colors.primary : 'transparent' }}
                >
                    <Text
                        className="text-center font-rubik-medium"
                        style={{
                            color: activeTab === 'agenda' ? colors.primary : colors.textSecondary
                        }}
                    >
                        Agenda
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View className="flex-1">
                {activeTab === 'calendar' ? (
                    <View className="flex-1">
                        {/* Calendar Controls */}
                        <View className="flex-row justify-between items-center px-4 py-2" style={{ backgroundColor: colors.card }}>
                            <View className="flex-row">
                                {viewModes.map((mode) => (
                                    <TouchableOpacity
                                        key={mode}
                                        onPress={() => setViewMode(mode)}
                                        className={`px-3 py-1 mr-2 rounded ${viewMode === mode ? 'bg-blue-500' : ''}`}
                                        style={{ backgroundColor: viewMode === mode ? colors.primary : 'transparent' }}
                                    >
                                        <Text
                                            className="font-rubik-medium capitalize"
                                            style={{ color: viewMode === mode ? 'white' : colors.text }}
                                        >
                                            {mode}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity onPress={() => setDate(new Date())}>
                                <Text className="font-rubik-medium" style={{ color: colors.primary }}>Today</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Big Calendar */}
                        <View className="flex-1">
                            <BigCalendar
                                events={events}
                                height={600}
                                mode={viewMode}
                                date={date}
                                onChangeDate={handleDateChange}
                                onPressEvent={handleEventPress}
                                eventCellStyle={(event: any) => ({
                                    backgroundColor: event.color || colors.primary,
                                })}
                                calendarCellStyle={{ backgroundColor: colors.background }}
                                showTime={true}
                                swipeEnabled={true}
                                scrollOffsetMinutes={startHour * 60}
                                theme={{
                                    palette: {
                                        primary: {
                                            main: colors.primary,
                                            contrastText: '#fff',
                                        },
                                        gray: {
                                            100: colors.card,
                                            200: colors.border,
                                            300: colors.textSecondary,
                                            500: colors.text,
                                            800: colors.text,
                                        },
                                    },
                                    typography: {
                                        fontFamily: 'rubik',
                                    },
                                }}
                            />
                        </View>
                    </View>
                ) : (
                    /* Agenda View */
                    <FlatList
                        className="flex-1 px-4 pt-4"
                        data={events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())}
                        keyExtractor={(item) => item.$id}
                        renderItem={({ item }) => (
                            <TouchableOpacity onPress={() => handleEventPress(item)} className="mb-3">
                                <View className="p-4 rounded-lg border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                                    <View className="flex-row items-center justify-between mb-2">
                                        <Text className="text-lg font-rubik-semibold" style={{ color: colors.text }}>
                                            {item.title}
                                        </Text>
                                        <View
                                            className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: item.color || colors.primary }}
                                        />
                                    </View>
                                    <Text className="font-rubik" style={{ color: colors.textSecondary }}>
                                        {new Date(item.start).toLocaleDateString()} at {new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                    <Text className="font-rubik mt-1" style={{ color: colors.textSecondary }}>
                                        {item.attendees?.length || 0} attending
                                    </Text>
                                </View>
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
                )}
            </View>

            {/* Members Modal */}
            <Modal
                visible={membersModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
                    <View className="px-4 py-4 border-b flex-row items-center justify-between" style={{ borderBottomColor: colors.border }}>
                        <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>
                            Group Members
                        </Text>
                        <TouchableOpacity onPress={() => setMembersModalVisible(false)}>
                            <Text className="text-blue-500 font-rubik-medium">Done</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        className="flex-1 px-4"
                        data={members || []}
                        keyExtractor={(item) => item.$id}
                        renderItem={({ item }) => (
                            <View className="flex-row items-center py-3 border-b" style={{ borderBottomColor: colors.border }}>
                                <UserAvatar
                                    photoUrl={item.photoId ? getProfilePhotoUrl(item.photoId) : null}
                                    firstName={item.firstName}
                                    lastName={item.lastName}
                                    size={48}
                                />
                                <View className="flex-1 ml-3">
                                    <Text className="font-rubik-medium" style={{ color: colors.text }}>
                                        {userDisplayUtils.getFullName(item)}
                                    </Text>
                                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                                        {item.email}
                                    </Text>
                                </View>
                                {item.$id === group?.creatorId && (
                                    <View className="bg-blue-100 px-2 py-1 rounded">
                                        <Text className="text-blue-600 text-xs font-rubik-medium">Creator</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    />
                </SafeAreaView>
            </Modal>

            {/* Event Details Modal */}
            {selectedEvent && (
                <EventDetailsModal
                    event={selectedEvent}
                    isCreator={selectedEvent.creator === user?.$id}
                    onClose={handleModalClose}
                    onEdit={handleEventEdit}
                    onAttend={() => handleAttendEvent(selectedEvent)}
                    onNotAttend={() => handleNotAttend(selectedEvent)}
                    currentUserId={user?.$id || ''}
                />
            )}

            {/* Event Form Modal */}
            {formVisible && (
                <EventForm
                    visible={formVisible}
                    onClose={handleFormClose}
                    event={editingEvent || undefined}
                    selectedDateTime={defaultDateTime}
                    currentUserId={user?.$id || ''}
                    friends={friendIds} // Use memoized friends array
                    groupId={group?.$id} // Pass the group ID so events are assigned to this group
                />
            )}
        </SafeAreaView>
    );
};

export default GroupPage;
