import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import { config, databases, getCurrentUserWithProfile } from '../appwrite/appwrite';
import { logInviteEvent } from './inviteTracking';

export interface InviteData {
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventLocation: string;
    inviterName: string;
    inviterUserId: string;
}

/**
 * Generates a universal invite link for an event.
 * This link works whether the user has the app installed or not.
 */
export const generateInviteLink = (inviteData: InviteData): string => {
    const params = new URLSearchParams({
        eventId: inviteData.eventId,
        inviter: inviteData.inviterUserId,
        type: 'event-invite' // Keep type for parsing logic
    });

    // Use the universal domain configured in app.json
    return `https://up2.app/invite?${params.toString()}`;
};

/**
 * Creates shareable content for social media platforms
 * Uses platform-specific sharing to make links work better
 */
export const createShareContent = (inviteData: InviteData) => {
    const inviteLink = generateInviteLink(inviteData);

    const shareContent = {
        title: `${inviteData.inviterName} invited you to ${inviteData.eventTitle}`,
        message: `🎉 You're invited to ${inviteData.eventTitle}!\n\n` +
            `📅 ${inviteData.eventDate}\n` +
            `📍 ${inviteData.eventLocation}\n\n` +
            `Click the link to see the details and join the event:\n` +
            `${inviteLink}\n\n` +
            `See you there!`,
        url: inviteLink, // url is important for some sharing platforms
    };

    return shareContent;
};

/**
 * Shares event invite via native sharing sheet
 */
export const shareEventInvite = async (inviteData: InviteData): Promise<boolean> => {
    try {
        const shareContent = createShareContent(inviteData);

        if (await Sharing.isAvailableAsync()) {
            // Use native sharing with both message and URL
            await Sharing.shareAsync(shareContent.message, {
                dialogTitle: shareContent.title,
                mimeType: 'text/plain',
            });
            return true;
        } else {
            // Fallback for platforms where sharing isn't available
            console.log('Sharing not available, fallback needed');
            return false;
        }
    } catch (error) {
        console.error('Error sharing event invite:', error);
        return false;
    }
};

/**
 * Shares specific to WhatsApp (using URL scheme)
 */
export const shareToWhatsApp = async (inviteData: InviteData): Promise<boolean> => {
    try {
        const shareContent = createShareContent(inviteData);
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareContent.message)}`;

        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
            await Linking.openURL(whatsappUrl);
            return true;
        } else {
            // Fallback to web WhatsApp
            const webWhatsappUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(shareContent.message)}`;
            await Linking.openURL(webWhatsappUrl);
            return true;
        }
    } catch (error) {
        console.error('Error sharing to WhatsApp:', error);
        return false;
    }
};

/**
 * Shares to Instagram Stories (uses general sharing since direct Instagram sharing is limited)
 */
export const shareToInstagram = async (inviteData: InviteData): Promise<boolean> => {
    try {
        // Instagram doesn't allow direct text sharing via URL schemes
        // Use the general sharing method which will include Instagram as an option
        return await shareEventInvite(inviteData);
    } catch (error) {
        console.error('Error sharing to Instagram:', error);
        return false;
    }
};

/**
 * Shares to Facebook Messenger
 */
export const shareToMessenger = async (inviteData: InviteData): Promise<boolean> => {
    try {
        const shareContent = createShareContent(inviteData);

        // Try the Messenger app scheme first
        const messengerUrl = `fb-messenger://share?text=${encodeURIComponent(shareContent.message)}`;

        const canOpen = await Linking.canOpenURL(messengerUrl);
        if (canOpen) {
            await Linking.openURL(messengerUrl);
            return true;
        } else {
            // If Messenger app isn't available, use general sharing
            // This will show Messenger as an option if installed
            return await shareEventInvite(inviteData);
        }
    } catch (error) {
        console.error('Error sharing to Messenger:', error);
        // Even if there's an error, try the general sharing as fallback
        try {
            return await shareEventInvite(inviteData);
        } catch (fallbackError) {
            console.error('Error with fallback sharing:', fallbackError);
            return false;
        }
    }
};

/**
 * Logs an invite send event (for analytics/tracking)
 */
export const logInviteSent = async (
    eventId: string,
    inviterUserId: string,
    platform: 'whatsapp' | 'instagram' | 'messenger' | 'general'
): Promise<void> => {
    try {
        await logInviteEvent(eventId, inviterUserId, platform);
    } catch (error) {
        // Fail silently for analytics
        console.log('Could not log invite sent:', error);
    }
};/**
 * Validates and extracts invite data from a deep link
 */
export const parseInviteLink = (url: string): { eventId?: string; inviterUserId?: string; type?: string } | null => {
    try {
        const { queryParams } = Linking.parse(url);

        if (queryParams?.type === 'event-invite' && queryParams?.eventId) {
            return {
                eventId: queryParams.eventId as string,
                inviterUserId: queryParams.inviter as string,
                type: queryParams.type as string,
            };
        }

        return null;
    } catch (error) {
        console.error('Error parsing invite link:', error);
        return null;
    }
};

/**
 * Gets event data for invite sharing
 */
export const getEventInviteData = async (eventId: string): Promise<InviteData | null> => {
    try {
        // Get event details
        const event = await databases.getDocument(
            config.databaseID!,
            config.eventsCollectionID!,
            eventId
        );

        // Get current user (inviter)
        const currentUser = await getCurrentUserWithProfile();
        if (!currentUser) return null;

        // Format date
        const eventDate = new Date(event.startTime).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return {
            eventId: event.$id,
            eventTitle: event.title,
            eventDate: eventDate,
            eventLocation: event.location,
            inviterName: currentUser.profile ? `${currentUser.profile.firstName} ${currentUser.profile.lastName}` : currentUser.name,
            inviterUserId: currentUser.$id,
        };
    } catch (error) {
        console.error('Error getting event invite data:', error);
        return null;
    }
};
