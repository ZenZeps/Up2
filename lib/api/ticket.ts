import { databases, ID, Query } from '../appwrite/appwrite';
import { BusinessEvent, Ticket, TicketPurchase, TicketSales } from '../types/BusinessEvent';
import stripeService from './stripe';

const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!;
const BUSINESS_EVENTS_COLLECTION_ID = 'business_events';
const TICKETS_COLLECTION_ID = 'tickets';
const TICKET_SALES_COLLECTION_ID = 'ticket_sales';

class TicketService {
    // Create a business event
    async createBusinessEvent(eventData: Omit<BusinessEvent, '$id' | '$createdAt' | '$updatedAt' | 'ticketsSold'>): Promise<BusinessEvent> {
        try {
            const { createDocumentSafe } = await import('@/lib/appwrite/safeDb');
            const newEvent = await createDocumentSafe(
                DATABASE_ID,
                BUSINESS_EVENTS_COLLECTION_ID,
                ID.unique(),
                {
                    ...eventData,
                    ticketsSold: 0,
                    isBusinessEvent: true,
                }
            );

            return newEvent as unknown as BusinessEvent;
        } catch (error) {
            console.error('Error creating business event:', error);
            throw error;
        }
    }

    // Get business event by ID
    async getBusinessEvent(eventId: string): Promise<BusinessEvent> {
        try {
            const event = await databases.getDocument(
                DATABASE_ID,
                BUSINESS_EVENTS_COLLECTION_ID,
                eventId
            );

            return event as unknown as BusinessEvent;
        } catch (error) {
            console.error('Error getting business event:', error);
            throw error;
        }
    }

    // Get all business events
    async getBusinessEvents(limit: number = 20, offset: number = 0): Promise<BusinessEvent[]> {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                BUSINESS_EVENTS_COLLECTION_ID,
                [
                    Query.limit(limit),
                    Query.offset(offset),
                    Query.orderDesc('$createdAt'),
                ]
            );

