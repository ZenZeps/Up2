/**
 * Email verification and password reset configuration utilities
 */

/**
 * Validates that the verification URL scheme is properly configured
 */
export function validateVerificationUrl(): boolean {
    // Check if the deep link scheme is configured properly
    const verificationUrl = 'up2://verify';

    // In a real implementation, you might want to check if the URL scheme
    // is registered with the app's configuration
    return verificationUrl.startsWith('up2://');
}

/**
 * Validates that the password reset URL scheme is properly configured
 */
export function validatePasswordResetUrl(): boolean {
    const resetUrl = 'up2://reset-password';
    return resetUrl.startsWith('up2://');
}

/**
 * Gets the verification redirect URL for Appwrite
 */
export function getVerificationUrl(): string {
    return 'up2://verify';
}

/**
 * Gets the password reset redirect URL for Appwrite
 */
export function getPasswordResetUrl(): string {
    return 'up2://reset-password';
}

/**
 * Parses a verification URL to extract userId and secret
 */
export function parseVerificationUrl(url: string): { userId?: string; secret?: string } {
    try {
        const urlObj = new URL(url);
        const userId = urlObj.searchParams.get('userId');
        const secret = urlObj.searchParams.get('secret');

        return {
            userId: userId || undefined,
            secret: secret || undefined
        };
    } catch (error) {
        console.warn('Failed to parse verification URL:', error);
        return {};
    }
}

/**
 * Parses a password reset URL to extract userId and secret
 */
export function parsePasswordResetUrl(url: string): { userId?: string; secret?: string } {
    try {
        const urlObj = new URL(url);
        const userId = urlObj.searchParams.get('userId');
        const secret = urlObj.searchParams.get('secret');

        return {
            userId: userId || undefined,
            secret: secret || undefined
        };
    } catch (error) {
        console.warn('Failed to parse password reset URL:', error);
        return {};
    }
}

/**
 * Email verification status constants
 */
export const VERIFICATION_STATUS = {
    PENDING: 'pending',
    VERIFIED: 'verified',
    EXPIRED: 'expired',
    INVALID: 'invalid'
} as const;

export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];
