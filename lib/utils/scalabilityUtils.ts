/**
 * SCALABILITY UTILITIES - Pagination and Caching Helpers
 * =====================================================
 * 
 * Reusable utilities to maintain scalability across the app.
 * These ensure consistent performance patterns for 100k-1M users.
 */

// Generic pagination interface
export interface PaginationParams {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
    data: T[];
    totalCount: number;
    hasMore: boolean;
    nextOffset?: number;
}

// Default pagination settings optimized for performance
export const PAGINATION_DEFAULTS = {
    USER_DISCOVERY: { limit: 50, maxLimit: 200 },
    MESSAGES: { limit: 30, maxLimit: 100 },
    EVENTS: { limit: 20, maxLimit: 100 },
    GROUPS: { limit: 25, maxLimit: 100 },
    NOTIFICATIONS: { limit: 50, maxLimit: 200 },
} as const;

// Cache TTL values optimized for different data types
export const CACHE_TTL = {
    USER_PROFILE: 10 * 60 * 1000, // 10 minutes - changes infrequently
    MESSAGE_AUTHORS: 5 * 60 * 1000, // 5 minutes - moderate updates
    GROUP_MEMBERS: 15 * 60 * 1000, // 15 minutes - changes less often
    EVENT_ATTENDEES: 5 * 60 * 1000, // 5 minutes - more dynamic
    SEARCH_RESULTS: 2 * 60 * 1000, // 2 minutes - needs freshness
} as const;

// Batch processing limits to prevent API overload
export const BATCH_LIMITS = {
    USER_PROFILES: 10, // Process 10 user profiles at once
    PHOTO_UPLOADS: 5, // Process 5 photos simultaneously  
    NOTIFICATIONS: 50, // Send notifications to 50 users at once
    DATABASE_WRITES: 20, // Batch database operations
} as const;

/**
 * Utility to create standardized pagination queries
 */
export const createPaginationQuery = (params: PaginationParams) => {
    const { limit = 20, offset = 0, orderBy = '$createdAt', orderDirection = 'desc' } = params;

    // Safety limits to prevent abuse
    const safeLimit = Math.min(Math.max(1, limit), 500);
    const safeOffset = Math.max(0, offset);

    return {
        limit: safeLimit,
        offset: safeOffset,
        orderBy,
        orderDirection,
    };
};

/**
 * Utility to process arrays in batches for controlled API usage
 */
export const processBatch = async <T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> => {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        try {
            const batchResults = await processor(batch);
            results.push(...batchResults);
        } catch (error) {
            console.warn(`Batch processing failed for items ${i}-${i + batch.length}:`, error);
            // Continue with other batches even if one fails
        }
    }

    return results;
};

/**
 * Memory cache implementation with TTL support
 */
class MemoryCache<T> {
    private cache = new Map<string, { data: T; timestamp: number; ttl: number }>();

    set(key: string, data: T, ttl: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });

        // Cleanup old entries periodically
        if (this.cache.size > 1000) { // Prevent memory leaks
            this.cleanup();
        }
    }

    get(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    has(key: string): boolean {
        return this.get(key) !== null;
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
            }
        }
    }

    getStats() {
        const now = Date.now();
        let valid = 0;
        let expired = 0;

        for (const entry of this.cache.values()) {
            if (now - entry.timestamp <= entry.ttl) {
                valid++;
            } else {
                expired++;
            }
        }

        return { total: this.cache.size, valid, expired };
    }
}

// Shared cache instances for common use cases
export const profileCache = new MemoryCache<any>();
export const messageAuthorCache = new MemoryCache<any>();
export const groupMemberCache = new MemoryCache<any>();

/**
 * Rate limiter to prevent API abuse
 */
class RateLimiter {
    private requests = new Map<string, number[]>();

    canMakeRequest(key: string, maxRequests: number, timeWindow: number): boolean {
        const now = Date.now();
        const requests = this.requests.get(key) || [];

        // Remove old requests outside the time window
        const validRequests = requests.filter(time => now - time < timeWindow);

        if (validRequests.length >= maxRequests) {
            return false;
        }

        validRequests.push(now);
        this.requests.set(key, validRequests);
        return true;
    }
}

export const rateLimiter = new RateLimiter();

/**
 * Performance monitoring utilities
 */
export const performanceMonitor = {
    startTimer: (operation: string) => {
        const start = Date.now();
        return {
            end: () => {
                const duration = Date.now() - start;
                console.log(`⏱️ ${operation}: ${duration}ms`);
                return duration;
            }
        };
    },

    logCacheStats: (cacheName: string, cache: MemoryCache<any>) => {
        const stats = cache.getStats();
        console.log(`📊 ${cacheName} cache: ${stats.valid}/${stats.total} valid entries`);
    },

    logBatchOperation: (operation: string, totalItems: number, batchSize: number, duration: number) => {
        const batches = Math.ceil(totalItems / batchSize);
        console.log(`🔄 ${operation}: ${totalItems} items in ${batches} batches (${duration}ms)`);
    }
};

export default {
    PAGINATION_DEFAULTS,
    CACHE_TTL,
    BATCH_LIMITS,
    createPaginationQuery,
    processBatch,
    profileCache,
    messageAuthorCache,
    groupMemberCache,
    rateLimiter,
    performanceMonitor,
};
