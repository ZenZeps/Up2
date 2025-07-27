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
import { Alert, FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventDetailsModal from '../components/EventDetailsModal';
import { useEvents } from '../context/EventContext';

// Define available calendar view modes (removed 'day')
const viewModes: Mode[] = ['week', 'month'];

type TabType = 'calendar' | 'agenda';

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
    const [activeTab, setActiveTab] = useState<TabType>('calendar');

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
                // Also filter out private events unless current user is creator, invitee, or attendee
                const friendEvents = allEvents.filter(event => {
                    const isEventRelatedToFriend = event.creatorId === friendId ||
                        (event.attendees && event.attendees.includes(friendId));

                    if (!isEventRelatedToFriend) return false;

                    // If event is private, only show if current user has access
                    if (event.isPrivate) {
                        return event.creatorId === user.$id || // User is creator
                            (event.inviteeIds && event.inviteeIds.includes(user.$id)) || // User is invited
                            (event.attendees && event.attendees.includes(user.$id)); // User is attending
                    }

                    return true; // Public event, show it
                });

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
            try {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            } catch (error) {
                console.warn('Error converting hex to rgba:', error);
                return hex; // Return original hex if conversion fails
            }
        };

        const backgroundColor = isMonthView
            ? hexToRgba(eventColor, 0.7) // Increased opacity for better visibility
            : eventColor; // Full opacity for week view

        return (
            <TouchableOpacity
                {...touchableOpacityProps}
                style={[
                    touchableOpacityProps.style, // Preserve original calendar positioning styles
                    {
                        backgroundColor,
                        padding: isMonthView ? 0 : 1, // Reduced padding for week/day view
                        borderRadius: isMonthView ? 2 : 4,
                        margin: 0,
                        flex: 0,
                        // For month view, position events below the date number with more spacing
                        ...(isMonthView && {
                            position: 'absolute',
                            bottom: 1,
                            left: 1,
                            right: 1,
                            height: 14,
                            minHeight: 14,
                            maxHeight: 14,
                            top: 28, // Push events down below the date number area
                        }),
                    }
                ]}
                onPress={() => handlePressEvent(event)}
                key={event.rawEvent.$id || `event-${Math.random()}`} // Ensure unique key
            >
                <Text
                    className={`font-rubik-medium`}
                    numberOfLines={1}
                    style={{
                        textAlign: 'center',
                        fontSize: isMonthView ? 10 : 12,
                        color: colors.background, // Use background color (white in dark mode)
                        marginBottom: isMonthView ? 0 : -2, // Reduce space below title in week/day view
                    }}
                >
                    {event.title || 'Untitled'}
                </Text>
                {!isMonthView && (
                    <>
                        <Text
                            className="text-xs"
                            style={{
                                color: colors.background,
                                textAlign: 'center'
                            }}
                        >
                            {event.location || 'No location'}
                        </Text>
                        <Text
                            className="text-xs"
                            style={{
                                color: colors.background,
                                textAlign: 'center'
                            }}
                        >
                            {event.rawEvent?.creatorName || 'Unknown'}
                        </Text>
                    </>
                )}
            </TouchableOpacity>
        );
    };

    // Custom date renderer for month view
    const renderCustomDateForMonth = (date: Date) => {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    minHeight: 32,
                    paddingTop: 2,
                }}
            >
                <View
                    style={{
                        width: 24,
                        height: 24,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 12,
                        backgroundColor: 'transparent',
                    }}
                >
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: 'normal',
                            color: colors.text,
                        }}
                    >
                        {date.getDate()}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            {/* Header */}
            <View className="px-0 py-0 border-b" style={{ borderBottomColor: colors.border }}>
                <View className="flex-row items-center justify-between px-4 py-3">
                    <TouchableOpacity
                        onPress={() => router.push('/(root)/(tabs)/Explore')}
                        className="p-2 -ml-2"
                    >
                        <Image
                            source={icons.backArrow}
                            className="w-6 h-6"
                            resizeMode="contain"
                            style={{ tintColor: colors.text }}
                        />
                    </TouchableOpacity>
                    <Text className="text-xl font-rubik-semibold flex-1 text-center" style={{ color: colors.text }}>
                        {friendName}'s Calendar
                    </Text>
                    {/* Spacer to balance the layout */}
                    <View className="w-20" />
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

            {/* Content based on active tab */}
            <View className="flex-1">
                {activeTab === 'calendar' ? (
                    <View className="flex-1">
                        {/* Calendar Controls */}
                        <View className="flex-row justify-between items-center px-4 py-2" style={{ backgroundColor: colors.surface }}>
                            <View className="flex-row">
                                {viewModes.map((mode) => (
                                    <TouchableOpacity
                                        key={mode}
                                        onPress={() => setViewMode(mode)}
                                        className={`px-3 py-1 mr-2 rounded ${viewMode === mode ? 'bg-blue-500' : ''}`}
                                        style={{
                                            backgroundColor: viewMode === mode ? colors.primary : colors.background,
                                            borderWidth: viewMode === mode ? 0 : 1,
                                            borderColor: colors.border,
                                        }}
                                    >
                                        <Text
                                            className="font-rubik-medium capitalize"
                                            style={{ color: viewMode === mode ? colors.background : colors.text }}
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

                        {/* Calendar component */}
                        <View
                            className="flex-1 mb-16"
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
                                    onChangeDate={(dates) => setDate(dates[0])}
                                    onPressEvent={handlePressEvent}
                                    renderEvent={renderEvent}
                                    renderCustomDateForMonth={renderCustomDateForMonth}
                                    swipeEnabled={true}
                                    overlapOffset={0}
                                    ampm={false}
                                    scrollOffsetMinutes={0}
                                    headerContainerStyle={{
                                        height: 53,
                                        backgroundColor: colors.surface,
                                    }}
                                    bodyContainerStyle={{
                                        paddingBottom: 0,
                                    }}
                                />
                            )}
                        </View>
                    </View>
                ) : (
                    /* Agenda View */
                    <FlatList
                        className="flex-1 px-4 pt-4"
                        data={events
                            .filter(event => new Date(event.startTime) > new Date()) // Only show upcoming events
                            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())}
                        keyExtractor={(item) => item.$id}
                        renderItem={({ item }) => (
                            <TouchableOpacity onPress={() => handlePressEvent({ rawEvent: item })} className="mb-3">
                                <View
                                    className="p-4 rounded-lg border"
                                    style={{
                                        backgroundColor: colors.surface, // Use surface color for better contrast
                                        borderColor: colors.border,
                                        shadowColor: colors.shadow,
                                        shadowOffset: { width: 0, height: 1 },
                                        shadowOpacity: 0.2,
                                        shadowRadius: 2,
                                        elevation: 2,
                                    }}
                                >
                                    <Text className="font-rubik-semibold text-lg mb-1" style={{ color: colors.text }}>
                                        {item.title}
                                    </Text>
                                    <Text className="font-rubik text-sm mb-2" style={{ color: colors.textSecondary }}>
                                        {new Date(item.startTime).toLocaleDateString()} • {item.location}
                                    </Text>
                                    <Text className="font-rubik text-xs" style={{ color: colors.textSecondary }}>
                                        {item.attendees?.length || 0} attendee{(item.attendees?.length || 0) !== 1 ? 's' : ''}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={() => (
                            <View className="flex-1 justify-center items-center py-8">
                                <Text className="text-center font-rubik" style={{ color: colors.textSecondary }}>
                                    No upcoming events found for {friendName}
                                </Text>
                            </View>
                        )}
                        showsVerticalScrollIndicator={false}
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