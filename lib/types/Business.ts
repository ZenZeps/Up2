
export interface BusinessProfile {
    $id: string;
    userId: string; // Links to the user account
    businessName: string;
    businessType: 'hostel' | 'tour_company' | 'restaurant' | 'bar' | 'activity_provider' | 'other';
    description?: string;
    website?: string;
    phone?: string;
    address?: string;
    locationLat?: number;
    locationLng?: number;
    logoUrl?: string;
    coverImageUrl?: string;
    // Stripe integration
    stripeAccountId?: string;
    stripeOnboardingComplete: boolean;
    // QR Code for hostel sign-ups
    qrCodeData?: string;
    // Business verification
    isVerified: boolean;
    verificationDocuments?: string[]; // File IDs
    // Business hours, amenities, etc.
    amenities?: string[];
    socialMedia?: {
        instagram?: string;
        facebook?: string;
        tiktok?: string;
    };
    $createdAt: string;
    $updatedAt: string;
}

export interface TicketType {
    $id: string;
    eventId: string;
    businessId: string;
    name: string; // e.g., "Early Bird", "VIP", "Standard"
    description?: string;
    price: number; // in cents (Stripe format)
    currency: string; // e.g., "USD", "EUR"
    totalQuantity: number;
    soldQuantity: number;
    availableQuantity: number;
    saleStartDate?: string;
    saleEndDate?: string;
    isActive: boolean;
    perks?: string[]; // What's included with this ticket
    $createdAt: string;
    $updatedAt: string;
}

export interface TicketPurchase {
    $id: string;
    userId: string;
    eventId: string;
    businessId: string;
    ticketTypeId: string;
    quantity: number;
    totalAmount: number; // in cents
    currency: string;
    // Stripe payment info
    stripePaymentIntentId: string;
    paymentStatus: 'pending' | 'succeeded' | 'failed' | 'refunded';
    // Ticket details
    ticketCodes: string[]; // QR codes or ticket numbers
    purchaseDate: string;
    eventDate: string;
    // Refund info
    refundAmount?: number;
    refundDate?: string;
    refundReason?: string;
    $createdAt: string;
    $updatedAt: string;
}

export interface QRCodeScan {
    $id: string;
    scannedBy: string; // User ID who scanned
    businessId: string; // Business that owns the QR code
    scanDate: string;
    scanLocation?: {
        lat: number;
        lng: number;
    };
    // Conversion tracking
    userSignedUp: boolean;
    userDownloadedApp: boolean;
    $createdAt: string;
}