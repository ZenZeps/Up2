import EventImage from '@/components/EventImage';
import { getEventColor } from '@/constants/categories';
import { getTravelDaysInMonth, getUserTravelAnnouncements } from '@/lib/api';
import { addEventAttendee, getAllEvents, isUserAttendingEvent, removeEventAttendee } from '@/lib/api/event';
import { getUserProfile, getUsersByIds } from '@/lib/api/user';
import { account } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { useEventAttendeeCount } from '@/lib/hooks/useEventAttendeeCount';
import { Event as AppEvent } from '@/lib/types/Events';
import { TravelAnnouncement } from '@/lib/types/Travel';
import { isUserAttendingHeuristic } from '@/lib/utils/attendance';
import { useCreatorInfo } from '@/lib/utils/creatorInfoManager';
import { recordUserAction } from '@/lib/utils/dataFetchingOptimizer';
import {
    formatDateHeader,
    groupEventsByDay,
    transformGroupedEventsForList
} from '@/lib/utils/homeHelpers';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EventDetailsModal from '../../components/modals/EventDetailsModal';
import UserAvatar from '../../components/UserAvatar';
import { useEvents } from '../../context/EventContext';

// Define available calendar view modes (removed 'day')
const viewModes: Mode[] = ['week', 'month'];

type TabType = 'calendar' | 'agenda';

// formatDateHeader is imported from homeHelpers for consistency

