import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { ID, Query } from 'react-native-appwrite';
import { config, databases } from '../appwrite/appwrite';

export interface NotificationToken {
    $id: string;
    userId: string;
    deviceToken: string;
    deviceType: 'ios' | 'android' | 'web';
    deviceId?: string;
    enabled: boolean;
    lastUsed: string; // ISO date string
    appVersion?: string;
}

/**
 * Professional notification token service following industry best practices
 * Separates notification tokens from user profiles to prevent database bloat
 * 
 * SETUP REQUIRED: Create the notification_tokens collection in Appwrite with these attributes:
 * - userId (String, required)
 * - deviceToken (String, required)
 * - deviceType (String, required)
 * - deviceId (String, optional)
 * - enabled (Boolean, required, default: true)
 * - lastUsed (String, required) // ISO date string
 * - appVersion (String, optional)
 */
export class NotificationTokenService {
    private static readonly COLLECTION_ID = config.notificationTokensCollectionID;

    /**
     * Check if the notification tokens collection exists and is properly configured
     */
    private static async checkCollectionExists(): Promise<boolean> {
        try {
            // Try to list documents with limit 1 to test collection access
            await databases.listDocuments(
                config.databaseID!,
                this.COLLECTION_ID,
                [Query.limit(1)]
            );
            return true;
        } catch (error: any) {
            if (error.message?.includes('Collection with the requested ID could not be found') ||
                error.message?.includes('Attribute not found in schema')) {
                console.warn('⚠️ Notification tokens collection not found or improperly configured.');
                console.warn('📋 To enable push notifications, create a collection in Appwrite with ID:', this.COLLECTION_ID);
                console.warn('📋 Required attributes: userId (string), deviceToken (string), deviceType (string), enabled (boolean), lastUsed (string)');
                return false;
            }
            throw error; // Re-throw unexpected errors
        }
    }

    /**
     * Register or update a notification token for a user
     */
    static async registerToken(userId: string, token: string): Promise<void> {
        try {
            // Check if collection exists before attempting operations
            const collectionExists = await this.checkCollectionExists();
            if (!collectionExists) {
                console.log('🔕 Skipping notification token registration - collection not configured');
                return;
            }

            const deviceType = Platform.OS as 'ios' | 'android';
            const deviceId = await this.getDeviceId();

            // Check if token already exists for this user/device
            const existing = await databases.listDocuments(
                config.databaseID!,
                this.COLLECTION_ID,
                [
                    Query.equal('userId', userId),
                    Query.equal('deviceToken', token)
                ]
            );

            if (existing.documents.length > 0) {
                // Update existing token
                await databases.updateDocument(
                    config.databaseID!,
                    this.COLLECTION_ID,
                    existing.documents[0].$id,
                    {
                        lastUsed: new Date().toISOString(),
                        enabled: true
                    }
                );
                console.log('📱 Updated existing notification token');
            } else {
                // Create new token record
                const { createDocumentSafe } = await import('@/lib/appwrite/safeDb');
                await createDocumentSafe(
                    config.databaseID!,
                    this.COLLECTION_ID,
                    ID.unique(),
                    {
                        userId,
                        deviceToken: token,
                        deviceType,
                        deviceId,
                        enabled: true,
                        lastUsed: new Date().toISOString(),
                        appVersion: '1.0.0' // TODO: Get from app config
                    }
                );
                console.log('📱 Registered new notification token');
            }
        } catch (error) {
            console.error('❌ Error registering notification token:', error);
            // Don't throw error for collection setup issues - app should continue working
            if (error instanceof Error &&
                (error.message?.includes('Collection with the requested ID could not be found') ||
                    error.message?.includes('Attribute not found in schema'))) {
                console.log('💡 This is expected if you haven\'t set up the notification_tokens collection yet');
                return; // Gracefully fail without breaking the app
            }
            throw error; // Only throw for unexpected errors
        }
    }

    /**
     * Get all active tokens for a user (supports multiple devices)
     */
    static async getUserTokens(userId: string): Promise<string[]> {
        try {
            // Check if collection exists before attempting operations
            const collectionExists = await this.checkCollectionExists();
            if (!collectionExists) {
                console.log('🔕 No notification tokens available - collection not configured');
                return [];
            }

            const tokens = await databases.listDocuments(
                config.databaseID!,
                this.COLLECTION_ID,
                [
                    Query.equal('userId', userId),
                    Query.equal('enabled', true)
                ]
            );

            return tokens.documents.map((doc: any) => doc.deviceToken);
        } catch (error) {
            console.error('❌ Error fetching user tokens:', error);
            return [];
        }
    }

    /**
     * Get tokens for multiple users efficiently
     */
    static async getMultipleUserTokens(userIds: string[]): Promise<string[]> {
        try {
            const allTokens: string[] = [];

            // Batch fetch tokens for all users
            const promises = userIds.map(userId => this.getUserTokens(userId));
            const userTokenArrays = await Promise.all(promises);

            // Flatten arrays and remove duplicates
            userTokenArrays.forEach(tokens => {
                allTokens.push(...tokens);
            });

            return [...new Set(allTokens)]; // Remove duplicates
        } catch (error) {
            console.error('❌ Error fetching multiple user tokens:', error);
            return [];
        }
    }

    /**
     * Disable a specific token (when user logs out or uninstalls)
     */
    static async disableToken(userId: string, token: string): Promise<void> {
        try {
            const existing = await databases.listDocuments(
                config.databaseID!,
                this.COLLECTION_ID,
                [
                    Query.equal('userId', userId),
                    Query.equal('deviceToken', token)
                ]
            );

            if (existing.documents.length > 0) {
                await databases.updateDocument(
                    config.databaseID!,
                    this.COLLECTION_ID,
                    existing.documents[0].$id,
                    { enabled: false }
                );
                console.log('📱 Disabled notification token');
            }
        } catch (error) {
            console.error('❌ Error disabling token:', error);
        }
    }

    /**
     * Clean up old/invalid tokens (call periodically)
     */
    static async cleanupOldTokens(olderThanDays: number = 30): Promise<void> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            const oldTokens = await databases.listDocuments(
                config.databaseID!,
                this.COLLECTION_ID,
                [
                    Query.lessThan('lastUsed', cutoffDate.toISOString())
                ]
            );

            const deletePromises = oldTokens.documents.map(doc =>
                databases.deleteDocument(config.databaseID!, this.COLLECTION_ID, doc.$id)
            );

            await Promise.all(deletePromises);
            console.log(`🧹 Cleaned up ${oldTokens.documents.length} old notification tokens`);
        } catch (error) {
            console.error('❌ Error cleaning up old tokens:', error);
        }
    }

    /**
     * Get device identifier for tracking multiple devices
     */
    private static async getDeviceId(): Promise<string> {
        // This is a simplified device ID - in production you might want to use
        // expo-device's deviceId or generate a stable identifier
        return `${Platform.OS}-${Device.modelName || 'unknown'}`;
    }
}
