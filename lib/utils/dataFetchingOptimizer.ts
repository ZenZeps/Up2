/**
 * Data Fetching Optimizer - Smart cache management for optimal app performance
 * This utility manages when to fetch from database vs local storage based on user actions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { authDebug } from '../debug/authDebug';
import { cacheManager } from '../debug/cacheManager';

export type ScreenType = 'home' | 'feed' | 'explore' | 'profile';
export type ActionType = 'create' | 'update' | 'delete' | 'attend' | 'unattend' | 'friend' | 'unfriend' | 'joinGroup' | 'leaveGroup' | 'acceptFriendRequest' | 'updateProfile';

interface DataFetchState {
    lastDbFetch: number;
    requiresDbFetch: boolean;
    affectedScreens: Set<ScreenType>;
    reason?: string;
}

class DataFetchingOptimizer {
    private static instance: DataFetchingOptimizer;
    private stateKey = '@DataFetchState:';
    private fetchStates = new Map<ScreenType, DataFetchState>();

    // Actions that affect each screen
    private screenActions: Record<ScreenType, ActionType[]> = {
        home: ['create', 'update', 'delete', 'attend', 'unattend'],
        feed: ['create', 'update', 'delete', 'attend', 'unattend'],
        explore: ['create', 'update', 'delete', 'attend', 'unattend'],
        profile: ['friend', 'unfriend', 'acceptFriendRequest', 'joinGroup', 'leaveGroup', 'updateProfile']
    };

    // Cache TTL for each screen (in milliseconds)
    private screenCacheTTL: Record<ScreenType, number> = {
        home: 10 * 60 * 1000,     // 10 minutes
        feed: 15 * 60 * 1000,     // 15 minutes  
        explore: 20 * 60 * 1000,  // 20 minutes
        profile: 30 * 60 * 1000   // 30 minutes (updates less frequently)
    };

    public static getInstance(): DataFetchingOptimizer {
        if (!DataFetchingOptimizer.instance) {
            DataFetchingOptimizer.instance = new DataFetchingOptimizer();
        }
        return DataFetchingOptimizer.instance;
    }

    private constructor() {
        this.loadFetchStates();
    }

    /**
     * Load fetch states from persistent storage
     */
    private async loadFetchStates() {
        try {
            const screens: ScreenType[] = ['home', 'feed', 'explore', 'profile'];

            for (const screen of screens) {
                const state = await AsyncStorage.getItem(`${this.stateKey}${screen}`);
                if (state) {
                    const parsed = JSON.parse(state) as Omit<DataFetchState, 'affectedScreens'> & { affectedScreens: string[] };
                    this.fetchStates.set(screen, {
                        ...parsed,
                        affectedScreens: new Set(parsed.affectedScreens as ScreenType[])
                    });
                } else {
                    // Initialize default state
                    this.fetchStates.set(screen, {
                        lastDbFetch: 0,
                        requiresDbFetch: true, // Initial mount should fetch from DB
                        affectedScreens: new Set(),
                        reason: 'initial'
                    });
                }
            }
            authDebug.debug('DataFetchingOptimizer: Loaded fetch states from storage');
        } catch (error) {
            authDebug.error('Failed to load fetch states:', error);
        }
    }

    /**
     * Save fetch states to persistent storage
     */
    private async saveFetchStates() {
        try {
            const promises: Promise<void>[] = [];

            for (const [screen, state] of this.fetchStates.entries()) {
                const serializable = {
                    ...state,
                    affectedScreens: Array.from(state.affectedScreens)
                };
                promises.push(
                    AsyncStorage.setItem(`${this.stateKey}${screen}`, JSON.stringify(serializable))
                );
            }

            await Promise.all(promises);
            authDebug.debug('DataFetchingOptimizer: Saved fetch states to storage');
        } catch (error) {
            authDebug.error('Failed to save fetch states:', error);
        }
    }

    /**
     * Record that a user action occurred that affects data freshness
     */
    async recordAction(action: ActionType, reason?: string) {
        const now = Date.now();
        const affectedScreens = this.getAffectedScreens(action);

        authDebug.info(`DataFetchingOptimizer: Recording action '${action}' affecting screens: ${Array.from(affectedScreens).join(', ')}`, { reason });

        // Update states for all affected screens
        for (const screen of affectedScreens) {
            const currentState = this.fetchStates.get(screen);
            if (currentState) {
                currentState.requiresDbFetch = true;
                currentState.affectedScreens.add(screen);
                currentState.reason = `${action}${reason ? `: ${reason}` : ''}`;
            }
        }

        // Invalidate relevant caches
        this.invalidateAffectedCaches(affectedScreens, action);

        await this.saveFetchStates();
    }

    /**
     * Determine if a screen should fetch from database or use cache/local storage
     */
    async shouldFetchFromDatabase(screen: ScreenType, isInitialMount: boolean = false): Promise<{
        shouldFetch: boolean;
        reason: string;
        cacheStrategy: 'database' | 'memory' | 'storage';
    }> {
        const state = this.fetchStates.get(screen);
        if (!state) {
            return {
                shouldFetch: true,
                reason: 'no_state_found',
                cacheStrategy: 'database'
            };
        }

        // Initial mount always fetches from DB for fresh data
        if (isInitialMount) {
            authDebug.debug(`DataFetchingOptimizer: Initial mount for ${screen} - fetching from database`);
            await this.recordDbFetch(screen);
            return {
                shouldFetch: true,
                reason: 'initial_mount',
                cacheStrategy: 'database'
            };
        }

        // If user performed actions that affect this screen's data
        if (state.requiresDbFetch) {
            authDebug.debug(`DataFetchingOptimizer: ${screen} requires DB fetch due to: ${state.reason}`);
            await this.recordDbFetch(screen);
            return {
                shouldFetch: true,
                reason: state.reason || 'data_changed',
                cacheStrategy: 'database'
            };
        }

        // Check if cache has expired
        const now = Date.now();
        const cacheAge = now - state.lastDbFetch;
        const cacheTTL = this.screenCacheTTL[screen];

        if (cacheAge > cacheTTL) {
            authDebug.debug(`DataFetchingOptimizer: ${screen} cache expired (${Math.round(cacheAge / 1000)}s > ${Math.round(cacheTTL / 1000)}s)`);
            await this.recordDbFetch(screen);
            return {
                shouldFetch: true,
                reason: 'cache_expired',
                cacheStrategy: 'database'
            };
        }

        // Check if we have valid cached data in memory first
        const memoryCache = this.getMemoryCache(screen);
        if (memoryCache && memoryCache.length > 0) {
            authDebug.debug(`DataFetchingOptimizer: Using memory cache for ${screen} (${memoryCache.length} items)`);
            return {
                shouldFetch: false,
                reason: 'memory_cache_valid',
                cacheStrategy: 'memory'
            };
        }

        // Fall back to local storage cache
        const storageCache = await this.getStorageCache(screen);
        if (storageCache && storageCache.length > 0) {
            authDebug.debug(`DataFetchingOptimizer: Using storage cache for ${screen} (${storageCache.length} items)`);
            return {
                shouldFetch: false,
                reason: 'storage_cache_valid',
                cacheStrategy: 'storage'
            };
        }

        // No valid cache found, need to fetch from DB
        authDebug.debug(`DataFetchingOptimizer: No valid cache for ${screen}, fetching from database`);
        await this.recordDbFetch(screen);
        return {
            shouldFetch: true,
            reason: 'no_valid_cache',
            cacheStrategy: 'database'
        };
    }

    /**
     * Record that a database fetch occurred for a screen
     */
    private async recordDbFetch(screen: ScreenType) {
        const state = this.fetchStates.get(screen);
        if (state) {
            state.lastDbFetch = Date.now();
            state.requiresDbFetch = false;
            state.affectedScreens.clear();
            state.reason = undefined;
            await this.saveFetchStates();
        }
    }

    /**
     * Get screens affected by a specific action
     */
    private getAffectedScreens(action: ActionType): Set<ScreenType> {
        const affected = new Set<ScreenType>();

        for (const [screen, actions] of Object.entries(this.screenActions)) {
            if (actions.includes(action)) {
                affected.add(screen as ScreenType);
            }
        }

        return affected;
    }

    /**
     * Get memory cache for a screen (from EventContext)
     */
    private getMemoryCache(screen: ScreenType): any[] | null {
        try {
            // This will be integrated with your existing EventContext screen cache
            const cacheKey = `screen-${screen}`;
            return cacheManager.get<any[]>(cacheKey);
        } catch (error) {
            authDebug.debug(`Failed to get memory cache for ${screen}:`, error);
            return null;
        }
    }

    /**
     * Get storage cache for a screen
     */
    private async getStorageCache(screen: ScreenType): Promise<any[] | null> {
        try {
            const cacheKey = `@ScreenCache:${screen}`;
            const cached = await AsyncStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                // Check if cache is still valid based on timestamp
                if (parsed.timestamp && (Date.now() - parsed.timestamp < this.screenCacheTTL[screen])) {
                    return parsed.data;
                }
            }
            return null;
        } catch (error) {
            authDebug.debug(`Failed to get storage cache for ${screen}:`, error);
            return null;
        }
    }

    /**
     * Cache data to storage for a screen
     */
    async cacheDataToStorage(screen: ScreenType, data: any[]) {
        try {
            const cacheKey = `@ScreenCache:${screen}`;
            const cacheData = {
                data,
                timestamp: Date.now()
            };
            await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
            authDebug.debug(`DataFetchingOptimizer: Cached ${data.length} items to storage for ${screen}`);
        } catch (error) {
            authDebug.error(`Failed to cache data to storage for ${screen}:`, error);
        }
    }

    /**
     * Invalidate caches for affected screens
     */
    private invalidateAffectedCaches(screens: Set<ScreenType>, action: ActionType) {
        for (const screen of screens) {
            // Clear memory cache
            cacheManager.remove(`screen-${screen}`);

            // Clear storage cache (async, fire and forget)
            AsyncStorage.removeItem(`@ScreenCache:${screen}`).catch(err => {
                authDebug.debug(`Failed to clear storage cache for ${screen}:`, err);
            });

            authDebug.debug(`DataFetchingOptimizer: Invalidated caches for ${screen} due to ${action}`);
        }
    }

    /**
     * Clear all fetch states (useful for logout)
     */
    async clearAllStates() {
        try {
            const screens: ScreenType[] = ['home', 'feed', 'explore', 'profile'];

            // Clear persistent storage
            const promises: Promise<void>[] = [];
            for (const screen of screens) {
                promises.push(AsyncStorage.removeItem(`${this.stateKey}${screen}`));
                promises.push(AsyncStorage.removeItem(`@ScreenCache:${screen}`));
            }
            await Promise.all(promises);

            // Clear in-memory state
            this.fetchStates.clear();

            authDebug.debug('DataFetchingOptimizer: Cleared all states');
        } catch (error) {
            authDebug.error('Failed to clear all states:', error);
        }
    }

    /**
     * Get debug information about current fetch states
     */
    getDebugInfo(): Record<string, any> {
        const info: Record<string, any> = {};

        for (const [screen, state] of this.fetchStates.entries()) {
            const cacheAge = Date.now() - state.lastDbFetch;
            info[screen] = {
                lastDbFetch: new Date(state.lastDbFetch).toISOString(),
                cacheAgeSeconds: Math.round(cacheAge / 1000),
                requiresDbFetch: state.requiresDbFetch,
                reason: state.reason,
                affectedScreens: Array.from(state.affectedScreens),
                cacheTTL: Math.round(this.screenCacheTTL[screen] / 1000)
            };
        }

        return info;
    }
}

// Export singleton instance
export const dataFetchingOptimizer = DataFetchingOptimizer.getInstance();

// Helper function to be used in screens
export async function shouldFetchData(
    screen: ScreenType,
    isInitialMount: boolean = false
): Promise<{
    shouldFetch: boolean;
    reason: string;
    cacheStrategy: 'database' | 'memory' | 'storage';
}> {
    return dataFetchingOptimizer.shouldFetchFromDatabase(screen, isInitialMount);
}

// Helper function to record user actions
export async function recordUserAction(action: ActionType, reason?: string): Promise<void> {
    return dataFetchingOptimizer.recordAction(action, reason);
}

// Helper function to cache data after fetching
export async function cacheScreenData(screen: ScreenType, data: any[]): Promise<void> {
    return dataFetchingOptimizer.cacheDataToStorage(screen, data);
}