// groupEventsByDay is imported from homeHelpers for consistency

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

    // Travel state
    const [userTravel, setUserTravel] = useState<TravelAnnouncement[]>([]);
    const [travelDays, setTravelDays] = useState<Set<string>>(new Set());

    // Additional hooks for Home-style rendering
    const { getAttendeeCount } = useEventAttendeeCount(events, true);

    // Get unique creator IDs from events
    const creatorIds = React.useMemo(() => {
        if (!events || events.length === 0) return [];
        const ids = events
            .map((event: AppEvent) => event.creatorId)
            .filter(Boolean);
        return [...new Set(ids)] as string[];
    }, [events]);

    const { getCreatorPhotoUrl, getCreatorName } = useCreatorInfo(creatorIds, 20);

    // Calendar events - transform events for BigCalendar component
    const calendarEvents = React.useMemo(() => {
        return events.map(event => ({
            title: event.title,
            start: new Date(event.startTime),
            end: new Date(event.endTime),
            location: event.location,
            color: getEventColor(event.tags || []), // Add color based on first tag
            rawEvent: event, // Store the original event for access in renderEvent
        }));
    }, [events]);

    // Agenda events - only show upcoming events for the friends calendar
    const agendaEvents = React.useMemo(() => {
        const now = new Date();
        return events
            .filter(event => {
                const eventDate = new Date(event.startTime);
                return eventDate >= now; // Only show upcoming events
            })
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }, [events]);    // Fetch user's profile and events
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
                const allEvents = await getAllEvents(true);

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
                            // fallback to heuristic which safely checks legacy attendees/invitee arrays
                            if (!isInvitedLegacy && !isUserAttendingHeuristic(event, user.$id)) return null;
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

                // Fetch user's travel data
                const travel = await getUserTravelAnnouncements(userId);
                setUserTravel(travel);

                // Get travel days for the current month (for highlighting)
                const currentDate = new Date();
                const travelDaysInMonth = await getTravelDaysInMonth(
                    userId,
                    currentDate.getFullYear(),
                    currentDate.getMonth() + 1
                );
                setTravelDays(new Set(travelDaysInMonth));
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };

        if (userId) {
            fetchUserData();
        }
    }, [userId]);

    // Update travel days when date changes (for month view highlighting)
    useEffect(() => {
        const updateTravelDays = async () => {
            if (!userId) return;

            try {
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const travelDaysInMonth = await getTravelDaysInMonth(userId, year, month);
                setTravelDays(new Set(travelDaysInMonth));
            } catch (error) {
                console.error('Error updating travel days:', error);
            }
        };

        updateTravelDays();
    }, [date.getFullYear(), date.getMonth(), userId]); // Use primitive values instead of date object

    // Handle date changes from BigCalendar to prevent infinite re-renders
    const handleDateChange = useCallback((range: any) => {
        console.log('handleDateChange called with:', range, typeof range);

        let newDate: Date;

        if (Array.isArray(range) && range.length >= 2) {
            newDate = new Date(range[0]);
            console.log('Array range detected, using first date:', newDate);
        } else if (range && typeof range === 'object') {
            if (range.start) {
                newDate = new Date(range.start);
            } else {
                newDate = new Date(range);
            }
        } else {
            newDate = new Date(range);
        }

        console.log('Setting new date:', newDate);
        setDate(newDate);
    }, []);

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

            // Record the action for cache invalidation
            await recordUserAction('attend', 'user_calendar_event_attended');

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

            // Record the action for cache invalidation
            await recordUserAction('unattend', 'user_calendar_event_unattended');

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

    const handlePressEvent = (event: any) => {
        setSelectedEvent(event.rawEvent);
        setDetailsModalVisible(true);
    };

    const renderEvent = React.useCallback((event: any, touchableOpacityProps: any) => {
        try {
            // Safety checks to prevent rendering invalid events
            if (!event) {
                console.warn('renderEvent: event is null or undefined');
                return null;
            }

            if (!event.rawEvent) {
                console.warn('renderEvent: event.rawEvent is null or undefined');
                return null;
            }

            // Validate essential event properties
            if (!event.rawEvent.title) {
                console.warn('renderEvent: event.rawEvent.title is missing');
                return null;
            }

            const isMonthView = viewMode === 'month';
            const eventColor = event.color || '#000000';

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
                ? hexToRgba(eventColor, 0.8) // Increased opacity for better visibility
                : eventColor; // Full opacity for week/day view

            // For month view, we need to work with the library's positioning but constrain the events
            if (isMonthView) {
                return (
                    <TouchableOpacity
                        {...touchableOpacityProps}
                        style={[
                            touchableOpacityProps.style,
                            {
                                backgroundColor,
                                borderRadius: 3,
                                padding: 0, // Remove padding to eliminate any spacing
                                margin: 0,
                                marginVertical: -1, // Negative margin to eliminate vertical spacing
                                marginHorizontal: 1,
                                minHeight: 14, // Increased from 10 to make events thicker
                                maxHeight: 14, // Increased from 10 to make events thicker
                                height: 14, // Increased from 10 to make events thicker
                                // Override only what's necessary to prevent layout issues
                                overflow: 'hidden',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }
                        ]}
                        onPress={() => handlePressEvent(event)}
                        key={event.rawEvent.$id || `event-${Math.random()}`}
                    >
                        <Text
                            className={`font-rubik-medium`}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={{
                                fontSize: 8, // Slightly increased font size for better readability
                                color: colors.background,
                                textAlign: 'center',
                                lineHeight: 10, // Adjusted for the new height
                                includeFontPadding: false,
                                margin: 0,
                                padding: 0,
                            }}
                        >
                            {event.rawEvent.title || 'Untitled'}
                        </Text>
                    </TouchableOpacity>
                );
            }

            // For week/day view, use the original approach
            return (
                <TouchableOpacity
                    {...touchableOpacityProps}
                    style={[
                        touchableOpacityProps.style,
                        {
                            backgroundColor,
                            padding: 1, // Minimal padding for text readability
                            borderRadius: 4,
                            margin: 0,
                            marginVertical: 0,
                            marginHorizontal: 0,
                        }
                    ]}
                    onPress={() => handlePressEvent(event)}
                    key={event.rawEvent.$id || `event-${Math.random()}`}
                >
                    <Text
                        className={`font-rubik-medium`}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{
                            textAlign: 'center',
                            fontSize: 12,
                            color: colors.background,
                            margin: 0,
                            padding: 0,
                            lineHeight: 12,
                            includeFontPadding: false,
                            textAlignVertical: 'center',
                        }}
                    >
                        {event.title || 'Untitled'}
                    </Text>
                    <Text
                        className="text-white text-xs"
                        style={{
                            textAlign: 'center',
                            marginTop: -2, // Reduce space above location text
                        }}
                    >
                        {event.location || 'No location'}
                    </Text>
                </TouchableOpacity>
            );
        } catch (error) {
            console.error('Error in renderEvent:', error);
            // Return a fallback UI instead of crashing
            return (
                <TouchableOpacity
                    style={[
                        touchableOpacityProps.style,
                        {
                            backgroundColor: colors.error,
                            borderRadius: 4,
                            padding: 4,
                            marginVertical: 1,
                        }
                    ]}
                >
                    <Text style={{ color: 'white', fontSize: 10 }}>Error</Text>
                </TouchableOpacity>
            );
        }
    }, [viewMode, colors, handlePressEvent]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* White Header with Black Text */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {userName}&apos;s Calendar
                </Text>
                <View style={styles.headerRight}>
                    <MaterialIcons name="person" size={24} color="black" />
                </View>
            </View>

            {/* Modern Tab Navigation - matching Home */}
            <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    onPress={() => setActiveTab('agenda')}
                    style={[
                        styles.tabButton,
                        { borderBottomColor: activeTab === 'agenda' ? colors.primary : 'transparent' }
                    ]}
                >
                    <MaterialIcons
                        name="list"
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
            </View>

            {/* Content */}
            <View style={styles.content}>
                {activeTab === 'agenda' ? (
                    /* Modern Agenda View with Day Groupings - matching Home exactly */
                    <FlatList
                        style={[styles.agendaList, { backgroundColor: colors.background }]}
                        data={transformGroupedEventsForList(groupEventsByDay(agendaEvents))}
                        keyExtractor={(item) => item.date.toDateString()}
                        ListHeaderComponent={
                            userTravel.length > 0 ? (
                                <View style={[styles.travelSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <View style={styles.travelHeader}>
                                        <MaterialIcons name="flight" size={20} color={colors.primary} />
                                        <Text style={[styles.travelHeaderText, { color: colors.text }]}>
                                            Travel Plans
                                        </Text>
                                    </View>

                                    {userTravel.slice(0, 3).map((travel) => {
                                        const startDate = new Date(travel.startDate);
                                        const endDate = new Date(travel.endDate);
                                        const now = new Date();
                                        const isCurrentlyTraveling = startDate <= now && now <= endDate;
                                        const isUpcoming = startDate > now;

                                        return (
                                            <View key={travel.$id} style={styles.travelItem}>
                                                <View style={styles.travelItemHeader}>
                                                    <Text style={[styles.travelDestination, { color: colors.text }]}>
                                                        ✈️ {travel.destination}
                                                    </Text>
                                                    {isCurrentlyTraveling && (
                                                        <View style={[styles.travelStatusBadge, { backgroundColor: colors.primary }]}>
                                                            <Text style={styles.travelStatusText}>TRAVELING NOW</Text>
                                                        </View>
                                                    )}
                                                    {isUpcoming && (
                                                        <View style={[styles.travelStatusBadge, { backgroundColor: '#FFA500' }]}>
                                                            <Text style={styles.travelStatusText}>UPCOMING</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={[styles.travelDates, { color: colors.textSecondary }]}>
                                                    {startDate.toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })} - {endDate.toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </Text>
                                                {travel.description && (
                                                    <Text style={[styles.travelDescription, { color: colors.textSecondary }]}>
                                                        {travel.description}
                                                    </Text>
                                                )}
                                            </View>
                                        );
                                    })}

                                    {userTravel.length > 3 && (
                                        <Text style={[styles.travelMoreText, { color: colors.textSecondary }]}>
                                            +{userTravel.length - 3} more travel plans
                                        </Text>
                                    )}
                                </View>
                            ) : null
                        }
                        renderItem={({ item: dayGroup }) => (
                            <View style={styles.dayGroup}>
                                {/* Day Header */}
                                <View style={[styles.dayHeader, { borderBottomColor: colors.border }]}>
                                    <Text style={[styles.dayHeaderText, { color: colors.text }]}>
                                        {formatDateHeader(dayGroup.date)}
                                    </Text>
                                </View>

                                {/* Events for this day - Home-style feed cards */}
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
                                        style={[styles.feedRowCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                                    >
                                        <EventImage
                                            photoId={(item as any).photoId}
                                            tags={item.tags}
                                            size={72}
                                            style={styles.feedThumb}
                                            gradientColors={["#FF6B6B", "#FFD166"]}
                                        />

                                        <View style={styles.feedBody}>
                                            <Text style={[styles.feedTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                                            <View style={styles.feedMetaRow}>
                                                <MaterialIcons name="calendar-today" size={12} color={colors.textSecondary} />
                                                <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginLeft: 6 }]}>{new Date(item.startTime).toLocaleDateString()}</Text>
                                                <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginHorizontal: 8 }]}>•</Text>
                                                <MaterialIcons name="location-on" size={12} color={colors.textSecondary} />
                                                <Text style={[styles.feedMetaText, { color: colors.textSecondary, marginLeft: 6, flexShrink: 1 }]} numberOfLines={1} ellipsizeMode='tail'>{item.location || ''}</Text>
                                            </View>

                                            <View style={styles.feedSubRow}>
                                                <UserAvatar photoUrl={getCreatorPhotoUrl(item.creatorId)} name={getCreatorName(item.creatorId)} size={28} />
                                                <Text style={[styles.smallCreatorName, { color: colors.text, marginLeft: 8 }]} numberOfLines={1}>{getCreatorName(item.creatorId)}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.feedRightCol}>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{getAttendeeCount(item)} attending</Text>
                                                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{(item as any).inviteCount ?? 0} invited</Text>
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
                                    {userName} doesn&apos;t have any upcoming events.
                                </Text>
                            </View>
                        }
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[styles.agendaContent, { paddingBottom: 20 }]}
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
                                    key={`calendar-${viewMode}-${date.getTime()}`}
                                    events={calendarEvents as any[]}
                                    height={calendarHeight}
                                    mode={viewMode}
                                    date={date}
                                    onChangeDate={handleDateChange}
                                    onPressCell={(dateTime) => {
                                        // Handle cell press if needed
                                    }}
                                    onPressEvent={handlePressEvent}
                                    renderEvent={renderEvent}
                                    swipeEnabled={true}
                                    overlapOffset={viewMode === 'month' ? 0 : -12} // Remove overlap offset for month view to prevent positioning issues
                                    ampm={false}
                                    scrollOffsetMinutes={viewMode === 'week' ? 360 : new Date().getHours() * 60 + new Date().getMinutes() - 60} // Start earlier for week view
                                    showTime={false}
                                    eventCellStyle={{
                                        marginVertical: -1, // Negative margin to eliminate vertical spacing between events
                                        marginHorizontal: 1, // Minimal horizontal margin
                                        paddingVertical: 0,
                                        paddingHorizontal: 0,
                                    }}
                                    // Week view specific styling
                                    weekStartsOn={0} // Start week on Sunday
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
        backgroundColor: 'white',
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
        color: 'black',
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
    // Home-style feed card styles - optimized for single-line location text
    feedRowCard: {
        flexDirection: 'row',
        padding: 16,
        marginHorizontal: 12,
        marginBottom: 12,
        borderRadius: 16,
        borderWidth: 1,
        minWidth: '95%', // Ensure wider cards for single-line location text
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    feedThumb: {
        width: 72,
        height: 72,
        borderRadius: 12,
        marginRight: 16,
    },
    feedBody: {
        flex: 2, // Increased flex for more text space
        justifyContent: 'space-between',
    },
    feedTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    feedMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        flexWrap: 'nowrap', // Prevent text wrapping to keep location on one line
        flex: 1,
    },
    feedMetaText: {
        fontSize: 12,
        fontWeight: '500',
    },
    feedSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    smallCreatorName: {
        fontSize: 12,
        fontWeight: '500',
        flex: 1,
    },
    feedRightCol: {
        justifyContent: 'center',
        alignItems: 'flex-end',
        marginLeft: 12,
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
    // Travel styles
    travelSection: {
        margin: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
    },
    travelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    travelHeaderText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    travelItem: {
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    travelItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    travelDestination: {
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
    },
    travelStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginLeft: 8,
    },
    travelStatusText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    travelDates: {
        fontSize: 13,
        marginBottom: 2,
    },
    travelDescription: {
        fontSize: 13,
        fontStyle: 'italic',
    },
    travelMoreText: {
        fontSize: 12,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 8,
    },
});
