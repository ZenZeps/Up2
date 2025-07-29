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
        backgroundColor: '#f8f9fa',
    },
    header: {
        backgroundColor: '#fff',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
    },
    listContainer: {
        padding: 15,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    ticketCard: {
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
    ticketHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    eventInfo: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    organizerName: {
        fontSize: 14,
        color: '#666',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    ticketDetails: {
        marginBottom: 15,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    detailLabel: {
        fontSize: 14,
        color: '#666',
        flex: 1,
    },
    detailValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
        flex: 2,
        textAlign: 'right',
    },
    qrSection: {
        alignItems: 'center',
        marginBottom: 20,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
    },
    qrLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 10,
    },
    qrPlaceholder: {
        width: 120,
        height: 120,
        backgroundColor: '#f8f9fa',
        borderWidth: 2,
        borderColor: '#dee2e6',
        borderStyle: 'dashed',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qrText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#666',
    },
    qrSubtext: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    ticketActions: {
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
    refundButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#dc3545',
    },
    refundButtonText: {
        color: '#dc3545',
    },
    emptyState: {
        alignItems: 'center',
        paddingHorizontal: 30,
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
    browseButton: {
        backgroundColor: '#007bff',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 8,
    },
    browseButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default MyTickets;
