/**
 * Updated Home screen with optimized data fetching
 * This implements the smart caching strategy where:
 * - Initial mount fetches from database
 * - Subsequent mounts use cache unless user performed actions that affect data
 * - Actions like creating/updating/deleting events trigger database refresh
 */

import { getEventColor, getEventEmoji } from '@/constants/categories';
import { addEventAttendee, enrichEventsWithGroupNames, getUserAttendingEvents, removeEventAttendee } from '@/lib/api/event';
import { getUserGroupInvites } from '@/lib/api/group';
import { getActiveTravelForUser } from '@/lib/api/travel';
import { getUsersByIds } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { authDebug } from '@/lib/debug/authDebug';
import { useGlobalContext } from '@/lib/global-provider';
import { useActionTracker } from '@/lib/hooks/useOptimizedData';
import { Event as AppEvent } from '@/lib/types/Events';
import { TravelAnnouncement } from '@/lib/types/Travel';
import { isEventUpcoming } from '@/lib/utils/attendance';
import { cacheScreenData, shouldFetchData } from '@/lib/utils/dataFetchingOptimizer';
import { isDateInTravelPeriod } from '@/lib/utils/travelCalendarUtils';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as BigCalendar, Mode } from 'react-native-big-calendar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EventDetailsModal from '../components/EventDetailsModal';
import EventForm from '../components/EventForm';
import MessageModal from '../components/MessageModal';
import { useEvents } from '../context/EventContext';

// Define available calendar view modes
const viewModes: Mode[] = ['day', 'week', 'month'];

type TabType = 'calendar' | 'agenda';

// Cache for creator names
const creatorNameCache = new Map<string, string>();

// Helper functions for date formatting
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

// Group events by day
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

