import * as Linking from 'expo-linking';
import { Share } from 'react-native';
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
        type: 'event-invite',
        eventTitle: inviteData.eventTitle,
        eventDate: inviteData.eventDate,
        eventLocation: inviteData.eventLocation,
        inviterName: inviteData.inviterName
    });

    // Use the same GitHub Pages domain as email verification and password reset
    return `https://zenzeps.github.io/Up2/invite-landing.html?${params.toString()}`;
};

/**
 * Generates a direct deep link that opens the app if installed
 */
export const generateAppDeepLink = (inviteData: InviteData): string => {
    const params = new URLSearchParams({
        eventId: inviteData.eventId,
        inviter: inviteData.inviterUserId,
        type: 'event-invite'
    });

    return `up2://invite?${params.toString()}`;
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

        // Use React Native's built-in Share API for text content
        const result = await Share.share({
            message: shareContent.message,
            title: shareContent.title,
            url: shareContent.url, // iOS will use this if provided
        }, {
            dialogTitle: shareContent.title, // Android dialog title
        });

        // Check if the user actually shared (not just dismissed)
        if (result.action === Share.sharedAction) {
            return true;
        } else if (result.action === Share.dismissedAction) {
            // User dismissed the share sheet
            return false;
        }

        return true; // Default to success for unknown actions
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
        // Instagram doesn't support direct text sharing via URL schemes for regular posts
        // The only option is to use the general sharing, which will show Instagram as an option
        console.log('Using general sharing for Instagram (Instagram does not support direct text sharing)');
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

        // Messenger sharing is complex and has limited URL scheme support
        // The best approach is to use the general sharing which will include Messenger as an option
        console.log('Using general sharing for Messenger (most reliable method)');
        return await shareEventInvite(inviteData);
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
};

/**
 * Tests deep link functionality by attempting to open the app
 */
export const testDeepLink = async (inviteData: InviteData): Promise<boolean> => {
    try {
        const deepLink = generateAppDeepLink(inviteData);
        console.log('Testing deep link:', deepLink);

        const canOpen = await Linking.canOpenURL(deepLink);
        console.log('Can open deep link:', canOpen);

        if (canOpen) {
            await Linking.openURL(deepLink);
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error testing deep link:', error);
        return false;
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
