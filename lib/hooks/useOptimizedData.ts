/**
 * Optimized Data Fetching Hooks
 * These hooks integrate with the DataFetchingOptimizer to provide smart caching
 */

import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEvents } from '../../app/(root)/context/EventContext';
import { authDebug } from '../debug/authDebug';
import {
    ActionType,
    cacheScreenData,
    recordUserAction,
    ScreenType,
    shouldFetchData
} from '../utils/dataFetchingOptimizer';

interface OptimizedDataHookOptions {
    screen: ScreenType;
    fetchFunction: () => Promise<any[]>;
    dependencies?: any[];
    enableAutoRefetch?: boolean;
    cacheToMemory?: boolean;
}

interface OptimizedDataHookResult {
    data: any[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    recordAction: (action: ActionType, reason?: string) => Promise<void>;
}

/**
 * Hook for optimized data fetching with smart caching
 */
export function useOptimizedDataFetch({
    screen,
    fetchFunction,
    dependencies = [],
    enableAutoRefetch = true,
    cacheToMemory = true
}: OptimizedDataHookOptions): OptimizedDataHookResult {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const eventsContext = useEvents();
    const isInitialMount = useRef(true);
    const lastFetchStrategy = useRef<string>('');

    /**
     * Fetch data using the optimized strategy
     */
    const fetchData = useCallback(async (forceFromDb = false) => {
        try {
            setLoading(true);
            setError(null);

            // Determine fetch strategy
            const strategy = forceFromDb ?
                { shouldFetch: true, reason: 'forced', cacheStrategy: 'database' as const } :
                await shouldFetchData(screen, isInitialMount.current);

            authDebug.debug(`OptimizedDataFetch[${screen}]: Strategy - ${strategy.cacheStrategy} (${strategy.reason})`);
            lastFetchStrategy.current = `${strategy.cacheStrategy}:${strategy.reason}`;

            let fetchedData: any[] = [];

            switch (strategy.cacheStrategy) {
                case 'memory':
                    // Try to get from memory cache (EventContext screen cache)
                    if (eventsContext?.getScreenEvents) {
                        fetchedData = eventsContext.getScreenEvents(screen);
                        authDebug.debug(`OptimizedDataFetch[${screen}]: Loaded ${fetchedData.length} items from memory cache`);
                    }
                    break;

                case 'storage':
                    // Data will be loaded from storage cache by shouldFetchData
                    // For now, fall through to database fetch as storage is handled internally
                    authDebug.debug(`OptimizedDataFetch[${screen}]: Storage cache handled internally, fetching fresh data`);
                // Fall through to database case

                case 'database':
                    // Fetch fresh data from database
                    authDebug.debug(`OptimizedDataFetch[${screen}]: Fetching from database`);
                    fetchedData = await fetchFunction();

                    // Cache the fresh data
                    if (cacheToMemory && eventsContext?.setScreenEvents) {
                        eventsContext.setScreenEvents(screen, fetchedData);
                        authDebug.debug(`OptimizedDataFetch[${screen}]: Cached ${fetchedData.length} items to memory`);
                    }

                    // Cache to storage for next time
                    await cacheScreenData(screen, fetchedData);
                    break;
            }

            setData(fetchedData || []);
            isInitialMount.current = false;

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error occurred');
            authDebug.error(`OptimizedDataFetch[${screen}]: Error during fetch`, error);
            setError(error);
        } finally {
            setLoading(false);
        }
    }, [screen, fetchFunction, eventsContext, cacheToMemory]);

    /**
     * Record a user action that affects data freshness
     */
    const recordAction = useCallback(async (action: ActionType, reason?: string) => {
        await recordUserAction(action, reason);
        // Auto-refresh if enabled
        if (enableAutoRefetch) {
            setTimeout(() => fetchData(true), 100); // Small delay to ensure database consistency
        }
    }, [enableAutoRefetch, fetchData]);

    /**
     * Manual refresh function
     */
    const refresh = useCallback(async () => {
        await fetchData(true);
    }, [fetchData]);

    // Initial load
    useEffect(() => {
        fetchData();
    }, [fetchData, ...dependencies]);

    // Auto-refetch on screen focus if enabled
    useFocusEffect(
        useCallback(() => {
            if (enableAutoRefetch && !isInitialMount.current) {
                fetchData();
            }
        }, [fetchData, enableAutoRefetch])
    );

    return {
        data,
        loading,
        error,
        refresh,
        recordAction
    };
}

/**
 * Specialized hook for Home screen data
 */
export function useHomeData() {
    const eventsContext = useEvents();

    return useOptimizedDataFetch({
        screen: 'home',
        fetchFunction: async () => {
            // Fetch user's attending events and agenda
            if (!eventsContext?.events) return [];

            // This would integrate with your existing getUserAttendingEvents logic
            // Return events that user is attending or created
            return eventsContext.events;
        },
        enableAutoRefetch: true,
        cacheToMemory: true
    });
}

/**
 * Specialized hook for Feed screen data
 */
export function useFeedData() {
    const eventsContext = useEvents();

    return useOptimizedDataFetch({
        screen: 'feed',
        fetchFunction: async () => {
            // Fetch events from user's friends
            if (!eventsContext?.events) return [];

            // This would integrate with your existing friends events logic
            return eventsContext.events;
        },
        enableAutoRefetch: true,
        cacheToMemory: true
    });
}

/**
 * Specialized hook for Explore screen data
 */
export function useExploreData() {
    const eventsContext = useEvents();

    return useOptimizedDataFetch({
        screen: 'explore',
        fetchFunction: async () => {
            // Fetch all public events, users, and groups
            if (!eventsContext?.events) return [];

            // This would integrate with your existing explore logic
            return eventsContext.events;
        },
        enableAutoRefetch: true,
        cacheToMemory: true
    });
}

/**
 * Hook for profile data with specific refresh conditions
 */
export function useProfileData(userId: string) {
    const [profileData, setProfileData] = useState<{
        profile: any;
        friends: any[];
        groups: any[];
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchProfileData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Check if profile data refresh is needed
            const strategy = await shouldFetchData('profile', false);

            if (!strategy.shouldFetch && profileData) {
                authDebug.debug(`Profile[${userId}]: Using cached data (${strategy.reason})`);
                return;
            }

            authDebug.debug(`Profile[${userId}]: Fetching fresh data (${strategy.reason})`);

            // Import your profile fetching functions
            const { getUserProfile } = await import('../api/user');
            const { getUserFriends } = await import('../api/friendship');
            const { getUserGroups } = await import('../api/group');

            // Fetch profile data
            const [profile, friendIds, groups] = await Promise.all([
                getUserProfile(userId),
                getUserFriends(userId),
                getUserGroups(userId)
            ]);

            // Get friend profiles
            const { getUsersByIds } = await import('../api/user');
            const friends = friendIds.length > 0 ? await getUsersByIds(friendIds) : [];

            const data = { profile, friends, groups };
            setProfileData(data);

            // Cache the data
            await cacheScreenData('profile', [data]);

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load profile data');
            authDebug.error(`Profile[${userId}]: Error during fetch`, error);
            setError(error);
        } finally {
            setLoading(false);
        }
    }, [userId, profileData]);

    /**
     * Record profile-specific actions
     */
    const recordProfileAction = useCallback(async (action: ActionType, reason?: string) => {
        await recordUserAction(action, reason);
        // Profile data changes are specific, so always refresh
        setTimeout(() => fetchProfileData(), 100);
    }, [fetchProfileData]);

    // Initial load and dependency changes
    useEffect(() => {
        if (userId) {
            fetchProfileData();
        }
    }, [userId, fetchProfileData]);

    return {
        data: profileData,
        loading,
        error,
        refresh: fetchProfileData,
        recordAction: recordProfileAction
    };
}

/**
 * Hook to track and record user actions across the app
 */
export function useActionTracker() {
    return useCallback(async (action: ActionType, reason?: string) => {
        await recordUserAction(action, reason);
        authDebug.info(`ActionTracker: Recorded action '${action}'${reason ? ` - ${reason}` : ''}`);
    }, []);
}
