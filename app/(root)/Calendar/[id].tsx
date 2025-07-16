import { getEventColor } from '@/constants/categories';
import icons from '@/constants/icons';
import { getAllEvents } from '@/lib/api/event';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { account, config, databases } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { Event as AppEvent } from '@/lib/types/Events';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventDetailsModal from '../components/EventDetailsModal';
import { useEvents } from '../context/EventContext';

// Define available calendar view modes (removed 'day')
const viewModes: Mode[] = ['week', 'month'];

export default function FriendCalendar() {
    const { colors } = useTheme();
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
    const [calendarHeight, setCalendarHeight] = useState(0);

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
                setFriendName(userDisplayUtils.getFullName(profile));

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
                const creatorMap = new Map(creatorProfiles.map(profile => [profile.$id, userDisplayUtils.getFullName(profile)]));

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
        color: getEventColor(e.tags || []), // Add color based on first tag
        rawEvent: e,
    }));

    const handlePressEvent = (event: any) => {
        setSelectedEvent(event.rawEvent);
        setDetailsModalVisible(true);
    };

    const renderEvent = (event: any, touchableOpacityProps: any) => {
        // Safety check to prevent rendering invalid events
        if (!event || !event.rawEvent) {
            return null;
        }

        const isMonthView = viewMode === 'month';
        const eventColor = event.color || colors.primary;

        // Convert hex color to rgba for opacity in month view
        const hexToRgba = (hex: string, alpha: number) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        const backgroundColor = isMonthView
            ? hexToRgba(eventColor, 0.4) // 40% opacity for month view
            : eventColor; // Full opacity for week view

        return (
            <TouchableOpacity
                {...touchableOpacityProps}
                style={[
                    touchableOpacityProps.style, // Preserve original calendar positioning styles
                    {
                        backgroundColor,
                        padding: 4,
                        borderRadius: 6,
                    }
                ]}
                onPress={() => handlePressEvent(event)}
                key={event.rawEvent.$id || `event-${Math.random()}`} // Ensure unique key
            >
                <Text
                    className={`text-xs font-rubik-medium ${isMonthView ? 'text-black-300' : 'text-white'
                        }`}
                    numberOfLines={1}
                >
                    {event.title || 'Untitled'}
                </Text>
                {!isMonthView && (
                    <>
                        <Text className="text-white text-xs">
                            {event.location || 'No location'}
                        </Text>
                        <Text className="text-white text-xs">
                            {event.rawEvent?.creatorName || 'Unknown'}
                        </Text>
                    </>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="flex-row items-center justify-between p-4">
                <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <Image source={icons.backArrow} className="w-6 h-6" resizeMode="contain" />
                </TouchableOpacity>
                <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>
                    {friendName}'s Calendar
                </Text>
                {/* View mode switcher moved to top right */}
                <View className="flex-row">
                    {viewModes.map((mode) => (
                        <TouchableOpacity
                            key={mode}
                            onPress={() => setViewMode(mode)}
                            className={`px-3 py-1 rounded-full mx-1`}
                            style={{
                                backgroundColor: viewMode === mode ? colors.primary : colors.surface
                            }}
                        >
                            <Text
                                className="font-rubik"
                                style={{
                                    color: viewMode === mode ? colors.background : colors.text
                                }}
                            >
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Calendar component */}
            <View
                className="flex-1"
                onLayout={(event) => {
                    const { height } = event.nativeEvent.layout;
                    setCalendarHeight(height);
                }}
            >
                {calendarHeight > 0 && (
                    <BigCalendar
                        events={calendarEvents as any[]}
                        height={calendarHeight}
                        mode={viewMode}
                        date={date}
                        onPressEvent={handlePressEvent}
                        renderEvent={renderEvent}
                        swipeEnabled={true}
                        overlapOffset={8}
                        ampm={false}
                        headerContainerStyle={{
                            height: 50,
                            backgroundColor: colors.surface,
                        }}
                    />
                )}
            </View>

            {/* Event Details Modal */}
            {detailsModalVisible && selectedEvent && (
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
                    currentUserId={currentUserId || ''}
                />
            )}
        </SafeAreaView>
    );
} 