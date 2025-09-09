# Top Picks Feature Implementation

## Overview
The Top Picks feature replaces the friends section in the Feed with personalized event recommendations based on intelligent ranking criteria.

## Implementation Summary

### 🎯 **TopPicks Algorithm** (`/lib/utils/topPicks.ts`)
**Location**: `/home/zen/Up2/lib/utils/topPicks.ts`

**Ranking Criteria:**
1. **Proximity** (40% weight) - Distance from user's current location
2. **Friend Attendance** (40% weight) - Number of user's friends attending
3. **Popularity** (20% weight) - Total event attendance with logarithmic scaling

**Key Features:**
- Uses Haversine formula for accurate distance calculations
- Handles location permissions gracefully with fallback algorithm  
- Prevents duplicate API calls with pending status tracking
- Supports both location-based and fallback ranking systems

**Scoring Examples:**
- **Distance**: 1km = 90pts, 5km = 61pts, 10km = 37pts
- **Friends**: 1 friend = 20pts, 3 friends = 60pts, 5 friends = 100pts
- **Popularity**: 10 attendees = 10pts, 100 attendees = 20pts

### 🏆 **TopPicks Component** (`/components/TopPicks.tsx`)
**Location**: `/home/zen/Up2/components/TopPicks.tsx`

**UI Design:**
- Instagram Stories-style horizontal scroll
- Round avatar with gradient background and event emoji
- Event title (2 lines max) and formatted date
- Loading states with skeleton placeholders
- Location permission indicator

**Interaction:**
- Each event is clickable → navigates to event details page
- Passes tracking parameter `from=top-picks` for analytics
- Shows debug metrics in development mode

### 🔧 **Feed Integration** (`/app/(root)/(tabs)/Feed.tsx`)
**Location**: `/home/zen/Up2/app/(root)/(tabs)/Feed.tsx`

**Changes Made:**
1. **Import TopPicks component**
2. **Add state**: `allEventsForTopPicks` to store all events (not just friend events)
3. **Fetch all events**: Modified `fetchFeedData` to populate `allEventsForTopPicks`
4. **Replace friends section**: Replaced friends display with `<TopPicks />` component

**Data Flow:**
```typescript
// Before: Friends section
{friendProfiles.length > 0 && (
  <View style={styles.feedFriendSummary}>
    {/* Friend avatars display */}
  </View>
)}

// After: Top Picks section  
<TopPicks 
  allEvents={allEventsForTopPicks} 
  userFriends={friends} 
  maxPicks={8} 
/>
```

## Location Services Integration

### **Permissions**
- Requests `foregroundPermissions` for location access
- Uses `Location.Accuracy.Balanced` for optimal battery/accuracy balance
- Graceful degradation when location access is denied

### **Coordinate Parsing**
- Extracts lat/lng from event location strings
- Supports formats: `"lat,lng"` or `"Address (lat,lng)"`
- Validates coordinates within realistic ranges (-90°/90° lat, -180°/180° lng)

### **Fallback Strategy**
When location is unavailable:
- **Weights**: Friends 60%, Popularity 40% (no distance component)
- Shows location-off icon in UI
- Updates subtitle text to indicate no location-based ranking

## User Experience

### **Visual Design**
- **Header**: "Top Picks" title with optional location indicator
- **Subtitle**: Contextual description based on location availability
- **Layout**: Horizontal scroll with 8-pixel margins between items
- **Avatar**: 64x64 gradient circles with event emojis
- **Typography**: Clean hierarchy with proper contrast

### **Loading States**
- Shows skeleton placeholders during data fetching
- Prevents layout shift with consistent dimensions
- Graceful handling of empty states (no recommendations)

### **Performance Optimizations**
- Batch processing of attendee data
- Intelligent caching of location permissions
- Prevents duplicate API calls during concurrent requests
- Limit of 8 top picks to avoid UI overcrowding

## Testing Features

### **Debug Mode** (Development only)
When `__DEV__ = true`, shows overlay badges with:
- **Total Score**: Ranking points (e.g., "85pt")
- **Friends**: Number of friends attending (e.g., "3👥")
- **Distance**: Distance in kilometers (e.g., "2.1km")

### **Console Logging**
- Algorithm decision logging with detailed metrics
- API call tracking for performance monitoring
- Cache hit/miss statistics
- Error handling with fallback behavior

## Real-World Scenarios

### **Scenario 1**: User in San Francisco
- **Top Pick**: Concert 2km away, 3 friends attending, 50 total attendees
- **Score**: Distance(73) + Friends(60) + Popularity(17) = **150 points**

### **Scenario 2**: User with location disabled
- **Top Pick**: Workshop, 5 friends attending, 20 total attendees  
- **Score**: Friends(100) + Popularity(13) = **113 points**

### **Scenario 3**: Popular distant event
- **Event**: Festival 50km away, 1 friend attending, 500 total attendees
- **Score**: Distance(1) + Friends(20) + Popularity(27) = **48 points**

## Benefits Over Previous Friends Section

1. **Actionable Information**: Events users can actually attend vs. passive friend list
2. **Personalized**: Uses user's location and social graph for relevance
3. **Interactive**: Direct navigation to event details for immediate action
4. **Intelligent**: Multi-factor algorithm vs. simple friend display
5. **Space Efficient**: Same UI real estate, higher information density

The TopPicks feature transforms the Feed from a passive social display into an active event discovery tool, helping users find relevant events they're most likely to attend.
