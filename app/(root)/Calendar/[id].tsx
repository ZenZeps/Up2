import { addEventAttendee, getAllEvents, getEventInvitees, isUserAttendingEvent, removeEventAttendee } from '@/lib/api/event';
import { getUserProfile } from '@/lib/api/user';
import { account } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import { Event as AppEvent } from '@/lib/types/Events';
import { isUserAttendingHeuristic } from '@/lib/utils/attendance';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EventDetailsModal from '../components/EventDetailsModal';
import { useEvents } from '../context/EventContext';

export default function FriendCalendar() {
    const { colors } = useTheme();
    const { refetchEvents } = useEvents();

    const params = ({} as any);
    const friendId = (params as any).id as string || '';

    const [friendName, setFriendName] = useState('Friend');
    const [events, setEvents] = useState<AppEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const user = await account.get();
                setCurrentUserId(user.$id);

                if (!friendId) return;
                const profile = await getUserProfile(friendId);
                if (mounted && profile) setFriendName(userDisplayUtils.getFullName(profile) || 'Friend');

                const all = await getAllEvents(true);
                const out: AppEvent[] = [];

                for (const e of all) {
                    if (e.creatorId === friendId) {
                        if (e.isPrivate) {
                            let allowed = e.creatorId === user.$id;
                            if (!allowed) {
                                try {
                                    const invitees = await getEventInvitees(e.$id);
                                    allowed = Array.isArray(invitees) && invitees.includes(user.$id);
                                } catch {
                                    // Fallback to heuristic when junction invite lookup fails
                                    allowed = isUserAttendingHeuristic(e, user.$id);
                                }
                                if (!allowed) {
                                    try { allowed = await isUserAttendingEvent(user.$id, e.$id); } catch { allowed = false; }
                                }
                            }
                            if (!allowed) continue;
                        }
                        out.push(e);
                        continue;
                    }

                    try {
                        const attending = await isUserAttendingEvent(friendId, e.$id);
                        if (attending) {
                            if (e.isPrivate) {
                                let allowed = e.creatorId === user.$id;
                                if (!allowed) {
                                    try {
                                        const invitees = await getEventInvitees(e.$id);
                                        allowed = Array.isArray(invitees) && invitees.includes(user.$id);
                                    } catch {
                                        allowed = false;
                                    }
                                    if (!allowed) {
                                        try { allowed = await isUserAttendingEvent(user.$id, e.$id); } catch { allowed = false; }
                                    }
                                }
                                if (!allowed) continue;
                            }
                            out.push(e);
                        }
                    } catch (err) {
                        console.warn('check attending failed', err);
                    }
                }

                if (mounted) setEvents(out);
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
            await refetchEvents();
        } catch (err) {
            console.error('Un-attend error', err);
            Alert.alert('Error', 'Could not remove attendance');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ padding: 12 }}>
                <Text style={{ fontSize: 20, fontWeight: '700' }}>{friendName}'s Calendar</Text>
            </View>

            <FlatList
                data={events}
                keyExtractor={(i) => i.$id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => { setSelectedEvent(item); setDetailsModalVisible(true); }}
                        style={{ padding: 12, borderBottomWidth: 1 }}
                    >
                        <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
                        <Text style={{ color: '#666' }}>{new Date(item.startTime).toLocaleString()}</Text>
                        <Text style={{ color: '#666' }}>{(typeof item.attendeeCount === 'number' ? item.attendeeCount : 0)} attending</Text>
                    </TouchableOpacity>
                )}
            />

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
    container: { flex: 1, backgroundColor: '#fff' },
});