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
 */
export class NotificationTokenService {
    private static readonly COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_NOTIFICATION_TOKENS_ID || 'user_notification_tokens';

    /**
     * Register or update a notification token for a user
     */
    static async registerToken(userId: string, token: string): Promise<void> {
        try {
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
                await databases.createDocument(
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
            throw error;
        }
    }

    /**
     * Get all active tokens for a user (supports multiple devices)
     */
    static async getUserTokens(userId: string): Promise<string[]> {
        try {
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