            return response.documents as unknown as BusinessEvent[];
        } catch (error) {
            console.error('Error getting business events:', error);
            throw error;
        }
    }

    // Purchase tickets
    async purchaseTickets(purchase: TicketPurchase): Promise<{ paymentIntent: any, tickets?: Ticket[] }> {
        try {
            // Get event details
            const event = await this.getBusinessEvent(purchase.eventId);

            // Check ticket availability
            if (event.maxTickets && (event.ticketsSold + purchase.quantity) > event.maxTickets) {
                throw new Error('Not enough tickets available');
            }

            // Calculate total price
            const pricing = stripeService.calculatePricing(event.ticketPrice, purchase.quantity);

            // Create payment intent
            const paymentIntent = await stripeService.createPaymentIntent({
                ...purchase,
                totalAmount: pricing.totalAmount,
            });

            return { paymentIntent };
        } catch (error) {
            console.error('Error purchasing tickets:', error);
            throw error;
        }
    }

    // Create tickets after successful payment
    async createTickets(paymentIntentId: string, eventId: string, userId: string, quantity: number): Promise<Ticket[]> {
        try {
            const event = await this.getBusinessEvent(eventId);
            const tickets: Ticket[] = [];

            for (let i = 0; i < quantity; i++) {
                const ticketNumber = this.generateTicketNumber();
                const qrCode = this.generateQRCode(eventId, ticketNumber);

                const { createDocumentSafe } = await import('@/lib/appwrite/safeDb');
                const ticket = await createDocumentSafe(
                    DATABASE_ID,
                    TICKETS_COLLECTION_ID,
                    ID.unique(),
                    {
                        ticketNumber,
                        eventId,
                        userId,
                        purchaseDate: new Date().toISOString(),
                        price: event.ticketPrice,
                        currency: event.currency,
                        status: 'active',
                        paymentIntentId,
                        qrCode,
                        isTransferable: true,
                    }
                );

                tickets.push(ticket as unknown as Ticket);
            }

            // Update event ticket count
            await databases.updateDocument(
                DATABASE_ID,
                BUSINESS_EVENTS_COLLECTION_ID,
                eventId,
                {
                    ticketsSold: event.ticketsSold + quantity,
                }
            );

            // Update sales tracking
            await this.updateSalesTracking(eventId, quantity, event.ticketPrice * quantity);

            return tickets;
        } catch (error) {
            console.error('Error creating tickets:', error);
            throw error;
        }
    }

    // Get user's tickets
    async getUserTickets(userId: string): Promise<Ticket[]> {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                TICKETS_COLLECTION_ID,
                [
                    Query.equal('userId', userId),
                    Query.orderDesc('$createdAt'),
                ]
            );

            return response.documents as unknown as Ticket[];
        } catch (error) {
            console.error('Error getting user tickets:', error);
            throw error;
        }
    }

    // Get tickets for an event
    async getEventTickets(eventId: string): Promise<Ticket[]> {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                TICKETS_COLLECTION_ID,
                [
                    Query.equal('eventId', eventId),
                    Query.orderDesc('$createdAt'),
                ]
            );

            return response.documents as unknown as Ticket[];
        } catch (error) {
            console.error('Error getting event tickets:', error);
            throw error;
        }
    }

    // Validate/scan a ticket
    async validateTicket(ticketId: string, scannerId: string): Promise<boolean> {
        try {
            const ticket = await databases.getDocument(
                DATABASE_ID,
                TICKETS_COLLECTION_ID,
                ticketId
            );

            if (ticket.status !== 'active') {
                throw new Error('Ticket is not valid for entry');
            }

            // Mark ticket as used
            await databases.updateDocument(
                DATABASE_ID,
                TICKETS_COLLECTION_ID,
                ticketId,
                {
                    status: 'used',
                    scannedAt: new Date().toISOString(),
                    scannedBy: scannerId,
                }
            );

            return true;
        } catch (error) {
            console.error('Error validating ticket:', error);
            throw error;
        }
    }

    // Refund a ticket
    async refundTicket(ticketId: string, reason?: string): Promise<boolean> {
        try {
            const ticket = await databases.getDocument(
                DATABASE_ID,
                TICKETS_COLLECTION_ID,
                ticketId
            ) as unknown as Ticket;

            if (ticket.status !== 'active') {
                throw new Error('Ticket cannot be refunded');
            }

            // Process refund through Stripe
            const refundSuccess = await stripeService.refundTicket(ticketId, reason);

            if (refundSuccess) {
                // Update ticket status
                await databases.updateDocument(
                    DATABASE_ID,
                    TICKETS_COLLECTION_ID,
                    ticketId,
                    {
                        status: 'refunded',
                    }
                );

                // Update event ticket count
                const event = await this.getBusinessEvent(ticket.eventId);
                await databases.updateDocument(
                    DATABASE_ID,
                    BUSINESS_EVENTS_COLLECTION_ID,
                    ticket.eventId,
                    {
                        ticketsSold: Math.max(0, event.ticketsSold - 1),
                    }
                );

                return true;
            }

            return false;
        } catch (error) {
            console.error('Error refunding ticket:', error);
            throw error;
        }
    }

    // Get sales analytics for an event
    async getEventSales(eventId: string): Promise<TicketSales> {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                TICKET_SALES_COLLECTION_ID,
                [Query.equal('eventId', eventId)]
            );

            if (response.documents.length > 0) {
                return response.documents[0] as unknown as TicketSales;
            }

            // Return empty sales data if none exists
            return {
                eventId,
                totalTicketsSold: 0,
                totalRevenue: 0,
                platformEarnings: 0,
                organizerEarnings: 0,
                stripeEarnings: 0,
                refundedAmount: 0,
            };
        } catch (error) {
            console.error('Error getting event sales:', error);
            throw error;
        }
    }

    // Private helper methods
    private generateTicketNumber(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `UP2-${timestamp}-${random}`.toUpperCase();
    }

    private generateQRCode(eventId: string, ticketNumber: string): string {
        // In a real implementation, you'd generate an actual QR code
        // For now, return a JSON string that can be used to validate
        return JSON.stringify({
            eventId,
            ticketNumber,
            timestamp: Date.now(),
        });
    }

    private async updateSalesTracking(eventId: string, quantity: number, revenue: number): Promise<void> {
        try {
            const pricing = stripeService.calculatePricing(revenue / quantity, quantity);

            // Try to get existing sales record
            const existingResponse = await databases.listDocuments(
                DATABASE_ID,
                TICKET_SALES_COLLECTION_ID,
                [Query.equal('eventId', eventId)]
            );

            if (existingResponse.documents.length > 0) {
                // Update existing record
                const existing = existingResponse.documents[0] as unknown as TicketSales;
                await databases.updateDocument(
                    DATABASE_ID,
                    TICKET_SALES_COLLECTION_ID,
                    existing.$id!,
                    {
                        totalTicketsSold: existing.totalTicketsSold + quantity,
                        totalRevenue: existing.totalRevenue + revenue,
                        platformEarnings: existing.platformEarnings + pricing.platformFee,
                        organizerEarnings: existing.organizerEarnings + pricing.organizerEarnings,
                        stripeEarnings: existing.stripeEarnings + pricing.stripeFee,
                        lastSaleDate: new Date().toISOString(),
                    }
                );
            } else {
                // Create new record
                const { createDocumentSafe } = await import('@/lib/appwrite/safeDb');
                await createDocumentSafe(
                    DATABASE_ID,
                    TICKET_SALES_COLLECTION_ID,
                    ID.unique(),
                    {
                        eventId,
                        totalTicketsSold: quantity,
                        totalRevenue: revenue,
                        platformEarnings: pricing.platformFee,
                        organizerEarnings: pricing.organizerEarnings,
                        stripeEarnings: pricing.stripeFee,
                        refundedAmount: 0,
                        lastSaleDate: new Date().toISOString(),
                    }
                );
            }
        } catch (error) {
            console.error('Error updating sales tracking:', error);
            // Don't throw here as it's not critical for the main flow
        }
    }
}

export default new TicketService();
