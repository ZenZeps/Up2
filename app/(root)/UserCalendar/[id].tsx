import { getEventColor } from '@/constants/categories';
import { addEventAttendee, getAllEvents, isUserAttendingEvent, removeEventAttendee } from '@/lib/api/event';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { account } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { Event as AppEvent } from '@/lib/types/Events';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EventDetailsModal from '../components/EventDetailsModal';
import { useEvents } from '../context/EventContext';

// Define available calendar view modes (removed 'day')
const viewModes: Mode[] = ['week', 'month'];

type TabType = 'calendar' | 'agenda';

// Helper functions for date formatting - copied from Home.tsx
const formatDateHeader = (date: Date): string => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    }

    // Check if it's tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
    }

    // Otherwise, format like "Thu, Sept 4"
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
};

// Group events by day - copied from Home.tsx
const groupEventsByDay = (events: AppEvent[]) => {
    const grouped: { [key: string]: { date: Date; events: AppEvent[] } } = {};

    events.forEach(event => {
        const eventDate = new Date(event.startTime);
        const dateKey = eventDate.toDateString();

        if (!grouped[dateKey]) {
            grouped[dateKey] = {
                date: eventDate,
                events: []
            };
        }

        grouped[dateKey].events.push(event);
    });

    // Sort by date and return as array
    return Object.values(grouped).sort((a, b) => a.date.getTime() - b.date.getTime());
};

