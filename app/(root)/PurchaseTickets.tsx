import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import stripeService from '../../lib/api/stripe';
import ticketService from '../../lib/api/ticket';
import { BusinessEvent, TicketPurchase } from '../../lib/types/BusinessEvent';

const PurchaseTickets: React.FC = () => {
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const [event, setEvent] = useState<BusinessEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        if (eventId) {
            loadEvent();
        }
    }, [eventId]);

    const loadEvent = async () => {
        try {
            const eventData = await ticketService.getBusinessEvent(eventId!);
            setEvent(eventData);
        } catch (error) {
            console.error('Error loading event:', error);
            Alert.alert('Error', 'Failed to load event details');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleQuantityChange = (delta: number) => {
        const newQuantity = quantity + delta;
        if (newQuantity >= 1) {
            if (event?.maxTickets) {
                const available = event.maxTickets - event.ticketsSold;
                if (newQuantity <= available) {
                    setQuantity(newQuantity);
                }
            } else {
                setQuantity(newQuantity);
            }
        }
    };

    const handlePurchase = async () => {
        if (!event) return;

        setPurchasing(true);
        try {
            const purchase: TicketPurchase = {
                eventId: event.$id,
                userId: 'current_user_id', // Get from auth context
                quantity,
                totalAmount: event.ticketPrice * quantity,
                currency: event.currency,
                buyerEmail: 'user@example.com', // Get from auth context
                buyerName: 'Current User', // Get from auth context
            };

            const result = await ticketService.purchaseTickets(purchase);

            // In a real app, you'd integrate with Stripe's payment sheet here
            // For now, we'll simulate a successful payment
            Alert.alert(
                'Payment Required',
                `Please complete payment of ${formatPrice(event.ticketPrice * quantity, event.currency)} for ${quantity} ticket(s).`,
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                    },
                    {
                        text: 'Pay Now',
                        onPress: () => simulatePayment(result.paymentIntent.id),
                    },
                ]
            );
        } catch (error) {
            console.error('Error purchasing tickets:', error);
            Alert.alert('Error', 'Failed to initiate purchase. Please try again.');
        } finally {
            setPurchasing(false);
        }
    };

    const simulatePayment = async (paymentIntentId: string) => {
        try {
            // In a real implementation, this would be handled by Stripe's payment confirmation
            const tickets = await ticketService.createTickets(
                paymentIntentId,
                event!.$id,
                'current_user_id',
                quantity
            );

            Alert.alert(
                'Purchase Successful!',
                `You've successfully purchased ${quantity} ticket(s). Your tickets are now available in your profile.`,
                [
                    {
                        text: 'View Tickets',
                        onPress: () => router.push('/(root)/(tabs)/Profile'),
                    },
                    {
                        text: 'OK',
                        onPress: () => router.back(),
                    },
                ]
            );
        } catch (error) {
            console.error('Error completing purchase:', error);
            Alert.alert('Error', 'Payment succeeded but ticket creation failed. Please contact support.');
        }
    };

    const formatPrice = (priceInCents: number, currency: string): string => {
        return `${currency} ${(priceInCents / 100).toFixed(2)}`;
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleString();
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007bff" />
                <Text style={styles.loadingText}>Loading event details...</Text>
            </View>
        );
    }

    if (!event) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Event not found</Text>
            </View>
        );
    }

    const pricing = stripeService.calculatePricing(event.ticketPrice, quantity);
    const availableTickets = event.maxTickets ? event.maxTickets - event.ticketsSold : null;
    const isAvailable = availableTickets === null || availableTickets > 0;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.organizerName}>by {event.organizerName}</Text>
            </View>

            <View style={styles.eventDetails}>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date & Time:</Text>
                    <Text style={styles.detailValue}>
                        {formatDate(event.startTime)} - {formatDate(event.endTime)}
                    </Text>
                </View>

                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Location:</Text>
                    <Text style={styles.detailValue}>{event.location}</Text>
                </View>

                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category:</Text>
                    <Text style={styles.detailValue}>{event.businessCategory}</Text>
                </View>

                {event.ticketDescription && (
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>What's Included:</Text>
                        <Text style={styles.detailValue}>{event.ticketDescription}</Text>
                    </View>
                )}

                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Refund Policy:</Text>
                    <Text style={styles.detailValue}>
                        {event.refundPolicy === 'none' && 'No refunds'}
                        {event.refundPolicy === 'partial' && 'Partial refunds available'}
                        {event.refundPolicy === 'full' && 'Full refunds available'}
                    </Text>
                </View>
            </View>

            {event.description && (
                <View style={styles.descriptionSection}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.description}>{event.description}</Text>
                </View>
            )}

            <View style={styles.ticketSection}>
                <Text style={styles.sectionTitle}>Tickets</Text>

                <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Price per ticket:</Text>
                    <Text style={styles.priceValue}>
                        {formatPrice(event.ticketPrice, event.currency)}
                    </Text>
                </View>

                {availableTickets !== null && (
                    <View style={styles.availabilityRow}>
                        <Text style={styles.availabilityLabel}>Available:</Text>
                        <Text style={[
                            styles.availabilityValue,
                            availableTickets === 0 && styles.soldOut
                        ]}>
                            {availableTickets} tickets remaining
                        </Text>
                    </View>
                )}

                {isAvailable && (
                    <>
                        <View style={styles.quantitySection}>
                            <Text style={styles.quantityLabel}>Quantity:</Text>
                            <View style={styles.quantityControls}>
                                <TouchableOpacity
                                    style={[styles.quantityButton, quantity === 1 && styles.quantityButtonDisabled]}
                                    onPress={() => handleQuantityChange(-1)}
                                    disabled={quantity === 1}
                                >
                                    <Text style={styles.quantityButtonText}>-</Text>
                                </TouchableOpacity>
                                <Text style={styles.quantityValue}>{quantity}</Text>
                                <TouchableOpacity
                                    style={[
                                        styles.quantityButton,
                                        availableTickets !== null && quantity >= availableTickets && styles.quantityButtonDisabled
                                    ]}
                                    onPress={() => handleQuantityChange(1)}
                                    disabled={availableTickets !== null && quantity >= availableTickets}
                                >
                                    <Text style={styles.quantityButtonText}>+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.pricingBreakdown}>
                            <Text style={styles.breakdownTitle}>Pricing Breakdown</Text>
                            <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>
                                    {quantity} × {formatPrice(event.ticketPrice, event.currency)}
                                </Text>
                                <Text style={styles.breakdownValue}>
                                    {formatPrice(pricing.subtotal, event.currency)}
                                </Text>
                            </View>
                            <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownTotal}>Total:</Text>
                                <Text style={styles.breakdownTotalValue}>
                                    {formatPrice(pricing.totalAmount, event.currency)}
                                </Text>
                            </View>
                        </View>
                    </>
                )}
            </View>

            <View style={styles.footer}>
                {!isAvailable ? (
                    <View style={styles.soldOutContainer}>
                        <Text style={styles.soldOutText}>Sold Out</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.purchaseButton, purchasing && styles.purchaseButtonDisabled]}
                        onPress={handlePurchase}
                        disabled={purchasing}
                    >
                        {purchasing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.purchaseButtonText}>
                                Purchase {quantity} Ticket{quantity > 1 ? 's' : ''} - {formatPrice(pricing.totalAmount, event.currency)}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 18,
        color: '#dc3545',
    },
    header: {
        padding: 20,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    eventTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    organizerName: {
        fontSize: 16,
        color: '#666',
    },
    eventDetails: {
        padding: 20,
    },
    detailRow: {
        marginBottom: 12,
    },
    detailLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 14,
        color: '#666',
    },
    descriptionSection: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
    },
    description: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    ticketSection: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    priceLabel: {
        fontSize: 16,
        color: '#333',
    },
    priceValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#007bff',
    },
    availabilityRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    availabilityLabel: {
        fontSize: 14,
        color: '#666',
    },
    availabilityValue: {
        fontSize: 14,
        color: '#28a745',
    },
    soldOut: {
        color: '#dc3545',
    },
    quantitySection: {
        marginTop: 15,
        marginBottom: 20,
    },
    quantityLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 10,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityButton: {
        width: 40,
        height: 40,
        backgroundColor: '#007bff',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 15,
    },
    quantityButtonDisabled: {
        backgroundColor: '#ccc',
    },
    quantityButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    quantityValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        minWidth: 30,
        textAlign: 'center',
    },
    pricingBreakdown: {
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 8,
        marginTop: 15,
    },
    breakdownTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    breakdownLabel: {
        fontSize: 14,
        color: '#666',
    },
    breakdownValue: {
        fontSize: 14,
        color: '#666',
    },
    breakdownTotal: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    breakdownTotalValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007bff',
    },
    footer: {
        padding: 20,
    },
    soldOutContainer: {
        backgroundColor: '#f8f9fa',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    soldOutText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#dc3545',
    },
    purchaseButton: {
        backgroundColor: '#007bff',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    purchaseButtonDisabled: {
        backgroundColor: '#ccc',
    },
    purchaseButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default PurchaseTickets;
