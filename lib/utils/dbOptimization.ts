/**
 * Database optimization utilities for 100k user scalability
 */

import { Query } from '@/lib/appwrite/appwrite';

// Query optimization helpers
export const createOptimizedQuery = {
    // Limit queries for better performance at scale
    events: {
        userEvents: (userId: string, limit = 50) => [
            Query.equal('creatorId', userId),
            Query.orderDesc('$createdAt'),
            Query.limit(limit)
        ],
        friendEvents: (friendIds: string[], limit = 50) => [
            Query.equal('creatorId', friendIds),
            Query.greaterThan('endTime', new Date().toISOString()),
            Query.orderDesc('$createdAt'),
            Query.limit(limit)
        ],
        upcomingEvents: (limit = 100) => [
            Query.greaterThan('startTime', new Date().toISOString()),
            Query.orderAsc('startTime'),
            Query.limit(limit)
        ]
    },

    users: {
        byIds: (userIds: string[], limit = 100) => [
            Query.equal('$id', userIds),
            Query.limit(limit)
        ],
        friends: (userId: string, limit = 200) => [
            Query.contains('friends', userId),
            Query.limit(limit)
        ]
    },

    travel: {
        activeTravelForUsers: (userIds: string[], limit = 50) => [
            Query.equal('userId', userIds),
            Query.greaterThan('endDate', new Date().toISOString()),
            Query.orderDesc('$createdAt'),
            Query.limit(limit)
        ]
    }
};

// Batch processing for large datasets
export const batchProcess = async <T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize = 25 // Optimal batch size for Appwrite
): Promise<R[]> => {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await processor(batch);
        results.push(...batchResults);
    }

    return results;
};

// Connection pooling simulation for better resource management
class ConnectionPool {
    private activeConnections = 0;
    private readonly maxConnections = 10; // Conservative limit for mobile
    private readonly queue: Array<() => void> = [];

    async acquire<T>(operation: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const execute = async () => {
                this.activeConnections++;
                try {
                    const result = await operation();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.activeConnections--;
                    this.processQueue();
                }
            };

            if (this.activeConnections < this.maxConnections) {
                execute();
            } else {
                this.queue.push(execute);
            }
        });
    }

    private processQueue() {
        if (this.queue.length > 0 && this.activeConnections < this.maxConnections) {
            const next = this.queue.shift();
            if (next) next();
        }
    }
}

export const dbConnectionPool = new ConnectionPool();

// Request deduplication to prevent duplicate API calls
class RequestDeduplicator {
    private pendingRequests = new Map<string, Promise<any>>();

    async deduplicate<T>(key: string, operation: () => Promise<T>): Promise<T> {
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key) as Promise<T>;
        }

        const promise = operation().finally(() => {
            this.pendingRequests.delete(key);
        });

        this.pendingRequests.set(key, promise);
        return promise;
    }
}

export const requestDeduplicator = new RequestDeduplicator();

// Cache warming for frequently accessed data
export const cacheWarmingStrategies = {
    // Warm up user profile cache on login
    warmUserProfile: async (userId: string) => {
        // Implementation would go here
        console.log(`Warming cache for user: ${userId}`);
    },

    // Warm up friend events cache
    warmFriendEvents: async (friendIds: string[]) => {
        // Implementation would go here
        console.log(`Warming cache for ${friendIds.length} friends`);
    }
};
