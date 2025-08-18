import { getEventColor } from '@/constants/categories';
import { getAllEvents, updateEvent } from '@/lib/api/event';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { account } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { Event as AppEvent } from '@/lib/types/Events';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
                console.log('Friend Calendar: Total events loaded:', allEvents.length);

                // Debug: Log a sample of events to see their structure
                if (allEvents.length > 0) {
                    console.log('Friend Calendar: Sample event structure:', {
                        title: allEvents[0].title,
                        creatorId: allEvents[0].creatorId,
                        attendees: allEvents[0].attendees,
                        attendeeCount: allEvents[0].attendeeCount,
                        hasAttendees: Array.isArray(allEvents[0].attendees)
                    });
                }

                // Filter events for this friend using multiple approaches
                const friendEvents = allEvents.filter(event => {
                    // Approach 1: Check if friend created the event
                    const isCreatedByFriend = event.creatorId === friendId;

                    // Approach 2: Check if friend is in attendees array
                    let isAttendingEvent = false;
                    if (event.attendees && Array.isArray(event.attendees)) {
                        isAttendingEvent = event.attendees.includes(friendId);
                    }

                    // Approach 3: For debugging, let's also check if event has any attendees at all
                    const hasAnyAttendees = event.attendees && Array.isArray(event.attendees) && event.attendees.length > 0;

                    console.log(`Event "${event.title}":`, {
                        eventId: event.$id,
                        creatorId: event.creatorId,
                        friendId: friendId,
                        isCreatedByFriend,
                        attendees: event.attendees,
                        attendeesLength: event.attendees ? event.attendees.length : 'null/undefined',
                        isAttendingEvent,
                        hasAnyAttendees,
                        attendeeCount: event.attendeeCount
                    });

                    const isEventRelatedToFriend = isCreatedByFriend || isAttendingEvent;

                    if (!isEventRelatedToFriend) return false;

                    // If event is private, only show if current user has access
                    if (event.isPrivate) {
                        const hasAccess = event.creatorId === user.$id || // User is creator
                            (event.inviteeIds && event.inviteeIds.includes(user.$id)) || // User is invited
                            (event.attendees && event.attendees.includes(user.$id)); // User is attending

                        console.log(`Private event "${event.title}" access check:`, {
                            creatorId: event.creatorId,
                            currentUserId: user.$id,
                            isCreator: event.creatorId === user.$id,
                            isInvited: event.inviteeIds && event.inviteeIds.includes(user.$id),
                            isAttending: event.attendees && event.attendees.includes(user.$id),
                            hasAccess
                        });

                        return hasAccess;
                    }

                    return true; // Public event, show it
                });

                console.log('Friend Calendar: Filtered events for friend:', friendEvents.length);
                console.log('Friend Calendar: Friend events:', friendEvents.map(e => ({ title: e.title, creator: e.creatorId === friendId ? 'friend' : 'other', attendees: e.attendees })));

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
            // Use updateEvent function to ensure all required fields are included
            await updateEvent(event.$id, {
                attendees: updatedAttendees,
            });

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
            // Use updateEvent function to ensure all required fields are included
            await updateEvent(event.$id, {
                attendees: updatedAttendees,
            });

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
        <SafeAreaView style={styles.container}>
            {/* Modern Black Gradient Header */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#000000', '#1a1a1a', '#2d2d2d']}
                    start={[0, 0]}
                    end={[1, 1]}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            onPress={() => router.push('/(root)/(tabs)/Explore')}
                            style={styles.headerButton}
                        >
                            <MaterialIcons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>
                            {friendName}'s Calendar
                        </Text>
                        <View style={styles.headerButton}>
                            <MaterialIcons name="event" size={24} color="white" />
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* Modern Tab Navigation */}
            <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    onPress={() => setActiveTab('calendar')}
                    style={[
                        styles.tabButton,
                        { borderBottomColor: activeTab === 'calendar' ? colors.primary : 'transparent' }
                    ]}
                >
                    <MaterialIcons
                        name="calendar-today"
                        size={20}
                        color={activeTab === 'calendar' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'calendar' ? colors.primary : colors.textSecondary }
                        ]}
                    >
                        Calendar
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('agenda')}
                    style={[
                        styles.tabButton,
                        { borderBottomColor: activeTab === 'agenda' ? colors.primary : 'transparent' }
                    ]}
                >
                    <MaterialIcons
                        name="view-list"
                        size={20}
                        color={activeTab === 'agenda' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'agenda' ? colors.primary : colors.textSecondary }
                        ]}
                    >
                        Agenda
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content based on active tab */}
            <View style={styles.contentContainer}>
                {activeTab === 'calendar' ? (
                    <View style={styles.calendarContainer}>
                        {/* Calendar Controls */}
                        <View style={[styles.controlsContainer, { backgroundColor: colors.surface }]}>
                            <View style={styles.viewModeContainer}>
                                {viewModes.map((mode) => (
                                    <TouchableOpacity
                                        key={mode}
                                        onPress={() => setViewMode(mode)}
                                        style={[
                                            styles.viewModeButton,
                                            {
                                                backgroundColor: viewMode === mode ? colors.primary : colors.background,
                                                borderColor: colors.border,
                                                borderWidth: viewMode === mode ? 0 : 1,
                                            }
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.viewModeText,
                                                { color: viewMode === mode ? colors.background : colors.text }
                                            ]}
                                        >
                                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                onPress={() => setDate(new Date())}
                                style={styles.todayButton}
                            >
                                <Text style={[styles.todayText, { color: colors.primary }]}>Today</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Calendar component */}
                        <View
                            style={styles.calendarWrapper}
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
                        style={styles.agendaList}
                        data={events
                            .filter(event => new Date(event.startTime) > new Date()) // Only show upcoming events
                            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())}
                        keyExtractor={(item) => item.$id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => handlePressEvent({ rawEvent: item })}
                                style={styles.agendaItemContainer}
                            >
                                <View
                                    style={[
                                        styles.agendaItem,
                                        {
                                            backgroundColor: colors.surface,
                                            borderColor: colors.border,
                                            shadowColor: colors.shadow,
                                        }
                                    ]}
                                >
                                    <Text style={[styles.agendaTitle, { color: colors.text }]}>
                                        {item.title}
                                    </Text>
                                    <Text style={[styles.agendaDetails, { color: colors.textSecondary }]}>
                                        {new Date(item.startTime).toLocaleDateString()} • {item.location}
                                    </Text>
                                    <Text style={[styles.agendaAttendees, { color: colors.textSecondary }]}>
                                        {item.attendees?.length || 0} attendee{(item.attendees?.length || 0) !== 1 ? 's' : ''}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyContainer}>
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    headerContainer: {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
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
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#ffffff',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 16,
    },
    headerButton: {
        padding: 8,
        borderRadius: 8,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        backgroundColor: '#ffffff',
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderBottomWidth: 3,
        borderRadius: 8,
        marginHorizontal: 4,
    },
    tabText: {
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    contentContainer: {
        flex: 1,
    },
    calendarContainer: {
        flex: 1,
    },
    controlsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 8,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    viewModeContainer: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        padding: 2,
    },
    viewModeButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        marginHorizontal: 1,
    },
    viewModeText: {
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    todayButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
    },
    todayText: {
        fontSize: 14,
        fontWeight: '600',
    },
    calendarWrapper: {
        flex: 1,
        marginBottom: 64,
    },
    agendaList: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    agendaItemContainer: {
        marginBottom: 12,
    },
    agendaItem: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    agendaTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    agendaDetails: {
        fontSize: 14,
        marginBottom: 8,
    },
    agendaAttendees: {
        fontSize: 12,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 32,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 16,
    },
});