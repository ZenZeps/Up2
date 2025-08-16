import { Event } from './Events';

export interface BusinessEvent extends Event {
    // Business-specific fields
    isBusinessEvent: true;
    ticketPrice: number; // Price in cents (Stripe format)
    currency: string; // ISO currency code (USD, EUR, etc.)
    maxTickets?: number; // Maximum number of tickets available
    ticketsSold: number; // Number of tickets sold
    earlyBirdPrice?: number; // Optional early bird pricing
    earlyBirdEndDate?: string; // When early bird pricing ends
    organizerId: string; // Business/organization ID
    organizerName: string; // Business/organization name
    organizerVerified: boolean; // Whether the organizer is verified
    ticketDescription?: string; // What the ticket includes
    refundPolicy: 'none' | 'partial' | 'full'; // Refund policy
    paymentMethods: string[]; // Accepted payment methods
    businessCategory: string; // Type of business (hostel, restaurant, etc.)
    contactEmail: string; // Business contact email
    contactPhone?: string; // Business contact phone
    requiresApproval: boolean; // Whether ticket purchases need approval

    // Revenue sharing
    platformFee: number; // Platform fee percentage (your revenue)
    stripeFee: number; // Stripe processing fee percentage
    organizerEarnings: number; // What organizer gets per ticket
}

export interface Ticket {
    $id: string;
    ticketNumber: string; // Unique ticket identifier
    eventId: string; // Reference to the business event
    userId: string; // Ticket holder's user ID
    purchaseDate: string; // ISO date when purchased
    price: number; // Price paid in cents
    currency: string;
    status: 'active' | 'used' | 'refunded' | 'cancelled';
    paymentIntentId: string; // Stripe payment intent ID
    qrCode: string; // QR code for ticket validation
    downloadUrl?: string; // URL to download PDF ticket
    seatNumber?: string; // Optional seat assignment
    specialRequests?: string; // Any special requests from buyer

    // Validation
    scannedAt?: string; // When ticket was scanned/validated
    scannedBy?: string; // Who validated the ticket
    isTransferable: boolean; // Whether ticket can be transferred

    // Metadata
    $createdAt: string;
    $updatedAt: string;
}

export interface TicketPurchase {
    eventId: string;
    userId: string;
    quantity: number;
    totalAmount: number; // In cents
    currency: string;
    paymentMethodId?: string; // Stripe payment method ID
    specialRequests?: string;
    buyerEmail: string;
    buyerName: string;
}

export interface PaymentIntent {
    id: string;
    amount: number;
    currency: string;
    status: string;
    clientSecret: string;
}

export interface TicketSales {
    $id?: string; // Appwrite document ID
    eventId: string;
    totalTicketsSold: number;
    totalRevenue: number; // In cents
    platformEarnings: number; // Your cut
    organizerEarnings: number; // Organizer's cut
    stripeEarnings: number; // Stripe's cut
    refundedAmount: number;
    lastSaleDate?: string;
}
