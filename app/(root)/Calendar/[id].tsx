import icons from '@/constants/icons';
import { getAllEvents } from '@/lib/api/event';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { account, config, databases } from '@/lib/appwrite/appwrite';
import { Event as AppEvent } from '@/lib/types/Events';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventDetailsModal from '../components/EventDetailsModal';
import { useEvents } from '../context/EventContext';

// Define available calendar view modes (removed 'day')
const viewModes: Mode[] = ['week', 'month'];

export default function FriendCalendar() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const friendId = params.id as string;
    const { refetchEvents } = useEvents();

    // State variables
    const [viewMode, setViewMode] = useState<Mode>('week');
    const [date, setDate] = useState(new Date());
    const [startHour, setStartHour] = useState(new Date().getHours() - 4);
    const [endHour, setEndHour] = useState(new Date().getHours() + 4);
    const [friendName, setFriendName] = useState('');
    const [events, setEvents] = useState<AppEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Fetch friend's profile and events
    useEffect(() => {
        const fetchFriendData = async () => {
            try {
                // Get current user
                const user = await account.get();
                setCurrentUserId(user.$id);

                // Get friend's profile
                const profile = await getUserProfile(friendId);
                if (!profile) {
                    console.error('Friend profile not found');
                    return;
                }
                setFriendName(profile.name);

                // Get all events
                const allEvents = await getAllEvents();

                // Filter events for this friend (created by them or they're attending)
                const friendEvents = allEvents.filter(event =>
                    event.creatorId === friendId ||
                    (event.attendees && event.attendees.includes(friendId))
                );

                // Add creator names to events
                const uniqueCreatorIds = [...new Set(friendEvents.map(event => event.creatorId))];
                const creatorProfiles = await getUsersByIds(uniqueCreatorIds);
                const creatorMap = new Map(creatorProfiles.map(profile => [profile.$id, profile.name]));

                const eventsWithNames = friendEvents.map(event => ({
                    ...event,
                    creatorName: creatorMap.get(event.creatorId) || 'Unknown Creator',
                    isAttending: event.attendees?.includes(user.$id),
                }));

                setEvents(eventsWithNames);
            } catch (error) {
                console.error('Error fetching friend data:', error);
            }
        };

        if (friendId) {
            fetchFriendData();
        }
    }, [friendId]);

    const handleAttend = async (event: AppEvent) => {
        if (!currentUserId) return;
        if (event.attendees?.includes(currentUserId)) {
            Alert.alert('Info', 'You are already attending this event.');
            return;
        }

        try {
            const updatedAttendees = [...(event.attendees || []), currentUserId];
            await databases.updateDocument(
                config.databaseID!,
                config.eventsCollectionID!,
                event.$id,
                {
                    attendees: updatedAttendees,
                }
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
            refetchEvents();
        } catch (err) {
            console.error('Attend event error:', err);
            Alert.alert('Error', 'Failed to attend event');
        }
    };

    const handleNotAttend = async (event: AppEvent) => {
        if (!currentUserId) return;

        try {
            const updatedAttendees = (event.attendees || []).filter(id => id !== currentUserId);
            await databases.updateDocument(
                config.databaseID!,
                config.eventsCollectionID!,
                event.$id,
                {
                    attendees: updatedAttendees,
                }
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
            refetchEvents();
        } catch (err) {
            console.error('Not attend event error:', err);
            Alert.alert('Error', 'Failed to un-attend event');
        }
    };

    const calendarEvents = events.map((e) => ({
        title: e.title,
        start: new Date(e.startTime),
        end: new Date(e.endTime),
        location: e.location,
        rawEvent: e,
    }));

    const handlePressEvent = (event: any) => {
        setSelectedEvent(event.rawEvent);
        setDetailsModalVisible(true);
    };

    const renderEvent = (event: any, { key, ...touchableOpacityProps }: any) => (
        <TouchableOpacity key={key} {...touchableOpacityProps}>
            <Text style={{ fontSize: 10, color: 'black' }} numberOfLines={1}>{event.title}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1">
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 mb-4">
                    <TouchableOpacity onPress={() => router.back()} className="p-2">
                        <Image source={icons.backArrow} className="w-6 h-6" resizeMode="contain" />
                    </TouchableOpacity>
                    <Text className="text-xl font-rubik-semibold">{friendName}'s Calendar</Text>
                    <View style={{ width: 32 }} /> {/* Empty view for layout balance */}
                </View>

                {/* View Mode Toggle Buttons */}
                <View className="flex-row justify-center mb-4 px-5">
                    {viewModes.map((mode) => (
                        <TouchableOpacity
                            key={mode}
                            onPress={() => setViewMode(mode)}
                            className={`flex-1 items-center py-3 rounded-lg mx-1 ${viewMode === mode ? 'bg-primary-300' : 'bg-gray-200'
                                }`}
                            style={{
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: viewMode === mode ? 0.2 : 0,
                                shadowRadius: 4,
                                elevation: viewMode === mode ? 4 : 0,
                            }}
                        >
                            <Text className={`${viewMode === mode ? 'text-white' : 'text-black'}`}>
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Calendar Card */}
                <View
                    className="flex-1 bg-white rounded-2xl shadow-md mx-5"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.08,
                        shadowRadius: 12,
                        elevation: 6,
                    }}
                >
                    <BigCalendar
                        date={date}
                        showAllDayEventCell={false}
                        events={calendarEvents}
                        height={viewMode === 'month' ? undefined : (Platform.OS === 'ios' ? 640 : 620)}
                        mode={viewMode}
                        onPressEvent={handlePressEvent}
                        renderEvent={renderEvent}
                        dayTextStyle={{ fontSize: 12 }}
                        startHour={startHour}
                        endHour={endHour}
                        eventCellStyle={{
                            backgroundColor: '#E3F2FD',
                            borderColor: '#1E88E5',
                            borderWidth: 1,
                            borderRadius: 0,
                        }}
                        headerContainerStyle={{
                            backgroundColor: 'white',
                            borderBottomWidth: 1,
                            borderBottomColor: '#E0E0E0',
                        }}
                        hourRowStyle={{
                            borderColor: '#F5F5F5',
                        }}
                        bodyContainerStyle={{
                            backgroundColor: 'white',
                        }}
                        nowIndicatorColor="red"
                    />
                </View>

                {/* Event Details Modal */}
                {selectedEvent && (
                    <EventDetailsModal
                        event={selectedEvent}
                        isCreator={false}
                        onClose={() => {
                            setDetailsModalVisible(false);
                            setSelectedEvent(null);
                        }}
                        onEdit={() => { }}
                        onAttend={() => handleAttend(selectedEvent)}
                        onNotAttend={() => handleNotAttend(selectedEvent)}
                        currentUserId={currentUserId}
                    />
                )}
            </View>
        </SafeAreaView>
    );
} 