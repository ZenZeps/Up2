import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ticketService from '../../../lib/api/ticket';
import { Ticket } from '../../../lib/types/BusinessEvent';

interface TicketWithEvent extends Ticket {
    event?: {
        title: string;
        startTime: string;
        location: string;
        organizerName: string;
    };
}

const MyTickets: React.FC = () => {
    const [tickets, setTickets] = useState<TicketWithEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadTickets();
    }, []);

    const loadTickets = async () => {
        try {
            const userTickets = await ticketService.getUserTickets('current_user_id');

            // In a real implementation, you'd also fetch event details for each ticket
            const ticketsWithEvents = userTickets.map(ticket => ({
                ...ticket,
                event: {
                    title: 'Sample Event', // Fetch from events collection
                    startTime: '2024-02-01T18:00:00Z',
                    location: 'Sample Location',
                    organizerName: 'Sample Organizer',
                },
            }));

            setTickets(ticketsWithEvents);
        } catch (error) {
            console.error('Error loading tickets:', error);
            Alert.alert('Error', 'Failed to load your tickets');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadTickets();
        setRefreshing(false);
    };

    const handleDownloadTicket = (ticket: TicketWithEvent) => {
        // In a real implementation, this would generate and download a PDF ticket
        Alert.alert(
            'Download Ticket',
            `Ticket ${ticket.ticketNumber} would be downloaded as PDF.`,
            [{ text: 'OK' }]
        );
    };

    const handleRefundTicket = (ticket: TicketWithEvent) => {
        Alert.alert(
            'Request Refund',
            `Are you sure you want to request a refund for ticket ${ticket.ticketNumber}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Request Refund',
                    style: 'destructive',
                    onPress: () => processRefund(ticket),
                },
            ]
        );
    };

    const processRefund = async (ticket: TicketWithEvent) => {
        try {
            const success = await ticketService.refundTicket(ticket.$id, 'User requested refund');

            if (success) {
                Alert.alert('Refund Requested', 'Your refund request has been submitted successfully.');
                await loadTickets(); // Refresh the list
            } else {
                Alert.alert('Error', 'Failed to process refund request.');
            }
        } catch (error) {
            console.error('Error processing refund:', error);
            Alert.alert('Error', 'Failed to process refund request.');
        }
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatPrice = (priceInCents: number, currency: string): string => {
        return `${currency} ${(priceInCents / 100).toFixed(2)}`;
    };

    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'active':
                return '#28a745';
            case 'used':
                return '#6c757d';
            case 'refunded':
                return '#dc3545';
            case 'cancelled':
                return '#dc3545';
            default:
                return '#666';
        }
    };

    const getStatusText = (status: string): string => {
        switch (status) {
            case 'active':
                return 'Valid';
            case 'used':
                return 'Used';
            case 'refunded':
                return 'Refunded';
            case 'cancelled':
                return 'Cancelled';
            default:
                return status;
        }
    };

    const renderTicketItem = ({ item: ticket }: { item: TicketWithEvent }) => (
        <View style={styles.ticketCard}>
            <View style={styles.ticketHeader}>
                <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{ticket.event?.title}</Text>
                    <Text style={styles.organizerName}>by {ticket.event?.organizerName}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(ticket.status)}</Text>
                </View>
            </View>

            <View style={styles.ticketDetails}>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date & Time:</Text>
                    <Text style={styles.detailValue}>
                        {ticket.event?.startTime ? formatDate(ticket.event.startTime) : 'TBA'}
                    </Text>
                </View>

                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Location:</Text>
                    <Text style={styles.detailValue}>{ticket.event?.location}</Text>
                </View>

                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Ticket Number:</Text>
                    <Text style={styles.detailValue}>{ticket.ticketNumber}</Text>
                </View>

                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Price:</Text>
                    <Text style={styles.detailValue}>
                        {formatPrice(ticket.price, ticket.currency)}
                    </Text>
                </View>

                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Purchased:</Text>
                    <Text style={styles.detailValue}>
                        {formatDate(ticket.purchaseDate)}
                    </Text>
                </View>
            </View>

            {ticket.status === 'active' && (
                <View style={styles.qrSection}>
                    <Text style={styles.qrLabel}>QR Code for Entry:</Text>
                    <View style={styles.qrPlaceholder}>
                        <Text style={styles.qrText}>QR CODE</Text>
                        <Text style={styles.qrSubtext}>Show this at the event</Text>
                    </View>
                </View>
            )}

            <View style={styles.ticketActions}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDownloadTicket(ticket)}
                >
                    <Text style={styles.actionButtonText}>Download PDF</Text>
                </TouchableOpacity>

                {ticket.status === 'active' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.refundButton]}
                        onPress={() => handleRefundTicket(ticket)}
                    >
                        <Text style={[styles.actionButtonText, styles.refundButtonText]}>
                            Request Refund
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No Tickets Yet</Text>
            <Text style={styles.emptyStateText}>
                You haven't purchased any event tickets yet.
            </Text>
            <TouchableOpacity
                style={styles.browseButton}
                onPress={() => router.push('/(root)/(tabs)/Explore')}
            >
                <Text style={styles.browseButtonText}>Browse Events</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>My Tickets</Text>
                <Text style={styles.subtitle}>
                    {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
                </Text>
            </View>

            <FlatList
                data={tickets}
                renderItem={renderTicketItem}
                keyExtractor={(item) => item.$id}
                contentContainerStyle={[
                    styles.listContainer,
                    tickets.length === 0 && styles.emptyContainer,
                ]}
                ListEmptyComponent={renderEmptyState}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
                showsVerticalScrollIndicator={false}
            />
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
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        fontWeight: '400',
    },
    listContainer: {
        padding: 20,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    ticketCard: {
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
    ticketHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    eventInfo: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 4,
        letterSpacing: -0.3,
    },
    organizerName: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    ticketDetails: {
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    detailLabel: {
        fontSize: 14,
        color: '#6b7280',
        flex: 1,
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 14,
        color: '#1a1a1a',
        fontWeight: '600',
        flex: 2,
        textAlign: 'right',
    },
    qrSection: {
        alignItems: 'center',
        marginBottom: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    qrLabel: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 12,
        fontWeight: '500',
    },
    qrPlaceholder: {
        width: 120,
        height: 120,
        backgroundColor: '#f9fafb',
        borderWidth: 2,
        borderColor: '#d1d5db',
        borderStyle: 'dashed',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qrText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#6b7280',
    },
    qrSubtext: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 4,
        textAlign: 'center',
    },
    ticketActions: {
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
    refundButton: {
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#ef4444',
        shadowOpacity: 0,
        elevation: 0,
    },
    refundButtonText: {
        color: '#ef4444',
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        paddingHorizontal: 40,
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
    browseButton: {
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
    browseButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
});

export default MyTickets;
