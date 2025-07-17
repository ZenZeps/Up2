/**
 * Database Usage Monitor
 * 
 * This utility tracks Appwrite database usage and displays warnings when limits are approached
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { authDebug } from "./authDebug";
import { cacheManager } from "./cacheManager";

// Constants for usage monitoring
const DAILY_READ_LIMIT = 1000; // Set a reasonable daily read limit for development
const WARNING_THRESHOLD = 0.7; // Warn at 70% of limit

// Store for daily usage
interface UsageStats {
    reads: number;
    writes: number;
    lastReset: number; // Timestamp of last daily reset
}

class DatabaseUsageMonitor {
    private stats: UsageStats = {
        reads: 0,
        writes: 0,
        lastReset: Date.now()
    };

    constructor() {
        // Initialize with default stats
        // Then try to load saved stats from AsyncStorage
        this.loadStats().then(() => {
            // Reset daily counters if needed after loading
            this.checkDailyReset();
        });
    }

    /**
     * Record a database read operation
     * @param source Source of the read (for logging)
     */
    recordRead(source: string): void {
        this.checkDailyReset();
        this.stats.reads++;

        // Save stats in the background without awaiting
        this.saveStats().catch(err => {
            // Already logged in saveStats
        });

        if (this.stats.reads === 1 || this.stats.reads % 10 === 0) {
            authDebug.debug(`DB Read [${source}]: Total daily reads: ${this.stats.reads}`);
        }

        // Check if approaching limit
        if (this.stats.reads > DAILY_READ_LIMIT * WARNING_THRESHOLD) {
            const percentUsed = (this.stats.reads / DAILY_READ_LIMIT) * 100;
            authDebug.warn(`High database usage: ${percentUsed.toFixed(1)}% of daily read limit`);

            if (percentUsed > 90) {
                // Force cache all requests at >90% usage
                authDebug.warn('Critical database usage! Forcing maximum caching');
            }
        }
    }

    /**
     * Record a database write operation
     * @param source Source of the write (for logging)
     */
    recordWrite(source: string): void {
        this.checkDailyReset();
        this.stats.writes++;

        // Save stats in the background without awaiting
        this.saveStats().catch(err => {
            // Already logged in saveStats
        });

        if (this.stats.writes === 1 || this.stats.writes % 10 === 0) {
            authDebug.debug(`DB Write [${source}]: Total daily writes: ${this.stats.writes}`);
        }
    }

    /**
     * Get current usage statistics
     */
    getUsageStats(): UsageStats & { readPercentage: number } {
        this.checkDailyReset();
        return {
            ...this.stats,
            readPercentage: (this.stats.reads / DAILY_READ_LIMIT) * 100
        };
    }

    /**
     * Reset all usage counters
     */
    resetCounters(): void {
        this.stats = {
            reads: 0,
            writes: 0,
            lastReset: Date.now()
        };

        // Save stats in the background
        this.saveStats().catch(err => {
            // Already logged in saveStats
        });

        authDebug.info('Database usage counters reset');

        // Also clear caches
        cacheManager.clear();
    }

    /**
     * Check if we need to reset daily counters
     */
    private checkDailyReset(): void {
        const now = Date.now();
        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);

        if (this.stats.lastReset < midnight.getTime()) {
            // It's a new day, reset counters
            const previousReads = this.stats.reads;
            const previousWrites = this.stats.writes;

            this.stats = {
                reads: 0,
                writes: 0,
                lastReset: now
            };

            authDebug.info('Daily database usage counters reset', {
                previousDay: {
                    reads: previousReads,
                    writes: previousWrites
                }
            });

            // Save stats in the background
            this.saveStats().catch(err => {
                // Already logged in saveStats
            });
        }
    }

    /**
     * Save stats to AsyncStorage
     */
    private async saveStats(): Promise<void> {
        try {
            await AsyncStorage.setItem('dbUsageStats', JSON.stringify(this.stats));
        } catch (err) {
            authDebug.error('Error saving stats to AsyncStorage:', err);
            // Continue execution even if storage fails
        }
    }

    /**
     * Load stats from AsyncStorage
     */
    private async loadStats(): Promise<void> {
        try {
            const saved = await AsyncStorage.getItem('dbUsageStats');
            if (saved) {
                this.stats = JSON.parse(saved);
            }
        } catch (err) {
            authDebug.error('Error loading stats from AsyncStorage:', err);
            // Continue with default stats if loading fails
        }
    }
}

export const dbUsageMonitor = new DatabaseUsageMonitor();

/**
 * Decorator factory to monitor database function calls
 */
export function monitorDbOperation(type: 'read' | 'write') {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            // Record the operation
            if (type === 'read') {
                dbUsageMonitor.recordRead(propertyKey);
            } else {
                dbUsageMonitor.recordWrite(propertyKey);
            }

            // Call the original method
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}
