/**
 * Cache Manager for Appwrite data
 * This utility helps reduce database reads by caching frequently accessed data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { authDebug } from "./authDebug";

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

// The storage key for persisting cache data
const STORAGE_KEY_PREFIX = '@AppCache:';
const STORAGE_STATS_KEY = '@AppCache:stats';

class CacheManager {
    private cache = new Map<string, CacheEntry<any>>();
    private hitCount = 0;
    private missCount = 0;
    private requestCount = 0;
    private isLoaded = false;

    constructor() {
        // Load cache and stats from persistent storage
        this.loadFromStorage().catch(err => {
            authDebug.error('Failed to load cache from storage:', err);
        });
    }

    /**
     * Get an item from the cache
     * @param key Cache key
     * @returns Cached data or null if not found/expired
     */
    get<T>(key: string): T | null {
        this.requestCount++;
        const entry = this.cache.get(key);

        // Check if entry exists and is still valid
        if (entry && Date.now() - entry.timestamp < entry.ttl) {
            this.hitCount++;
            authDebug.debug(`Cache hit: ${key}`);
            return entry.data;
        }

        // If expired, remove it
        if (entry) {
            this.cache.delete(key);
            authDebug.debug(`Cache expired: ${key}`);
        }

        this.missCount++;
        return null;
    }

    /**
     * Set an item in the cache
     * @param key Cache key
     * @param data Data to cache
     * @param ttl Time to live in milliseconds (default 5 minutes)
     */
    set<T>(key: string, data: T, ttl = 5 * 60 * 1000): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
        authDebug.debug(`Cache set: ${key}`);
    }

    /**
     * Remove an item from the cache
     * @param key Cache key
     */
    remove(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Check if key exists in cache and is valid
     * @param key Cache key
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        return !!entry && Date.now() - entry.timestamp < entry.ttl;
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
        authDebug.debug('Cache cleared');
    }

    /**
     * Clear cache entries that match a pattern
     * @param pattern RegExp pattern to match keys
     */
    clearPattern(pattern: RegExp): void {
        for (const key of this.cache.keys()) {
            if (pattern.test(key)) {
                this.cache.delete(key);
                authDebug.debug(`Cache cleared for pattern match: ${key}`);
            }
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            hitRate: this.requestCount ? (this.hitCount / this.requestCount) * 100 : 0,
            missRate: this.requestCount ? (this.missCount / this.requestCount) * 100 : 0,
            hitCount: this.hitCount,
            missCount: this.missCount,
            requestCount: this.requestCount
        };
    }

    /**
     * Load cache data from AsyncStorage
     */
    private async loadFromStorage(): Promise<void> {
        try {
            // Load cache statistics
            const statsData = await AsyncStorage.getItem(STORAGE_STATS_KEY);
            if (statsData) {
                const stats = JSON.parse(statsData);
                this.hitCount = stats.hitCount || 0;
                this.missCount = stats.missCount || 0;
                this.requestCount = stats.requestCount || 0;
            }

            // Get all cache keys
            const allKeys = await AsyncStorage.getAllKeys();
            const cacheKeys = allKeys.filter(key => key.startsWith(STORAGE_KEY_PREFIX));

            if (cacheKeys.length > 0) {
                // Load cache entries in batches
                const cacheValues = await AsyncStorage.multiGet(cacheKeys);

                for (const [key, value] of cacheValues) {
                    if (value) {
                        try {
                            const cacheKey = key.replace(STORAGE_KEY_PREFIX, '');
                            const entry = JSON.parse(value) as CacheEntry<any>;

                            // Only restore if not expired
                            if (Date.now() - entry.timestamp < entry.ttl) {
                                this.cache.set(cacheKey, entry);
                            }
                        } catch (e) {
                            authDebug.error(`Error parsing cache entry: ${key}`, e);
                            // Remove invalid entry
                            AsyncStorage.removeItem(key).catch(() => { });
                        }
                    }
                }
            }

            this.isLoaded = true;
            authDebug.debug(`Cache loaded from storage: ${this.cache.size} valid entries`);
        } catch (e) {
            authDebug.error('Error loading cache from storage:', e);
        }
    }

    /**
     * Save cache statistics to AsyncStorage
     */
    private async saveStats(): Promise<void> {
        try {
            const stats = {
                hitCount: this.hitCount,
                missCount: this.missCount,
                requestCount: this.requestCount
            };

            await AsyncStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(stats));
        } catch (e) {
            authDebug.error('Error saving cache stats:', e);
        }
    }

    /**
     * Save a cache entry to AsyncStorage
     */
    private async persistEntry(key: string, entry: CacheEntry<any>): Promise<void> {
        try {
            await AsyncStorage.setItem(
                STORAGE_KEY_PREFIX + key,
                JSON.stringify(entry)
            );
        } catch (e) {
            authDebug.error(`Error persisting cache entry: ${key}`, e);
        }
    }

    /**
     * Remove a cache entry from AsyncStorage
     */
    private async removePersistentEntry(key: string): Promise<void> {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY_PREFIX + key);
        } catch (e) {
            authDebug.error(`Error removing persistent cache entry: ${key}`, e);
        }
    }
}

export const cacheManager = new CacheManager();