export default function Home() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const eventsContext = useEvents();
    const recordAction = useActionTracker();

    // State management
    const [formVisible, setFormVisible] = useState(false);
    const [selectedDateTime, setSelectedDateTime] = useState<string | null>(null);
    const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
    const [viewMode, setViewMode] = useState<Mode>('week');
    const [date, setDate] = useState(() => new Date());
    const [displayedMonth, setDisplayedMonth] = useState(() => new Date());
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
    const [startHour] = useState(() => new Date().getHours() - 4);
    const [endHour] = useState(() => new Date().getHours() + 4);
    const [calendarHeight, setCalendarHeight] = useState(0);
    const [userTravelData, setUserTravelData] = useState<TravelAnnouncement[]>([]);
    const [groupInvites, setGroupInvites] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('agenda');
    const [enrichedEvents, setEnrichedEvents] = useState<AppEvent[]>([]);
    const [agendaEvents, setAgendaEvents] = useState<AppEvent[]>([]);
    const [messageModalVisible, setMessageModalVisible] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isInitialMount, setIsInitialMount] = useState(true);

    // Get user from global context
    const { user: globalUser } = useGlobalContext();
    const currentUser = globalUser;
    const userProfile = currentUser?.profile;

    // Track when data was last fetched
    const lastFetchTime = useRef<number>(0);
    const hasInitialLoad = useRef<boolean>(false);

    // Get route params (for user calendar view)
    const params = useLocalSearchParams();

    /**
     * Optimized data fetching function that uses smart cache strategy
     */
    const fetchHomeData = useCallback(async (forceRefresh = false) => {
        if (!currentUser?.$id) return;

        try {
            setLoading(true);

            // Check if we should fetch from database or use cache
            const strategy = forceRefresh ?
                { shouldFetch: true, reason: 'forced', cacheStrategy: 'database' as const } :
                await shouldFetchData('home', isInitialMount);

            authDebug.debug(`Home: Fetch strategy - ${strategy.cacheStrategy} (${strategy.reason})`);

            let homeEvents: AppEvent[] = [];

            if (strategy.shouldFetch) {
                // Fetch fresh data from database
                authDebug.debug('Home: Fetching fresh data from database');

                // Get events user is attending via junction table
                const attendingEvents = await getUserAttendingEvents(currentUser.$id);

                // Also include events user created
                const allEvents = eventsContext?.events || [];
                const createdEvents = allEvents.filter((e: AppEvent) => e.creatorId === currentUser.$id);

                // Merge and deduplicate
                homeEvents = [...attendingEvents];
                createdEvents.forEach(createdEvent => {
                    if (!attendingEvents.some(attending => attending.$id === createdEvent.$id)) {
                        homeEvents.push(createdEvent);
                    }
                });

                // Enrich events with group names
                const enrichedEvents = await enrichEventsWithGroupNames(homeEvents);

                // Cache the fresh data to memory and storage
                if (eventsContext?.setScreenEvents) {
                    eventsContext.setScreenEvents('home', enrichedEvents);
                }
                await cacheScreenData('home', enrichedEvents);

                setEnrichedEvents(enrichedEvents);

                // Mark that we've loaded from database
                if (eventsContext?.markScreenLoadedFromDb) {
                    eventsContext.markScreenLoadedFromDb('home', true);
                }

                authDebug.debug(`Home: Loaded ${enrichedEvents.length} events from database`);
            } else {
                // Use cached data
                authDebug.debug('Home: Using cached data');

                if (strategy.cacheStrategy === 'memory' && eventsContext?.getScreenEvents) {
                    homeEvents = eventsContext.getScreenEvents('home') || [];
                } else {
                    // Fallback to current events context data
                    homeEvents = eventsContext?.events || [];
                }

                setEnrichedEvents(homeEvents);
                authDebug.debug(`Home: Loaded ${homeEvents.length} events from ${strategy.cacheStrategy} cache`);
            }

            // Process agenda events (upcoming only)
            const upcomingEvents = homeEvents.filter(event => isEventUpcoming(event));
            const agendaEvents = upcomingEvents.map(event => ({
                ...event,
                creatorName: getCreatorName(event.creatorId),
                attendeeCount: typeof (event as any).attendeeCount === 'number' ?
                    (event as any).attendeeCount :
                    (Array.isArray((event as any).attendees) ? (event as any).attendees.length : 0)
            }));

            setAgendaEvents(agendaEvents);
            setIsInitialMount(false);

        } catch (error) {
            authDebug.error('Home: Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [currentUser?.$id, eventsContext, isInitialMount]);

    // Set currentUserId when currentUser changes
    useEffect(() => {
        setCurrentUserId(currentUser?.$id || null);
    }, [currentUser]);

    // Sync displayedMonth with date changes
    useEffect(() => {
        setDisplayedMonth(date);
    }, [date]);

    // Fetch travel data for calendar highlighting
    useEffect(() => {
        const fetchTravelData = async () => {
            if (!currentUser?.$id) return;
            try {
                const travelData = await getActiveTravelForUser(currentUser.$id);
                setUserTravelData(travelData || []);
            } catch (error) {
                authDebug.debug('Home: Error fetching travel data:', error);
            }
        };
        fetchTravelData();
    }, [currentUser?.$id]);

    // Fetch group invites
    useEffect(() => {
        const fetchGroupInvites = async () => {
            if (!currentUser?.$id) return;
            try {
                const invites = await getUserGroupInvites(currentUser.$id);
                setGroupInvites(invites || []);
            } catch (error) {
                authDebug.debug('Home: Error fetching group invites:', error);
            }
        };
        fetchGroupInvites();
    }, [currentUser?.$id]);

    // Creator name cache function
    const getCreatorName = useCallback((creatorId: string): string => {
        return creatorNameCache.get(creatorId) || 'Unknown Creator';
    }, []);

    // Fetch creator names for events
    useEffect(() => {
        const fetchCreatorNames = async () => {
            const creatorIds = [...new Set(enrichedEvents.map(event => event.creatorId))];
            const uncachedIds = creatorIds.filter(id => !creatorNameCache.has(id));

            if (uncachedIds.length > 0) {
                try {
                    const profiles = await getUsersByIds(uncachedIds);
                    profiles.forEach(profile => {
                        if (profile.$id && userDisplayUtils.hasValidName(profile)) {
                            creatorNameCache.set(profile.$id, userDisplayUtils.getFullName(profile));
                        }
                    });
                    // Trigger re-render to update creator names
                    setAgendaEvents(prev => prev.map(event => ({
                        ...event,
                        creatorName: getCreatorName(event.creatorId)
                    })));
                } catch (error) {
                    authDebug.debug('Home: Error fetching creator profiles:', error);
                }
            }
        };

        if (enrichedEvents.length > 0) {
            fetchCreatorNames();
        }
    }, [enrichedEvents, getCreatorName]);

    // Initial data load
    useEffect(() => {
        fetchHomeData();
    }, [fetchHomeData]);

    // Refetch on screen focus
    useFocusEffect(
        useCallback(() => {
            if (!isInitialMount) {
                fetchHomeData();
            }
        }, [fetchHomeData, isInitialMount])
    );

    /**
     * Event action handlers with automatic cache invalidation
     */
    const handleEventCreate = useCallback(async (eventData: Omit<AppEvent, '$id'>) => {
        try {
            if (eventsContext?.addEvent) {
                await eventsContext.addEvent(eventData);
                await recordAction('create', 'home_event_created');
                await fetchHomeData(true); // Force refresh
            }
        } catch (error) {
            authDebug.error('Home: Error creating event:', error);
            throw error;
        }
    }, [eventsContext, recordAction, fetchHomeData]);

    const handleEventUpdate = useCallback(async (eventData: AppEvent) => {
        try {
            if (eventsContext?.updateEvent) {
                await eventsContext.updateEvent(eventData);
                await recordAction('update', 'home_event_updated');
                await fetchHomeData(true); // Force refresh
            }
        } catch (error) {
            authDebug.error('Home: Error updating event:', error);
            throw error;
        }
    }, [eventsContext, recordAction, fetchHomeData]);

    const handleEventDelete = useCallback(async (eventId: string) => {
        try {
            if (eventsContext?.deleteEvent) {
                await eventsContext.deleteEvent(eventId);
                await recordAction('delete', 'home_event_deleted');
                await fetchHomeData(true); // Force refresh
            }
        } catch (error) {
            authDebug.error('Home: Error deleting event:', error);
            throw error;
        }
    }, [eventsContext, recordAction, fetchHomeData]);

    const handleEventAttend = useCallback(async () => {
        if (!selectedEvent || !currentUser?.$id) return;

        try {
            await addEventAttendee(selectedEvent.$id, currentUser.$id);
            setDetailsModalVisible(false);
            await recordAction('attend', 'home_event_attended');
            await fetchHomeData(true); // Force refresh
        } catch (error) {
            authDebug.error('Home: Error attending event:', error);
        }
    }, [selectedEvent, currentUser?.$id, recordAction, fetchHomeData]);

    const handleEventNotAttend = useCallback(async () => {
        if (!selectedEvent || !currentUser?.$id) return;

        try {
            await removeEventAttendee(selectedEvent.$id, currentUser.$id);
            setDetailsModalVisible(false);
            await recordAction('unattend', 'home_event_unattended');
            await fetchHomeData(true); // Force refresh
        } catch (error) {
            authDebug.error('Home: Error not attending event:', error);
        }
    }, [selectedEvent, currentUser?.$id, recordAction, fetchHomeData]);

    const handleEventChat = useCallback((event: AppEvent) => {
        setSelectedEvent(event);
        setDetailsModalVisible(false);
        setMessageModalVisible(true);
    }, []);

    // Manual refresh function
    const handleRefresh = useCallback(async () => {
        await fetchHomeData(true);
    }, [fetchHomeData]);

    // Format events for calendar display
    const calendarEvents = useMemo(() => {
        if (!enrichedEvents || !Array.isArray(enrichedEvents)) {
            return [];
        }

        return enrichedEvents.map((event) => {
            const startDate = new Date(event.startTime);
            const endDate = new Date(event.endTime);
            const eventColor = getEventColor(event.tags?.[0] || 'other');

            return {
                title: event.title,
                start: startDate,
                end: endDate,
                color: eventColor,
                event: event, // Store original event data
            };
        });
    }, [enrichedEvents]);

    // Check if date is in travel period
    const isInTravelPeriod = useCallback((date: Date) => {
        return isDateInTravelPeriod(date, userTravelData);
    }, [userTravelData]);

    const handleDateSelect = (date: Date) => {
        setDate(date);
        setSelectedDateTime(date.toISOString());
        setFormVisible(true);
    };

    const handleEventPress = (event: any) => {
        setSelectedEvent(event.event);
        setDetailsModalVisible(true);
    };

    const handleCloseForm = () => {
        setFormVisible(false);
        setEditingEvent(null);
        setSelectedDateTime(null);
    };

    const handleCloseDetailsModal = () => {
        setDetailsModalVisible(false);
        setSelectedEvent(null);
    };

    const handleEventEdit = (event: AppEvent) => {
        setEditingEvent(event);
        setSelectedEvent(null);
        setDetailsModalVisible(false);
        setFormVisible(true);
    };

    const renderAgendaItem = ({ item }: { item: { date: Date; events: AppEvent[] } }) => (
        <View style={styles.agendaSection}>
            <Text style={[styles.agendaDateHeader, { color: colors.text }]}>
                {formatDateHeader(item.date)}
            </Text>
            {item.events.map((event) => (
                <TouchableOpacity
                    key={event.$id}
                    style={[styles.agendaEventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                        setSelectedEvent(event);
                        setDetailsModalVisible(true);
                    }}
                >
                    <View style={styles.agendaEventHeader}>
                        <View style={styles.agendaEventTitleRow}>
                            <Text style={styles.agendaEventEmoji}>
                                {getEventEmoji(event.tags?.[0] || 'other')}
                            </Text>
                            <Text style={[styles.agendaEventTitle, { color: colors.text }]} numberOfLines={1}>
                                {event.title}
                            </Text>
                        </View>
                        <Text style={[styles.agendaEventTime, { color: colors.textSecondary }]}>
                            {new Date(event.startTime).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                            })}
                        </Text>
                    </View>

                    <View style={styles.agendaEventDetails}>
                        <Text style={[styles.agendaEventLocation, { color: colors.textSecondary }]} numberOfLines={1}>
                            📍 {event.location}
                        </Text>
                        <Text style={[styles.agendaEventCreator, { color: colors.textSecondary }]} numberOfLines={1}>
                            by {(event as any).creatorName}
                        </Text>
                    </View>

                    {(event as any).attendeeCount > 0 && (
                        <View style={styles.agendaEventFooter}>
                            <Text style={[styles.agendaEventAttendees, { color: colors.primary }]}>
                                {(event as any).attendeeCount} {(event as any).attendeeCount === 1 ? 'person' : 'people'} attending
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            ))}
        </View>
    );

    if (loading && isInitialMount) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <Text style={[styles.loadingText, { color: colors.text }]}>Loading your events...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <LinearGradient colors={[colors.primary, colors.primary + '80']} style={styles.headerGradient}>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>Home</Text>
                        <View style={styles.headerActions}>
                            <TouchableOpacity
                                style={[styles.headerButton, { backgroundColor: colors.card }]}
                                onPress={handleRefresh}
                                disabled={loading}
                            >
                                <MaterialIcons name="refresh" size={24} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.headerButton, { backgroundColor: colors.card }]}
                                onPress={() => setFormVisible(true)}
                            >
                                <MaterialIcons name="add" size={24} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* Tab Navigation */}
            <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'agenda' && { borderBottomColor: colors.primary },
                    ]}
                    onPress={() => setActiveTab('agenda')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'agenda' ? colors.primary : colors.textSecondary },
                        ]}
                    >
                        Agenda
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'calendar' && { borderBottomColor: colors.primary },
                    ]}
                    onPress={() => setActiveTab('calendar')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'calendar' ? colors.primary : colors.textSecondary },
                        ]}
                    >
                        Calendar
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {activeTab === 'agenda' ? (
                <FlatList
                    data={groupEventsByDay(agendaEvents)}
                    renderItem={renderAgendaItem}
                    keyExtractor={(item) => item.date.toDateString()}
                    contentContainerStyle={styles.agendaContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialIcons name="event" size={64} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No upcoming events
                            </Text>
                            <TouchableOpacity
                                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                                onPress={() => setFormVisible(true)}
                            >
                                <Text style={styles.emptyButtonText}>Create Event</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            ) : (
                <View style={styles.calendarContainer}>
                    <BigCalendar
                        events={calendarEvents}
                        height={calendarHeight || 600}
                        mode={viewMode}
                        date={date}
                        onChangeDate={setDate}
                        onPressEvent={handleEventPress}
                        onPressDateHeader={handleDateSelect}
                        theme={{
                            palette: {
                                primary: {
                                    main: colors.primary,
                                    contrastText: '#ffffff',
                                },
                                gray: {
                                    100: colors.card,
                                    200: colors.border,
                                    300: colors.textSecondary,
                                    500: colors.text,
                                    800: colors.text,
                                },
                            },
                            isRTL: false,
                        }}
                        eventCellStyle={(event: any) => ({
                            backgroundColor: event.color || colors.primary,
                        })}
                        dayHeaderStyle={{
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                        }}
                        showAdjacentMonths={true}
                        swipeEnabled={true}
                        scrollOffsetMinutes={startHour * 60}
                        start={startHour}
                        end={endHour}
                        renderEvent={(event: any, touchableOpacityProps: any) => (
                            <TouchableOpacity {...touchableOpacityProps}>
                                <View style={styles.calendarEvent}>
                                    <Text style={styles.calendarEventText} numberOfLines={2}>
                                        {event.title}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}

            {/* Modals */}
            <EventForm
                visible={formVisible}
                onClose={handleCloseForm}
                onSubmit={editingEvent ? handleEventUpdate : handleEventCreate}
                initialDateTime={selectedDateTime}
                editingEvent={editingEvent}
            />

            <EventDetailsModal
                visible={detailsModalVisible}
                event={selectedEvent}
                onClose={handleCloseDetailsModal}
                onAttend={handleEventAttend}
                onNotAttend={handleEventNotAttend}
                onEdit={handleEventEdit}
                onDelete={handleEventDelete}
                onChat={handleEventChat}
                currentUserId={currentUserId}
            />

            <MessageModal
                visible={messageModalVisible}
                onClose={() => setMessageModalVisible(false)}
                recipientId={selectedEvent?.creatorId}
                recipientName={(selectedEvent as any)?.creatorName || 'User'}
                eventTitle={selectedEvent?.title}
            />
        </SafeAreaView>
    );
}

// Styles remain the same as your original implementation
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        borderBottomWidth: 1,
    },
    headerGradient: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#ffffff',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    headerButton: {
        padding: 8,
        borderRadius: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        fontWeight: '500',
    },
    tabContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
    },
    agendaContent: {
        padding: 16,
    },
    agendaSection: {
        marginBottom: 24,
    },
    agendaDateHeader: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    agendaEventCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    agendaEventHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    agendaEventTitleRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    agendaEventEmoji: {
        fontSize: 16,
        marginRight: 8,
    },
    agendaEventTitle: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    agendaEventTime: {
        fontSize: 14,
        fontWeight: '500',
    },
    agendaEventDetails: {
        marginBottom: 8,
    },
    agendaEventLocation: {
        fontSize: 14,
        marginBottom: 4,
    },
    agendaEventCreator: {
        fontSize: 14,
    },
    agendaEventFooter: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        paddingTop: 8,
    },
    agendaEventAttendees: {
        fontSize: 12,
        fontWeight: '600',
    },
    calendarContainer: {
        flex: 1,
        padding: 16,
    },
    calendarEvent: {
        flex: 1,
        padding: 4,
        borderRadius: 4,
    },
    calendarEventText: {
        fontSize: 12,
        color: '#ffffff',
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 64,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
        marginTop: 16,
        marginBottom: 24,
    },
    emptyButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    emptyButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
});
