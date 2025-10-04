/**
 * Data Preloader Service
 * Preloads essential data during splash screen to improve app startup perfor            console.log('🌐 Calling getPublicEvents API...');
            console.log('🌐 Appwrite config check:', {
                endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ? 'configured' : 'missing',
                projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ? 'configured' : 'missing',
                databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID ? 'configured' : 'missing',
                eventsCollectionId: process.env.EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID ? 'configured' : 'missing'
            });
            
            const events = await getPublicEvents(false, userId);
            console.log(`🌐 getPublicEvents returned:`, {
                eventsCount: events ? events.length : 0,
                eventsType: typeof events,
                isArray: Array.isArray(events),
                firstEventTitle: events && events.length > 0 ? events[0].title : 'N/A'
            });

            if (events && events.length > 0) {
 */

import { getPublicEvents } from '@/lib/api/event';
import { getUserFriends } from '@/lib/api/friendship';
import { getUserGroups } from '@/lib/api/group';
import { getUserProfile } from '@/lib/api/user';
import { cacheManager } from '@/lib/debug/cacheManager';

interface PreloadOptions {
    userId?: string;
    skipCache?: boolean;
}

class DataPreloaderService {
    private isPreloading = false;
    private preloadPromise: Promise<void> | null = null;

    /**
     * Preload essential app data during splash screen
     */
    async preloadAppData(options: PreloadOptions = {}): Promise<void> {
        const { userId, skipCache = false } = options;

        // Prevent multiple simultaneous preload attempts
        if (this.isPreloading && this.preloadPromise) {
            return this.preloadPromise;
        }

        this.isPreloading = true;
        this.preloadPromise = this.performPreload(userId, skipCache);

        try {
            await this.preloadPromise;
        } finally {
            this.isPreloading = false;
            this.preloadPromise = null;
        }
    }

    private async performPreload(userId?: string, skipCache = false): Promise<void> {
        try {
            console.log('🚀 Starting data preload for Home and Feed...');
            console.log(`User ID: ${userId || 'Not provided'}`);
            console.log(`Skip cache: ${skipCache}`);
            const startTime = Date.now();

            // Phase 1: Critical data for Home and Feed (sequential for better progress feedback)
            console.log('📊 Phase 1: Loading events data...');
            try {
                await this.preloadPublicEvents(userId, skipCache);
                console.log('✅ Events preload completed successfully');
            } catch (error) {
                console.error('❌ Events preload failed:', error);
            }

            // Phase 2: User-specific data (parallel)
            if (userId) {
                console.log('👤 Phase 2: Loading user data...');
                const userDataTasks = [
                    this.preloadUserData(userId, skipCache)
                        .catch(error => {
                            console.error('Failed to preload user data:', error);
                            return null;
                        }),
                    this.preloadMiscData()
                        .catch(error => {
                            console.error('Failed to preload misc data:', error);
                            return null;
                        })
                ];
                const results = await Promise.allSettled(userDataTasks);
                console.log('👤 User data preload results:', results.map(r => r.status));
            } else {
                console.log('🔧 Loading misc data (no user)...');
                await this.preloadMiscData()
                    .catch(error => console.error('Failed to preload misc data:', error));
            }

            const endTime = Date.now();
            console.log(`✅ Home and Feed data preload completed in ${endTime - startTime}ms`);

        } catch (error) {
            console.error('❌ Data preload failed with critical error:', error);
            // Don't throw - we want the app to start even if preload fails
        }
    }

    /**
     * Preload public events for Home and Feed screens
     */
    private async preloadPublicEvents(userId?: string, skipCache = false): Promise<void> {
        try {
            console.log(`🎉 Starting preloadPublicEvents - userId: ${userId}, skipCache: ${skipCache}`);

            // Check cache first unless skipping
            if (!skipCache) {
                const cachedEvents = cacheManager.get('all-events');
                if (cachedEvents && Array.isArray(cachedEvents) && cachedEvents.length > 0) {
                    console.log(`📦 Using cached events for preload - ${cachedEvents.length} events - Home/Feed ready instantly`);
                    return;
                }
                console.log('📦 No cached events found, loading from API...');
            }

            console.log('� Calling getPublicEvents API...');
            const events = await getPublicEvents(false, userId);
            console.log(`🌐 getPublicEvents returned: ${events ? events.length : 0} events`);

            if (events && events.length > 0) {
                // Cache for 15 minutes
                cacheManager.set('all-events', events, 15 * 60 * 1000);
                console.log(`✅ Preloaded ${events.length} events - Home and Feed screens ready`);

                // Also warm up screen-specific caches
                try {
                    // Import screen cache functions dynamically to avoid circular dependencies
                    const { cacheScreenData } = await import('@/lib/utils/dataFetchingOptimizer');
                    await cacheScreenData('home', events);
                    await cacheScreenData('feed', events.filter((e: any) => !e.isAttending));
                    console.log('🔥 Warmed up Home and Feed screen caches');
                } catch (cacheError) {
                    console.warn('Failed to warm up screen caches:', cacheError);
                }
            } else {
                console.log('⚠️ No events found to preload');
            }
        } catch (error) {
            console.error('❌ Failed to preload public events:', {
                error: error,
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                name: error instanceof Error ? error.name : undefined
            });
            // Don't throw - let the app continue even if preload fails
        }
    }

    /**
     * Preload user-specific data
     */
    private async preloadUserData(userId: string, skipCache = false): Promise<void> {
        try {
            console.log('👤 Preloading user data...');

            const userDataTasks = [
                // Preload user profile
                this.preloadUserProfile(userId, skipCache),
                // Preload user friends
                this.preloadUserFriends(userId, skipCache),
                // Preload user groups
                this.preloadUserGroups(userId, skipCache),
            ];

            await Promise.allSettled(userDataTasks);
            console.log('✅ User data preload completed');
        } catch (error) {
            console.warn('Failed to preload user data:', error);
        }
    }

    private async preloadUserProfile(userId: string, skipCache = false): Promise<void> {
        try {
            if (!skipCache && cacheManager.has(`user-${userId}`)) {
                return;
            }

            await getUserProfile(userId);
            console.log('✅ User profile preloaded');
        } catch (error) {
            console.warn('Failed to preload user profile:', error);
        }
    }

    private async preloadUserFriends(userId: string, skipCache = false): Promise<void> {
        try {
            if (!skipCache && cacheManager.has(`user-friends-${userId}`)) {
                return;
            }

            await getUserFriends(userId);
            console.log('✅ User friends preloaded');
        } catch (error) {
            console.warn('Failed to preload user friends:', error);
        }
    }

    private async preloadUserGroups(userId: string, skipCache = false): Promise<void> {
        try {
            if (!skipCache && cacheManager.has(`user-groups-${userId}`)) {
                return;
            }

            await getUserGroups(userId);
            console.log('✅ User groups preloaded');
        } catch (error) {
            console.warn('Failed to preload user groups:', error);
        }
    }

    /**
     * Preload miscellaneous data
     */
    private async preloadMiscData(): Promise<void> {
        try {
            // Add any other data that should be preloaded
            // Examples: app configuration, feature flags, etc.
            console.log('🔧 Misc data preload completed');
        } catch (error) {
            console.warn('Failed to preload misc data:', error);
        }
    }

    /**
     * Clear all preloaded data
     */
    clearPreloadedData(): void {
        cacheManager.clear();
        console.log('🧹 Preloaded data cleared');
    }
}

// Export singleton instance
export const dataPreloader = new DataPreloaderService();