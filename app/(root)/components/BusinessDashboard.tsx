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
                        onPress={() => router.push(`/(root)/EventAnalytics?eventId=${event.$id}` as any)}
                    >
                        <Text style={styles.actionButtonText}>View Analytics</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.secondaryButton]}
                        onPress={() => router.push(`/(root)/ScanTickets?eventId=${event.$id}` as any)}
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
        backgroundColor: '#f8f9fb',
    },
    header: {
        backgroundColor: '#ffffff',
        padding: 24,
        paddingTop: 40,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1a1a1a',
        letterSpacing: -0.5,
    },
    createEventButton: {
        backgroundColor: '#1a1a1a',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        shadowColor: '#1a1a1a',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    createEventButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    content: {
        flex: 1,
    },
    statsContainer: {
        backgroundColor: '#ffffff',
        margin: 20,
        padding: 24,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 20,
        letterSpacing: -0.3,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    statCard: {
        width: '47%',
        backgroundColor: '#f8fafc',
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statCardValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 6,
        letterSpacing: -0.3,
    },
    statCardLabel: {
        fontSize: 12,
        color: '#6b7280',
        textAlign: 'center',
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    eventsSection: {
        margin: 20,
        marginTop: 0,
    },
    eventCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 3,
    },
    eventHeader: {
        marginBottom: 16,
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 4,
        letterSpacing: -0.3,
    },
    eventDate: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    eventStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingVertical: 8,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 4,
        letterSpacing: -0.2,
    },
    statLabel: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: '500',
        textAlign: 'center',
    },
    eventActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#1a1a1a',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    actionButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    secondaryButton: {
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#1a1a1a',
        shadowOpacity: 0,
        elevation: 0,
    },
    secondaryButtonText: {
        color: '#1a1a1a',
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingTop: 80,
    },
    emptyStateTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
        fontWeight: '400',
    },
    createButton: {
        backgroundColor: '#1a1a1a',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 16,
        shadowColor: '#1a1a1a',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    createButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
});

export default BusinessDashboard;
