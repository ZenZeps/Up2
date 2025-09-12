import { config, databases } from '@/lib/appwrite/appwrite';
import { syncEventAttendeeCounts, validateEventAttendeeCount } from '@/lib/utils/attendeeCountManager';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AttendeeCountDebugger() {
    const [events, setEvents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [validationResults, setValidationResults] = useState<Record<string, any>>({});

    useEffect(() => {
        loadRecentEvents();
    }, []);

    const loadRecentEvents = async () => {
        try {
            setIsLoading(true);
            const response = await databases.listDocuments(
                config.databaseID!,
                config.eventsCollectionID!,
                []
            );

            // Get the 5 most recent events
            const recentEvents = response.documents.slice(0, 5);
            setEvents(recentEvents);

            // Validate each event's attendee count
            const results: Record<string, any> = {};
            for (const event of recentEvents) {
                try {
                    const validation = await validateEventAttendeeCount(event.$id);
                    results[event.$id] = validation;
                } catch (error) {
                    results[event.$id] = { error: String(error) };
                }
            }
            setValidationResults(results);

        } catch (error) {
            console.error('Failed to load events:', error);
            Alert.alert('Error', 'Failed to load events');
        } finally {
            setIsLoading(false);
        }
    };

    const runFullSync = async () => {
        try {
            setIsLoading(true);
            Alert.alert('Info', 'Starting attendee count sync...');

            const result = await syncEventAttendeeCounts();

            Alert.alert(
                'Sync Complete',
                `Fixed: ${result.fixed} events\nErrors: ${result.errors} events`
            );

            // Reload events to see updated counts
            await loadRecentEvents();

        } catch (error) {
            console.error('Sync failed:', error);
            Alert.alert('Error', 'Sync failed: ' + String(error));
        } finally {
            setIsLoading(false);
        }
    };

    const fixSingleEvent = async (eventId: string) => {
        try {
            const validation = validationResults[eventId];
            if (!validation || validation.isValid) {
                Alert.alert('Info', 'Event already has correct attendee count');
                return;
            }

            // Fix this specific event
            await databases.updateDocument(
                config.databaseID!,
                config.eventsCollectionID!,
                eventId,
                {
                    attendeeCount: validation.actualCount,
                    lastActivityAt: new Date().toISOString(),
                }
            );

            Alert.alert('Success', `Fixed attendee count: ${validation.storedCount} → ${validation.actualCount}`);
            await loadRecentEvents();

        } catch (error) {
            console.error('Failed to fix event:', error);
            Alert.alert('Error', 'Failed to fix event: ' + String(error));
        }
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loading}>Loading...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>🔧 Attendee Count Debugger</Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Configuration Check</Text>
                <Text style={styles.configText}>
                    Junction Collection ID: {config.eventAttendancesCollectionID}
                </Text>
                <Text style={styles.configText}>
                    Is Placeholder: {(config.eventAttendancesCollectionID === 'event_attendances').toString()}
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Events Analysis</Text>
                {events.map((event) => {
                    const validation = validationResults[event.$id];
                    const hasError = validation?.error;
                    const isValid = validation?.isValid;

                    return (
                        <View key={event.$id} style={styles.eventItem}>
                            <Text style={styles.eventTitle}>{event.title}</Text>
                            <Text style={styles.eventId}>ID: {event.$id}</Text>

                            {hasError ? (
                                <Text style={styles.errorText}>Error: {validation.error}</Text>
                            ) : (
                                <View style={styles.countsContainer}>
                                    <Text style={styles.countText}>
                                        Stored: {validation?.storedCount || 'Unknown'}
                                    </Text>
                                    <Text style={styles.countText}>
                                        Actual: {validation?.actualCount || 'Unknown'}
                                    </Text>
                                    <Text style={[styles.statusText, isValid ? styles.validStatus : styles.invalidStatus]}>
                                        {isValid ? '✅ Valid' : '❌ Invalid'}
                                    </Text>
                                </View>
                            )}

                            {!hasError && !isValid && (
                                <TouchableOpacity
                                    style={styles.fixButton}
                                    onPress={() => fixSingleEvent(event.$id)}
                                >
                                    <Text style={styles.fixButtonText}>Fix This Event</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })}
            </View>

            <View style={styles.section}>
                <TouchableOpacity style={styles.actionButton} onPress={loadRecentEvents}>
                    <Text style={styles.actionButtonText}>🔄 Refresh</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={runFullSync}>
                    <Text style={styles.actionButtonText}>🔧 Fix All Events</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    loading: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 50,
    },
    section: {
        backgroundColor: 'white',
        padding: 16,
        marginBottom: 16,
        borderRadius: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    configText: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    eventItem: {
        backgroundColor: '#f9f9f9',
        padding: 12,
        marginBottom: 8,
        borderRadius: 6,
    },
    eventTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    eventId: {
        fontSize: 10,
        color: '#999',
        marginBottom: 8,
    },
    countsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    countText: {
        fontSize: 12,
        color: '#666',
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    validStatus: {
        color: '#10B981',
    },
    invalidStatus: {
        color: '#EF4444',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 12,
    },
    fixButton: {
        backgroundColor: '#3B82F6',
        padding: 8,
        borderRadius: 4,
        marginTop: 8,
    },
    fixButtonText: {
        color: 'white',
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '600',
    },
    actionButton: {
        backgroundColor: '#059669',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    actionButtonText: {
        color: 'white',
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '600',
    },
});
