import EventImage from '@/components/EventImage';
import { getEventColor } from '@/constants/categories';
import { addEventAttendee, fetchEvents, getEventInvitees, isUserAttendingEvent, removeEventAttendee } from '@/lib/api/event';
import { getUserProfile } from '@/lib/api/user';
import { account } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { useEventAttendeeCount } from '@/lib/hooks/useEventAttendeeCount';
import { Event as AppEvent } from '@/lib/types/Events';
import { isUserAttendingHeuristic } from '@/lib/utils/attendance';
import { useCreatorInfo } from '@/lib/utils/creatorInfoManager';
import { recordUserAction } from '@/lib/utils/dataFetchingOptimizer';
import { formatDateHeader, groupEventsByDay, transformGroupedEventsForList } from '@/lib/utils/homeHelpers';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EventDetailsModal from '../components/modals/EventDetailsModal';
import UserAvatar from '../components/UserAvatar';
import { useEvents } from '../context/EventContext';

// Using formatDateHeader from homeHelpers for consistency

// We'll use the groupEventsByDay from homeHelpers instead of this local version

export default function FriendCalendar() {
    const { colors } = useTheme();
    const router = useRouter();
    const { refetchEvents } = useEvents();

    const params = ({} as any);
    const friendId = (params as any).id as string || '';

    // Consolidated state for better performance
    const [calendarData, setCalendarData] = useState(() => ({
        friendName: 'Friend',
        events: [] as AppEvent[],
        currentUserId: null as string | null
    }));

    const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<'agenda'>('agenda');

    // Memoized destructuring
    const { friendName, events, currentUserId } = calendarData;

    // Optimized hooks with memoization
    const { getAttendeeCount } = useEventAttendeeCount(events, true);

    // Memoized creator IDs computation
    const creatorIds = React.useMemo(() => {
        if (!events?.length) return [];
        const ids = events
            .map((event: AppEvent) => event.creatorId)
            .filter(Boolean);
        return [...new Set(ids)] as string[];
    }, [events]);

    const { getCreatorPhotoUrl, getCreatorName } = useCreatorInfo(creatorIds, 20);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const user = await account.get();
                if (!friendId || !mounted) return;

                const [profile, allEvents] = await Promise.all([
                    getUserProfile(friendId),
                    fetchEvents(true)
                ]);

                const friendDisplayName = profile ? userDisplayUtils.getFullName(profile) || 'Friend' : 'Friend';
                const filteredEvents: AppEvent[] = [];

                // Optimized event filtering with better logic
                const eventChecks = allEvents.map(async (event) => {
                    // Friend's own events
                    if (event.creatorId === friendId) {
                        if (!event.isPrivate) return event;

                        // Private event access check
                        let hasAccess = event.creatorId === user.$id;
                        if (!hasAccess) {
                            try {
                                const invitees = await getEventInvitees(event.$id);
                                hasAccess = Array.isArray(invitees) && invitees.includes(user.$id);
                            } catch {
                                hasAccess = isUserAttendingHeuristic(event, user.$id);
                                if (!hasAccess) {
                                    try { hasAccess = await isUserAttendingEvent(user.$id, event.$id); } catch { /* ignore */ }
                                }
                            }
                        }
                        return hasAccess ? event : null;
                    }

                    // Events friend is attending
                    try {
                        const attending = await isUserAttendingEvent(friendId, event.$id);
                        if (!attending) return null;

                        if (!event.isPrivate) return event;

                        // Private event access check for current user
                        let hasAccess = event.creatorId === user.$id;
                        if (!hasAccess) {
                            try {
                                const invitees = await getEventInvitees(event.$id);
                                hasAccess = Array.isArray(invitees) && invitees.includes(user.$id);
                            } catch {
                                try { hasAccess = await isUserAttendingEvent(user.$id, event.$id); } catch { /* ignore */ }
                            }
                        }
                        return hasAccess ? event : null;
                    } catch {
                        return null;
                    }
                });

                const eventResults = await Promise.all(eventChecks);
                const validEvents = eventResults.filter((event): event is AppEvent => event !== null);

                if (mounted) {
                    setCalendarData({
                        friendName: friendDisplayName,
                        events: validEvents,
                        currentUserId: user.$id
                    });
                }
            } catch (err) {
                console.error('Friend Calendar load failed', err);
            }
        };

        if (friendId) load();
        return () => { mounted = false; };
    }, [friendId]);

    const handleAttend = async (event: AppEvent) => {
        if (!currentUserId) return;
        try {
            await addEventAttendee(event.$id, currentUserId);

            // Record the action for cache invalidation
            await recordUserAction('attend', 'calendar_event_attended');
            await refetchEvents();
        } catch (err) {
            console.error('Attend error', err);
            Alert.alert('Error', 'Could not attend event');
        }
    };

    const handleNotAttend = async (event: AppEvent) => {
        if (!currentUserId) return;
        try {
            await removeEventAttendee(event.$id, currentUserId);

            // Record the action for cache invalidation
            await recordUserAction('unattend', 'calendar_event_unattended');
            await refetchEvents();
        } catch (err) {
            console.error('Un-attend error', err);
            Alert.alert('Error', 'Could not remove attendance');
        }
    };

    // Memoized grouped events computation
    const groupedEventsRecord = React.useMemo(() => {
        return groupEventsByDay(events);
    }, [events]);

    // Memoized event press handler
    const handlePressEvent = React.useCallback((eventData: {
        id: string;
        title: string;
        start: Date;
        end: Date;
        location?: string;
        color: string;
        rawEvent: AppEvent;
    }) => {
        setSelectedEvent(eventData.rawEvent);
        setDetailsModalVisible(true);
    }, []);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* White Header with Black Text */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {friendName}&apos;s Calendar
                </Text>
                <View style={styles.headerRight}>
                    <MaterialIcons name="person" size={24} color="black" />
                </View>
            </View>

            {/* Tab Container */}
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
            </View>

            {/* Content */}
            <View style={styles.content}>
                {events.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="event-busy" size={64} color={colors.textSecondary} />
                        <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
                            No Events
                        </Text>
                        <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
                            {friendName} hasn&apos;t created any events yet.
                        </Text>
                    </View>
                ) : (
                    /* Modern Agenda View with Day Groupings - matching Home page style */
                    <FlatList
                        style={[styles.agendaList, { backgroundColor: colors.background }]}
                        data={transformGroupedEventsForList(groupedEventsRecord)}
                        keyExtractor={(item) => item.date.toDateString()}
                        renderItem={({ item: dayGroup }) => (
                            <View style={styles.dayGroup}>
                                {/* Day Header */}
                                <View style={[styles.dayHeader, { borderBottomColor: colors.border }]}>
                                    <Text style={[styles.dayHeaderText, { color: colors.text }]}>
                                        {formatDateHeader(dayGroup.date)}
                                    </Text>
                                </View>

                                {/* Events for this day - matching Home page styling */}
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
                                            gradientColors={["#667eea", "#764ba2"]}
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
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[styles.agendaContent, { paddingBottom: 20 }]}
                    />
                )}
            </View>

            {detailsModalVisible && selectedEvent && (
                <EventDetailsModal
                    event={selectedEvent}
                    isCreator={false}
                    onClose={() => { setDetailsModalVisible(false); setSelectedEvent(null); }}
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
    // Home-style feed card styles
    feedRowCard: {
        flexDirection: 'row',
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
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
    feedThumb: {
        width: 72,
        height: 72,
        borderRadius: 12,
        marginRight: 16,
    },
    feedBody: {
        flex: 1,
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
        flexWrap: 'wrap',
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
    agendaContent: {
        paddingTop: 8,
    },
});