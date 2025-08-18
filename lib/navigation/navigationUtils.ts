/**
 * Navigation utilities to ensure consistent back navigation behavior
 * throughout the app.
 */

import { router } from 'expo-router';

/**
 * Enhanced back navigation that handles edge cases and ensures proper
 * navigation stack management.
 */
export const handleBack = (fallbackRoute?: string) => {
    try {
        // First, try to use the router's built-in back functionality
        if (router.canGoBack()) {
            router.back();
            return;
        }

        // If we can't go back and have a fallback route, use it
        if (fallbackRoute) {
            router.push(fallbackRoute as any);
            return;
        }

        // As a last resort, go to the home tab
        router.push('/(root)/(tabs)/Home' as any);
    } catch (error) {
        console.error('Navigation error in handleBack:', error);

        // Emergency fallback - go to home
        try {
            router.push('/(root)/(tabs)/Home' as any);
        } catch (fallbackError) {
            console.error('Emergency navigation fallback failed:', fallbackError);
        }
    }
};

/**
 * Safe navigation push with error handling
 */
export const safePush = (route: string) => {
    try {
        router.push(route as any);
    } catch (error) {
        console.error('Navigation error in safePush:', error);
        // Try alternative navigation method
        setTimeout(() => {
            try {
                router.push(route as any);
            } catch (retryError) {
                console.error('Navigation retry failed:', retryError);
            }
        }, 100);
    }
};

/**
 * Safe navigation replace with error handling
 */
export const safeReplace = (route: string) => {
    try {
        router.replace(route as any);
    } catch (error) {
        console.error('Navigation error in safeReplace:', error);
        // Try alternative navigation method
        setTimeout(() => {
            try {
                router.replace(route as any);
            } catch (retryError) {
                console.error('Navigation replace retry failed:', retryError);
            }
        }, 100);
    }
};

/**
 * Check if we're currently at the root of a tab
 */
export const isAtTabRoot = (): boolean => {
    // This is a simplified check - in a more complex app you might need
    // to track navigation state more thoroughly
    try {
        return !router.canGoBack();
    } catch (error) {
        console.error('Error checking if at tab root:', error);
        return false;
    }
};

/**
 * Navigate to a tab while preserving the ability to go back
 * Only use this for intentional tab switches, not for back navigation
 */
export const navigateToTab = (tabRoute: string) => {
    try {
        // Use push instead of replace to maintain navigation stack
        router.push(tabRoute as any);
    } catch (error) {
        console.error('Error navigating to tab:', error);
    }
};
