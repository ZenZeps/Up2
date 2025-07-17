# Database Optimization Documentation

## Overview

This document outlines the optimizations implemented to reduce database reads in the Appwrite backend for the Up2 application.

## Key Components

### 1. Cache Manager (`cacheManager.ts`)
- Implements TTL (time-to-live) based caching
- Provides memory-efficient storage with automatic cleanup
- Supports pattern-based cache invalidation
- Maintains hit/miss statistics for performance monitoring

### 2. Database Usage Monitor (`dbUsageMonitor.ts`)
- Tracks API call frequency
- Provides alerts when approaching usage limits
- Resets counters daily
- Integrates with the debug dashboard

### 3. Enhanced useAppwrite Hook (`useAppwrite.ts`)
- Implements request debouncing to prevent rapid-fire requests
- Uses memoization to prevent unnecessary re-renders
- Provides intelligent caching with configurable TTL
- Includes request deduplication to prevent redundant calls
- Tracks dependencies properly to avoid unnecessary refetches
- Implements rate limiting to prevent API abuse

### 4. Optimized API Functions
- Event and User APIs implement batch fetching
- Cache individual items and collections
- Use proper cache invalidation strategies
- Implement optimistic UI updates with fallbacks

### 5. Debug Dashboard (`DebugDashboard.tsx`)
- Displays real-time database usage metrics
- Shows cache hit/miss statistics
- Visualizes usage as percentage of limits
- Provides optimization tips

## Usage Patterns

### Basic Data Fetching
```typescript
const { data: events, loading, error } = useAppwrite({
  fn: fetchEvents,
  cacheKey: 'all-events',
  cacheTTL: 5 * 60 * 1000, // 5 minutes
});
```

### With Custom Parameters
```typescript
const { data: userEvents, loading, error } = useAppwrite({
  fn: fetchUserEvents,
  params: { userId: currentUser.$id },
  cacheKey: `user-events-${currentUser.$id}`,
  dependencies: [currentUser.$id], // Refetch when user changes
});
```

### With Debouncing (for search queries)
```typescript
const { data: searchResults, loading } = useAppwrite({
  fn: searchEvents,
  params: { query: searchTerm },
  debounce: 300, // Wait 300ms after typing stops
  disableCache: true, // Don't cache search results
});
```

## Best Practices

1. **Use Appropriate Cache TTL**
   - Short-lived for frequently changing data (1-5 minutes)
   - Longer for relatively static data (10-30 minutes)

2. **Implement Proper Cache Invalidation**
   - Invalidate on data mutations
   - Use patterns to invalidate related caches

3. **Batch Related Queries**
   - Use `getUsersByIds` instead of multiple `getUserProfile` calls
   - Fetch related data in a single query when possible

4. **Monitor Database Usage**
   - Keep an eye on the Debug Dashboard
   - Optimize high-frequency calls

5. **Use Optimistic Updates**
   - Update UI immediately before API call completes
   - Fall back to refetching on errors

## Monitoring and Troubleshooting

The Debug Dashboard provides real-time metrics for:
- Total database reads
- Cache hit rate
- Daily usage percentage
- Optimization tips

## Future Improvements

1. Implement server-side pagination for large collections
2. Add background prefetching for frequently accessed data
3. Implement offline support with persistent caching
4. Add automated cache warming for critical data
5. Implement query batching for related data fetches
