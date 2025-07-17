/**
 * Scalability monitoring and analytics for 100k users
 */

interface PerformanceMetrics {
    apiCalls: number;
    cacheHits: number;
    cacheMisses: number;
    averageResponseTime: number;
    errorRate: number;
    activeUsers: number;
}

class ScalabilityMonitor {
    private metrics: PerformanceMetrics = {
        apiCalls: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageResponseTime: 0,
        errorRate: 0,
        activeUsers: 0
    };

    private responseTimes: number[] = [];
    private errors: number = 0;
    private sessionStart: number = Date.now();

    // Track API call performance
    trackApiCall(startTime: number, endTime: number, success: boolean) {
        this.metrics.apiCalls++;
        const responseTime = endTime - startTime;
        this.responseTimes.push(responseTime);

        if (!success) {
            this.errors++;
        }

        this.updateAverageResponseTime();
        this.updateErrorRate();
    }

    // Track cache performance
    trackCacheHit() {
        this.metrics.cacheHits++;
    }

    trackCacheMiss() {
        this.metrics.cacheMisses++;
    }

    // Update calculated metrics
    private updateAverageResponseTime() {
        if (this.responseTimes.length > 0) {
            this.metrics.averageResponseTime =
                this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
        }
    }

    private updateErrorRate() {
        if (this.metrics.apiCalls > 0) {
            this.metrics.errorRate = (this.errors / this.metrics.apiCalls) * 100;
        }
    }

    // Get performance report
    getPerformanceReport() {
        const sessionDuration = Date.now() - this.sessionStart;
        const cacheHitRate = this.metrics.cacheHits + this.metrics.cacheMisses > 0
            ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100
            : 0;

        return {
            ...this.metrics,
            sessionDuration: sessionDuration / 1000 / 60, // minutes
            cacheHitRate,
            apiCallsPerMinute: (this.metrics.apiCalls / (sessionDuration / 1000 / 60)),
        };
    }

    // Reset metrics for new session
    reset() {
        this.metrics = {
            apiCalls: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageResponseTime: 0,
            errorRate: 0,
            activeUsers: 0
        };
        this.responseTimes = [];
        this.errors = 0;
        this.sessionStart = Date.now();
    }

    // Log performance alerts for optimization
    checkPerformanceThresholds() {
        const report = this.getPerformanceReport();

        if (report.averageResponseTime > 3000) { // 3 seconds
            console.warn('⚠️ High API response time detected:', report.averageResponseTime + 'ms');
        }

        if (report.errorRate > 5) { // 5% error rate
            console.warn('⚠️ High error rate detected:', report.errorRate + '%');
        }

        if (report.cacheHitRate < 80) { // Below 80% cache hit rate
            console.warn('⚠️ Low cache hit rate detected:', report.cacheHitRate + '%');
        }

        if (report.apiCallsPerMinute > 30) { // More than 30 API calls per minute
            console.warn('⚠️ High API usage detected:', report.apiCallsPerMinute + ' calls/min');
        }
    }
}

export const scalabilityMonitor = new ScalabilityMonitor();

// Wrapper function to monitor database operations
export const monitoredDbOperation = async <T>(
    operation: () => Promise<T>,
    operationName: string
): Promise<T> => {
    const startTime = Date.now();
    let success = false;

    try {
        const result = await operation();
        success = true;
        return result;
    } catch (error) {
        success = false;
        throw error;
    } finally {
        const endTime = Date.now();
        scalabilityMonitor.trackApiCall(startTime, endTime, success);

        // Log slow operations
        if (endTime - startTime > 2000) {
            console.warn(`🐌 Slow operation detected: ${operationName} took ${endTime - startTime}ms`);
        }
    }
};

// Performance optimization recommendations
export const performanceRecommendations = {
    // Check if caching is optimal
    checkCacheOptimization: () => {
        const report = scalabilityMonitor.getPerformanceReport();
        const recommendations: string[] = [];

        if (report.cacheHitRate < 80) {
            recommendations.push("Consider increasing cache TTL for stable data");
            recommendations.push("Implement cache warming for frequently accessed data");
        }

        if (report.apiCallsPerMinute > 20) {
            recommendations.push("Implement request deduplication");
            recommendations.push("Consider batch processing for multiple requests");
        }

        if (report.averageResponseTime > 2000) {
            recommendations.push("Optimize database queries with proper indexing");
            recommendations.push("Consider implementing pagination for large datasets");
        }

        return recommendations;
    },

    // Database optimization suggestions
    getDatabaseOptimizations: () => [
        "Use Query.limit() for all list operations",
        "Implement proper indexing on frequently queried fields",
        "Use Query.select() to fetch only required fields",
        "Implement connection pooling for concurrent requests",
        "Use batch operations for bulk data processing"
    ],

    // Caching strategy improvements
    getCachingImprovements: () => [
        "Implement multi-level caching (memory + persistent)",
        "Use different TTL values based on data volatility",
        "Implement cache invalidation strategies",
        "Use compression for large cached objects",
        "Implement cache warming on app startup"
    ]
};