export default function UserCalendar() {
    const { colors } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams();
    const userId = params.id as string;
    const { refetchEvents } = useEvents();
    const insets = useSafeAreaInsets();

    // State variables
    const [activeTab, setActiveTab] = useState<TabType>('agenda'); // Default to agenda like homescreen
    const [viewMode, setViewMode] = useState<Mode>('week');
    const [date, setDate] = useState(new Date());
    const [startHour, setStartHour] = useState(new Date().getHours() - 4);
    const [endHour, setEndHour] = useState(new Date().getHours() + 4);
    const [userName, setUserName] = useState('');
    const [events, setEvents] = useState<AppEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [calendarHeight, setCalendarHeight] = useState(0);

    // Fetch user's profile and events
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Get current user
                const user = await account.get();
                setCurrentUserId(user.$id);

                // Get user's profile
                const profile = await getUserProfile(userId);
                if (!profile) {
                    console.error('User profile not found');
                    return;
                }
                setUserName(userDisplayUtils.getFullName(profile));

                // Get all events
                const allEvents = await getAllEvents();

                // Filter events for this user (created by them or they're attending)
                // Use junction table to check attendance
                const userEventPromises = allEvents.map(async (event) => {
                    const isEventRelatedToUser = event.creatorId === userId ||
                        await isUserAttendingEvent(userId, event.$id);

                    if (!isEventRelatedToUser) return null;

                    // If event is private, only show if the target user has access. Prefer junction checks for invitations/attendance.
                    if (event.isPrivate) {
                        // Prefer junction-based access checks; fallback to legacy invite array only if necessary
                        let hasAccess = event.creatorId === user.$id;
                        try {
                            const attending = await isUserAttendingEvent(user.$id, event.$id);
                            hasAccess = hasAccess || Boolean(attending);
                        } catch (e) {
                            // ignore and fallback to legacy invites
                        }

                        if (!hasAccess) {
                            const isInvitedLegacy = Array.isArray((event as any).inviteeIds) && (event as any).inviteeIds.includes(user.$id);
                            if (!isInvitedLegacy) return null;
                        }
                    }

                    return event;
                });

                const userEventsResults = await Promise.all(userEventPromises);
                const userEvents = userEventsResults.filter((event): event is AppEvent => event !== null);

                // Add creator names to events
                const uniqueCreatorIds = [...new Set(userEvents.map(event => event.creatorId))];
                const creatorProfiles = await getUsersByIds(uniqueCreatorIds);
                const creatorMap = new Map(creatorProfiles.map(profile => [profile.$id, userDisplayUtils.getFullName(profile)]));

                // Check attendance for each event using junction table
                const eventsWithAttendance = await Promise.all(
                    userEvents.map(async (event) => {
                        const isAttending = await isUserAttendingEvent(user.$id, event.$id);
                        return {
                            ...event,
                            creatorName: creatorMap.get(event.creatorId) || 'Unknown Creator',
                            isAttending,
                        };
                    })
                );

                setEvents(eventsWithAttendance);
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };

        if (userId) {
            fetchUserData();
        }
    }, [userId]);

    const handleAttend = async (event: AppEvent) => {
        if (!currentUserId) return;

        // Check current attendance status using junction table
        const isCurrentlyAttending = await isUserAttendingEvent(currentUserId, event.$id);

        if (isCurrentlyAttending) {
            Alert.alert('Info', 'You are already attending this event.');
            return;
        }

        try {
            await addEventAttendee(event.$id, currentUserId);

            // Update local state
            setEvents(prevEvents =>
                prevEvents.map(e =>
                    e.$id === event.$id
                        ? { ...e, attendeeCount: (typeof e.attendeeCount === 'number' ? e.attendeeCount + 1 : ((Array.isArray((e as any).attendees) ? (e as any).attendees.length + 1 : 1))), isAttending: true }
                        : e
                )
            );

            Alert.alert('Success', 'You are now attending this event!');
            refetchEvents();
        } catch (err) {
            console.error('Attend event error:', err);
            Alert.alert('Error', 'Failed to attend event');
        }

        // close handleAttend
    };

    const handleNotAttend = async (event: AppEvent) => {
        if (!currentUserId) return;

        try {
            await removeEventAttendee(event.$id, currentUserId);

            // Update local state
            setEvents(prevEvents =>
                prevEvents.map(e =>
                    e.$id === event.$id
                        ? { ...e, attendeeCount: Math.max(0, (typeof e.attendeeCount === 'number' ? e.attendeeCount - 1 : ((Array.isArray((e as any).attendees) ? (e as any).attendees.length - 1 : 0)))), isAttending: false }
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

    // Filter events for agenda view (only future events)
    const agendaEvents = events.filter(event => {
        const eventEnd = new Date(event.endTime);
        const now = new Date();
        return eventEnd > now; // Only show events that haven't ended yet
    });

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
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Black Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {userName}'s Calendar
                </Text>
                <View style={styles.headerRight}>
                    <MaterialIcons name="person" size={24} color="white" />
                </View>
            </View>

            {/* Tab Container - Similar to Home.tsx */}
            <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    onPress={() => setActiveTab('agenda')}
                    style={[
                        styles.tabButton,
                        {
                            borderBottomColor: activeTab === 'agenda' ? colors.primary : 'transparent',
                        }
                    ]}
                >
                    <MaterialIcons
                        name="list"
                        size={18}
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
                <TouchableOpacity
                    onPress={() => setActiveTab('calendar')}
                    style={[
                        styles.tabButton,
                        {
                            borderBottomColor: activeTab === 'calendar' ? colors.primary : 'transparent',
                        }
                    ]}
                >
                    <MaterialIcons
                        name="calendar-today"
                        size={18}
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
            </View>

            {/* Content */}
            <View style={styles.content}>
                {activeTab === 'agenda' ? (
                    /* Modern Agenda View with Day Groupings */
                    <FlatList
                        style={[styles.agendaList, { backgroundColor: colors.background }]}
                        data={groupEventsByDay(agendaEvents)}
                        keyExtractor={(item) => item.date.toDateString()}
                        renderItem={({ item: dayGroup }) => (
                            <View style={styles.dayGroup}>
                                {/* Day Header */}
                                <View style={[styles.dayHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                                    <Text style={[styles.dayHeaderText, { color: colors.text }]}>
                                        {formatDateHeader(dayGroup.date)}
                                    </Text>
                                </View>

                                {/* Events for this day */}
                                {dayGroup.events.map(item => (
                                    <TouchableOpacity
                                        key={item.$id}
                                        onPress={() => handlePressEvent({
                                            id: item.$id,
                                            title: item.title,
                                            start: new Date(item.startTime),
                                            end: new Date(item.endTime),
                                            location: item.location,
                                            color: getEventColor(item.tags || []),
                                            rawEvent: item
                                        })}
                                    >
                                        <View style={[styles.agendaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                            <View style={styles.agendaHeader}>
                                                <Text style={[styles.agendaTitle, { color: colors.text }]} numberOfLines={2}>
                                                    {item.title}
                                                </Text>
                                                <View style={[styles.eventColorDot, { backgroundColor: getEventColor(item.tags || []) || colors.primary }]} />
                                            </View>

                                            <View style={styles.agendaMeta}>
                                                <View style={styles.agendaMetaRow}>
                                                    <MaterialIcons name="access-time" size={16} color={colors.primary} />
                                                    <Text style={[styles.agendaMetaText, { color: colors.textSecondary }]}>
                                                        {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(item.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </Text>
                                                </View>

                                                {(item as any).creatorName && (
                                                    <View style={styles.agendaMetaRow}>
                                                        <MaterialIcons name="person" size={16} color={colors.primary} />
                                                        <Text style={[styles.agendaMetaText, { color: colors.textSecondary }]}>
                                                            By {(item as any).creatorName}
                                                        </Text>
                                                    </View>
                                                )}

                                                {item.location && item.location !== 'No location' && (
                                                    <View style={styles.agendaMetaRow}>
                                                        <MaterialIcons name="location-on" size={16} color={colors.primary} />
                                                        <Text style={[styles.agendaMetaText, { color: colors.textSecondary }]}>
                                                            {item.location}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <MaterialIcons name="event" size={64} color={colors.textSecondary} />
                                <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
                                    No Events
                                </Text>
                                <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
                                    {userName} doesn't have any upcoming events.
                                </Text>
                            </View>
                        }
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[styles.agendaContent, { paddingBottom: 70 + insets.bottom }]}
                    />
                ) : (
                    /* Calendar View */
                    <>
                        {/* View Mode Switcher - Only for Calendar */}
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
                    </>
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
    header: {
        backgroundColor: '#000000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingTop: 20,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 16,
    },
    headerRight: {
        padding: 4,
    },
    // Tab styles - copied from Home.tsx
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderBottomWidth: 2,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 6,
    },
    content: {
        flex: 1,
    },
    // Agenda styles - copied from Home.tsx
    agendaList: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    agendaCard: {
        padding: 16,
        borderRadius: 16,
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
    agendaHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    agendaTitle: {
        fontSize: 18,
        fontWeight: '700',
        flex: 1,
        marginRight: 12,
    },
    eventColorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    agendaMeta: {
        gap: 8,
    },
    agendaMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    agendaMetaText: {
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 8,
    },
    agendaContent: {
        paddingBottom: 16,
    },
    dayGroup: {
        marginBottom: 16,
    },
    dayHeader: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        marginHorizontal: 16,
        borderRadius: 8,
        marginBottom: 8,
    },
    dayHeaderText: {
        fontSize: 18,
        fontWeight: '700',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyStateTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateDescription: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    // Calendar styles - existing
    controlsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    viewModeContainer: {
        flexDirection: 'row',
    },
    viewModeButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
        borderRadius: 6,
    },
    viewModeText: {
        fontSize: 14,
        fontWeight: '500',
    },
    todayButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    todayText: {
        fontSize: 14,
        fontWeight: '500',
    },
    calendarWrapper: {
        flex: 1,
    },
});
