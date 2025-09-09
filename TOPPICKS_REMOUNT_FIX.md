# TopPicks Remount Fix

## Problem Identified
The TopPicks component was disappearing on remount because:

1. **Feed Data Loading Pattern**: When the Feed remounts, it initially sets `allEventsForTopPicks` to `[]` (empty array)
2. **Immediate Clear**: TopPicks was immediately clearing its state when receiving empty events
3. **No Persistence**: No caching to show previous picks during data reload
4. **Race Condition**: TopPicks would clear before Feed could reload the events data

## Solution Implemented

### 1. **Smart State Management** 🧠
```typescript
// Don't immediately clear existing picks when events become empty
if (!allEvents || allEvents.length === 0) {
  if (topPicks.length === 0) {
    setIsLoading(false); // Only stop loading if no picks to show
  } else {
    // Keep existing picks during reload
  }
  return;
}
```

### 2. **Simple Caching** 💾
```typescript
// Load from cache on mount
useEffect(() => {
  const cached = await AsyncStorage.getItem('simple_top_picks');
  if (cached) {
    setTopPicks(JSON.parse(cached));
    setIsLoading(false);
  }
}, []);

// Save to cache when generated
await AsyncStorage.setItem('simple_top_picks', JSON.stringify(picks));
```

### 3. **Stale Data Timeout** ⏰
```typescript
// Clear stale picks if no fresh data for 5 seconds
useEffect(() => {
  if (!allEvents || allEvents.length === 0) {
    const timeout = setTimeout(() => {
      if (topPicks.length > 0) {
        setTopPicks([]); // Clear stale data
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }
}, [allEvents, topPicks.length]);
```

### 4. **Improved Render Logic** 🎨
```typescript
// Show loading only if no existing picks
if (isLoading && topPicks.length === 0) {
  return <LoadingPlaceholders />;
}

// Show picks even if loading in background
if (topPicks.length > 0) {
  return <ActualPicks />;
}
```

## Expected Behavior Now

1. **Initial Mount**: Shows cached picks immediately, then updates with fresh data
2. **Remount**: Shows cached picks while Feed reloads data in background
3. **Data Reload**: Keeps showing existing picks during reload
4. **Stale Protection**: Clears old picks if no fresh data for 5 seconds
5. **Smooth UX**: No flashing or empty states during normal usage

## Testing Results Expected

- ✅ TopPicks show immediately on app start (from cache)
- ✅ TopPicks persist during navigation away/back
- ✅ TopPicks persist during app close/reopen (within reasonable time)
- ✅ Fresh data updates picks when available
- ✅ Stale data clears after timeout

The component should now provide a smooth, persistent experience while still updating with fresh data when available.
