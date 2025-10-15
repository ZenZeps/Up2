import { config, databases, ID, Permission, Query, Role, storage } from '@/lib/appwrite/appwrite';
import { BusinessProfile, QRCodeScan, TicketPurchase, TicketType } from '@/lib/types/Business';
import { authDebug } from '../debug/authDebug';

/**
 * Create a business profile for a user
 */
export async function createBusinessProfile(
    userId: string,
    businessData: Omit<BusinessProfile, '$id' | 'userId' | '$createdAt' | '$updatedAt' | 'isVerified' | 'stripeOnboardingComplete'>
): Promise<BusinessProfile> {
    try {
        authDebug.info('Creating business profile for user:', userId);

        // Generate QR code data for the business
        const qrCodeData = `up2://business/${userId}?ref=qr&type=hostel_signup`;

        const businessProfile = await databases.createDocument(
            config.databaseID!,
            config.businessProfilesCollectionID!,
            ID.unique(),
            {
                userId,
                ...businessData,
                qrCodeData,
                isVerified: false,
                stripeOnboardingComplete: false,
            },
            [
                Permission.read(Role.user(userId)),
                Permission.update(Role.user(userId)),
                Permission.delete(Role.user(userId)),
                // Allow public read for business discovery
                Permission.read(Role.any()),
            ]
        );

        authDebug.info('Business profile created successfully:', businessProfile.$id);
        return businessProfile as unknown as BusinessProfile;
    } catch (error) {
        authDebug.error('Failed to create business profile:', error);
        throw new Error('Failed to create business profile');
    }
}

/**
 * Get business profile by user ID
 */
export async function getBusinessProfile(userId: string): Promise<BusinessProfile | null> {
    try {
        const profiles = await databases.listDocuments(
            config.databaseID!,
            config.businessProfilesCollectionID!,
            [Query.equal('userId', userId), Query.limit(1)]
        );

        if (profiles.documents.length === 0) {
            return null;
        }

        return profiles.documents[0] as unknown as BusinessProfile;
    } catch (error) {
        authDebug.error('Failed to get business profile:', error);
        return null;
    }
}

/**
 * Get business profile by business ID
 */
export async function getBusinessProfileById(businessId: string): Promise<BusinessProfile | null> {
    try {
        const profile = await databases.getDocument(
            config.databaseID!,
            config.businessProfilesCollectionID!,
            businessId
        );

        return profile as unknown as BusinessProfile;
    } catch (error) {
        authDebug.error('Failed to get business profile by ID:', error);
        return null;
    }
}

/**
 * Update business profile
 */
export async function updateBusinessProfile(
    businessId: string,
    updates: Partial<BusinessProfile>
): Promise<BusinessProfile> {
    try {
        const updatedProfile = await databases.updateDocument(
            config.databaseID!,
            config.businessProfilesCollectionID!,
            businessId,
            updates
        );

        return updatedProfile as unknown as BusinessProfile;
    } catch (error) {
        authDebug.error('Failed to update business profile:', error);
        throw new Error('Failed to update business profile');
    }
}

/**
 * Search businesses by location, type, or name
 */
export async function searchBusinesses(
    query?: string,
    businessType?: string,
    location?: { lat: number; lng: number; radius: number }
): Promise<BusinessProfile[]> {
    try {
        const queries: any[] = [
            Query.equal('isVerified', true),
            Query.limit(50),
            Query.orderDesc('$createdAt')
        ];

        if (businessType) {
            queries.push(Query.equal('businessType', businessType));
        }

        if (query) {
            queries.push(Query.search('businessName', query));
        }

        // TODO: Add location-based search when Appwrite supports geo queries
        // For now, we'll filter client-side if location is provided

        const response = await databases.listDocuments(
            config.databaseID!,
            config.businessProfilesCollectionID!,
            queries
        );

        let businesses = response.documents as unknown as BusinessProfile[];

        // Client-side location filtering if needed
        if (location && location.lat && location.lng) {
            businesses = businesses.filter(business => {
                if (!business.locationLat || !business.locationLng) return false;

                const distance = calculateDistance(
                    location.lat,
                    location.lng,
                    business.locationLat,
                    business.locationLng
                );

                return distance <= location.radius;
            });
        }

        return businesses;
    } catch (error) {
        authDebug.error('Failed to search businesses:', error);
        return [];
    }
}

/**
 * Record QR code scan
 */
export async function recordQRCodeScan(
    scannedBy: string,
    businessId: string,
    scanLocation?: { lat: number; lng: number }
): Promise<QRCodeScan> {
    try {
        const scanRecord = await databases.createDocument(
            config.databaseID!,
            config.qrCodeScansCollectionID!,
            ID.unique(),
            {
                scannedBy,
                businessId,
                scanDate: new Date().toISOString(),
                scanLocation,
                userSignedUp: false, // Will be updated later if user signs up
                userDownloadedApp: true, // They must have the app to scan
            }
        );

        return scanRecord as unknown as QRCodeScan;
    } catch (error) {
        authDebug.error('Failed to record QR code scan:', error);
        throw new Error('Failed to record QR code scan');
    }
}

/**
 * Create ticket type for a business event
 */
