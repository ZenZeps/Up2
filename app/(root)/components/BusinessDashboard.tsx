import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ticketService from '../../../lib/api/ticket';
import { BusinessEvent, TicketSales } from '../../../lib/types/BusinessEvent';

const BusinessDashboard: React.FC = () => {
    const [events, setEvents] = useState<BusinessEvent[]>([]);
    const [salesData, setSalesData] = useState<TicketSales[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            // Load business events created by current user
            const businessEvents = await ticketService.getBusinessEvents();
            setEvents(businessEvents);

            // Load sales data for each event
            const salesPromises = businessEvents.map(event =>
                ticketService.getEventSales(event.$id)
            );
            const salesResults = await Promise.all(salesPromises);
            setSalesData(salesResults);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            Alert.alert('Error', 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadDashboardData();
        setRefreshing(false);
    };

    const formatPrice = (priceInCents: number, currency: string = 'USD'): string => {
        return `${currency} ${(priceInCents / 100).toFixed(2)}`;
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getTotalEarnings = (): number => {
        return salesData.reduce((total, sales) => total + sales.organizerEarnings, 0);
    };

    const getTotalTicketsSold = (): number => {
        return salesData.reduce((total, sales) => total + sales.totalTicketsSold, 0);
    };

    const getTotalRevenue = (): number => {
        return salesData.reduce((total, sales) => total + sales.totalRevenue, 0);
    };

    const renderEventCard = ({ item: event }: { item: BusinessEvent }) => {
        const eventSales = salesData.find(sales => sales.eventId === event.$id);
        const ticketsRemaining = event.maxTickets ? event.maxTickets - event.ticketsSold : null;

        return (
            <View style={styles.eventCard}>
                <View style={styles.eventHeader}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventDate}>{formatDate(event.startTime)}</Text>
                </View>

                <View style={styles.eventStats}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{event.ticketsSold}</Text>
                        <Text style={styles.statLabel}>Sold</Text>
                    </View>

                    {ticketsRemaining !== null && (
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{ticketsRemaining}</Text>
                            <Text style={styles.statLabel}>Remaining</Text>
                        </View>
                    )}

                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {eventSales ? formatPrice(eventSales.totalRevenue, event.currency) : '$0.00'}
                        </Text>
                        <Text style={styles.statLabel}>Revenue</Text>
                    </View>

                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {eventSales ? formatPrice(eventSales.organizerEarnings, event.currency) : '$0.00'}
                        </Text>
                        <Text style={styles.statLabel}>Your Earnings</Text>
                    </View>
                </View>

                <View style={styles.eventActions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => router.push(`/(root)/EventAnalytics?eventId=${event.$id}`)}
                    >
                        <Text style={styles.actionButtonText}>View Analytics</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.secondaryButton]}
                        onPress={() => router.push(`/(root)/ScanTickets?eventId=${event.$id}`)}
                    >
                        <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                            Scan Tickets
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderOverallStats = () => (
        <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>Overall Performance</Text>

            <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                    <Text style={styles.statCardValue}>{events.length}</Text>
                    <Text style={styles.statCardLabel}>Total Events</Text>
                </View>

                <View style={styles.statCard}>
                    <Text style={styles.statCardValue}>{getTotalTicketsSold()}</Text>
                    <Text style={styles.statCardLabel}>Tickets Sold</Text>
                </View>

                <View style={styles.statCard}>
                    <Text style={styles.statCardValue}>
                        {formatPrice(getTotalRevenue())}
                    </Text>
                    <Text style={styles.statCardLabel}>Total Revenue</Text>
                </View>

                <View style={styles.statCard}>
                    <Text style={styles.statCardValue}>
                        {formatPrice(getTotalEarnings())}
                    </Text>
                    <Text style={styles.statCardLabel}>Your Earnings</Text>
                </View>
            </View>
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>Start Earning Revenue</Text>
            <Text style={styles.emptyStateText}>
                Create your first business event and start selling tickets to generate income.
            </Text>
            <TouchableOpacity
                style={styles.createButton}
                onPress={() => router.push('/(root)/CreateBusinessEvent')}
            >
                <Text style={styles.createButtonText}>Create Business Event</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Business Dashboard</Text>
                <TouchableOpacity
                    style={styles.createEventButton}
                    onPress={() => router.push('/(root)/CreateBusinessEvent')}
                >
                    <Text style={styles.createEventButtonText}>+ New Event</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
            >
                {events.length > 0 ? (
                    <>
                        {renderOverallStats()}

                        <View style={styles.eventsSection}>
                            <Text style={styles.sectionTitle}>Your Events</Text>
                            <FlatList
                                data={events}
                                renderItem={renderEventCard}
                                keyExtractor={(item) => item.$id}
                                scrollEnabled={false}
                                showsVerticalScrollIndicator={false}
                            />
                        </View>
                    </>
                ) : (
                    renderEmptyState()
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        backgroundColor: '#fff',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    createEventButton: {
        backgroundColor: '#007bff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    createEventButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    statsContainer: {
        backgroundColor: '#fff',
        margin: 15,
        padding: 20,
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
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 15,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    statCard: {
        width: '48%',
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    statCardValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#007bff',
        marginBottom: 4,
    },
    statCardLabel: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    eventsSection: {
        margin: 15,
    },
    eventCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    eventHeader: {
        marginBottom: 15,
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    eventDate: {
        fontSize: 14,
        color: '#666',
    },
    eventStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
    },
    eventActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionButton: {
        flex: 1,
        backgroundColor: '#007bff',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    secondaryButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#007bff',
    },
    secondaryButtonText: {
        color: '#007bff',
    },
    emptyState: {
        alignItems: 'center',
        paddingHorizontal: 30,
        paddingTop: 60,
    },
    emptyStateTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    createButton: {
        backgroundColor: '#007bff',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 8,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default BusinessDashboard;
