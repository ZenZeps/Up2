import { PaymentIntent, Ticket, TicketPurchase } from '../types/BusinessEvent';

class StripeService {
    private stripePublishableKey: string;
    private stripeSecretKey: string;
    private baseUrl: string;

    constructor() {
        // These should be environment variables
        this.stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
        this.stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
        this.baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    }

    // Create payment intent for ticket purchase
    async createPaymentIntent(purchase: TicketPurchase): Promise<PaymentIntent> {
        try {
            const response = await fetch(`${this.baseUrl}/api/payments/create-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: purchase.totalAmount,
                    currency: purchase.currency,
                    eventId: purchase.eventId,
                    userId: purchase.userId,
                    quantity: purchase.quantity,
                    metadata: {
                        eventId: purchase.eventId,
                        userId: purchase.userId,
                        quantity: purchase.quantity,
                        buyerEmail: purchase.buyerEmail,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`Payment intent creation failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating payment intent:', error);
            throw error;
        }
    }

    // Confirm payment and create tickets
    async confirmPayment(paymentIntentId: string, eventId: string, userId: string): Promise<Ticket[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/payments/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    paymentIntentId,
                    eventId,
                    userId,
                }),
            });

            if (!response.ok) {
                throw new Error(`Payment confirmation failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error confirming payment:', error);
            throw error;
        }
    }

    // Calculate pricing breakdown
    calculatePricing(basePrice: number, quantity: number = 1) {
        const PLATFORM_FEE_PERCENTAGE = 0.05; // 5% platform fee
        const STRIPE_FEE_PERCENTAGE = 0.029; // 2.9% + $0.30
        const STRIPE_FIXED_FEE = 30; // 30 cents in cents

        const subtotal = basePrice * quantity;
        const platformFee = Math.round(subtotal * PLATFORM_FEE_PERCENTAGE);
        const stripeFee = Math.round(subtotal * STRIPE_FEE_PERCENTAGE) + (STRIPE_FIXED_FEE * quantity);
        const totalFees = platformFee + stripeFee;
        const organizerEarnings = subtotal - totalFees;
        const totalAmount = subtotal; // Customer pays base price, fees come out of organizer earnings

        return {
            basePrice,
            quantity,
            subtotal,
            platformFee,
            stripeFee,
            totalFees,
            organizerEarnings,
            totalAmount,
        };
    }

    // Refund a ticket
    async refundTicket(ticketId: string, reason?: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/payments/refund`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ticketId,
                    reason,
                }),
            });

            if (!response.ok) {
                throw new Error(`Refund failed: ${response.statusText}`);
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Error processing refund:', error);
            throw error;
        }
    }

    // Get payment status
    async getPaymentStatus(paymentIntentId: string): Promise<string> {
        try {
            const response = await fetch(`${this.baseUrl}/api/payments/status/${paymentIntentId}`);

            if (!response.ok) {
                throw new Error(`Failed to get payment status: ${response.statusText}`);
            }

            const result = await response.json();
            return result.status;
        } catch (error) {
            console.error('Error getting payment status:', error);
            throw error;
        }
    }

    // Transfer earnings to organizer (for future implementation)
    async transferToOrganizer(organizerId: string, amount: number, currency: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/payments/transfer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    organizerId,
                    amount,
                    currency,
                }),
            });

            if (!response.ok) {
                throw new Error(`Transfer failed: ${response.statusText}`);
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Error transferring to organizer:', error);
            throw error;
        }
    }
}

export default new StripeService();