export async function createTicketType(
    eventId: string,
    businessId: string,
    ticketData: Omit<TicketType, '$id' | 'eventId' | 'businessId' | 'soldQuantity' | 'availableQuantity' | '$createdAt' | '$updatedAt'>
): Promise<TicketType> {
    try {
        const ticketType = await databases.createDocument(
            config.databaseID!,
            config.ticketTypesCollectionID!,
            ID.unique(),
            {
                eventId,
                businessId,
                ...ticketData,
                soldQuantity: 0,
                availableQuantity: ticketData.totalQuantity,
            },
            [
                Permission.read(Role.any()),
                Permission.update(Role.user(businessId)),
                Permission.delete(Role.user(businessId)),
            ]
        );

        return ticketType as unknown as TicketType;
    } catch (error) {
        authDebug.error('Failed to create ticket type:', error);
        throw new Error('Failed to create ticket type');
    }
}

/**
 * Get ticket types for an event
 */
export async function getEventTicketTypes(eventId: string): Promise<TicketType[]> {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.ticketTypesCollectionID!,
            [
                Query.equal('eventId', eventId),
                Query.equal('isActive', true),
                Query.orderAsc('price')
            ]
        );

        return response.documents as unknown as TicketType[];
    } catch (error) {
        authDebug.error('Failed to get event ticket types:', error);
        return [];
    }
}

/**
 * Record ticket purchase (after successful Stripe payment)
 */
export async function recordTicketPurchase(
    purchaseData: Omit<TicketPurchase, '$id' | '$createdAt' | '$updatedAt'>
): Promise<TicketPurchase> {
    try {
        // Generate ticket codes
        const ticketCodes = Array.from({ length: purchaseData.quantity }, () =>
            `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        );

        const purchase = await databases.createDocument(
            config.databaseID!,
            config.ticketPurchasesCollectionID!,
            ID.unique(),
            {
                ...purchaseData,
                ticketCodes,
            },
            [
                Permission.read(Role.user(purchaseData.userId)),
                Permission.read(Role.user(purchaseData.businessId)),
                Permission.update(Role.user(purchaseData.businessId)),
            ]
        );

        // Update ticket type sold quantity
        await updateTicketTypeSoldQuantity(purchaseData.ticketTypeId, purchaseData.quantity);

        return purchase as unknown as TicketPurchase;
    } catch (error) {
        authDebug.error('Failed to record ticket purchase:', error);
        throw new Error('Failed to record ticket purchase');
    }
}

/**
 * Get user's ticket purchases
 */
export async function getUserTicketPurchases(userId: string): Promise<TicketPurchase[]> {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.ticketPurchasesCollectionID!,
            [
                Query.equal('userId', userId),
                Query.orderDesc('$createdAt')
            ]
        );

        return response.documents as unknown as TicketPurchase[];
    } catch (error) {
        authDebug.error('Failed to get user ticket purchases:', error);
        return [];
    }
}

/**
 * Get business ticket sales
 */
export async function getBusinessTicketSales(businessId: string): Promise<TicketPurchase[]> {
    try {
        const response = await databases.listDocuments(
            config.databaseID!,
            config.ticketPurchasesCollectionID!,
            [
                Query.equal('businessId', businessId),
                Query.orderDesc('$createdAt')
            ]
        );

        return response.documents as unknown as TicketPurchase[];
    } catch (error) {
        authDebug.error('Failed to get business ticket sales:', error);
        return [];
    }
}

/**
 * Upload business logo
 */
export async function uploadBusinessLogo(
    businessId: string,
    imageUri: string
): Promise<string> {
    try {
        const response = await fetch(imageUri);
        const blob = await response.blob();

        const file = {
            name: `business_logo_${businessId}_${Date.now()}.jpg`,
            type: 'image/jpeg',
            size: blob.size,
            uri: imageUri,
        };

        const uploadedFile = await storage.createFile(
            config.businessPhotosBucketID!,
            ID.unique(),
            file,
            [Permission.read(Role.any())]
        );

        const logoUrl = storage.getFileView(config.businessPhotosBucketID!, uploadedFile.$id);

        // Update business profile with logo URL
        await updateBusinessProfile(businessId, { logoUrl: logoUrl.toString() });

        return logoUrl.toString();
    } catch (error) {
        authDebug.error('Failed to upload business logo:', error);
        throw new Error('Failed to upload business logo');
    }
}

// Helper functions
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in kilometers
    return d;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

async function updateTicketTypeSoldQuantity(ticketTypeId: string, quantity: number): Promise<void> {
    try {
        const ticketType = await databases.getDocument(
            config.databaseID!,
            config.ticketTypesCollectionID!,
            ticketTypeId
        ) as unknown as TicketType;

        const newSoldQuantity = ticketType.soldQuantity + quantity;
        const newAvailableQuantity = ticketType.totalQuantity - newSoldQuantity;

        await databases.updateDocument(
            config.databaseID!,
            config.ticketTypesCollectionID!,
            ticketTypeId,
            {
                soldQuantity: newSoldQuantity,
                availableQuantity: newAvailableQuantity,
            }
        );
    } catch (error) {
        authDebug.error('Failed to update ticket type sold quantity:', error);
    }
}