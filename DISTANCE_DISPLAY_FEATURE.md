# Distance Display Feature

This document describes the implementation of distance display functionality for events in the Feed and Explore pages.

## Overview

Events now display the distance from the user's current location in both the Feed and Explore pages. The distance is calculated using the Haversine formula based on GPS coordinates.

## Implementation Details

### Core Files Created

1. **`/lib/utils/distanceUtils.ts`** - Core distance calculation utilities
   - `calculateDistance()` - Haversine formula implementation
   - `getUserLocation()` - Gets user's current GPS location
   - `extractEventCoordinates()` - Extracts lat/lng from event location strings
   - `formatDistance()` - Formats distances for display (meters/kilometers)
   - `calculateEventDistance()` - Combines user location and event location

2. **`/lib/hooks/useUserLocation.ts`** - React hook for location management
   - `useUserLocation()` - Hook that manages user location state
   - Handles location permissions
   - Provides `getEventDistance()` function for components
   - Automatically refreshes location on mount

### Pages Updated

1. **Feed Page (`/app/(root)/(tabs)/Feed.tsx`)**
   - Added distance display in event cards
   - Distance appears after location with bullet separator
   - Styled in blue color (#4A90E2) to distinguish from other metadata

2. **Explore Page (`/app/(root)/(tabs)/Explore.tsx`)**
   - Added distance display in horizontal event cards
   - Distance appears inline with location text
   - Format: "Location Name • 2.5km"

## Location Format Requirements

For distance calculation to work, event locations must include GPS coordinates in one of these formats:

- `"Latitude,Longitude"` (e.g., "40.7128,-74.0060")
- `"Address (Latitude,Longitude)"` (e.g., "Times Square (40.7589,-73.9851)")
- Any string containing comma-separated decimal coordinates

## Features

1. **Automatic Location Detection**
   - Requests location permissions on first use
   - Uses device GPS for accurate positioning
   - Graceful fallback when location unavailable

2. **Smart Distance Formatting**
   - Distances < 1km: shown in meters (e.g., "500m")
   - Distances 1-10km: shown with 1 decimal place (e.g., "2.5km")
   - Distances > 10km: shown rounded (e.g., "15km")

3. **Performance Optimized**
   - Calculates distances only when needed
   - Caches user location to avoid repeated GPS requests
   - Lightweight calculations with minimal impact

4. **Privacy Conscious**
   - Only requests location when displaying events
   - No location data stored or transmitted
   - Respects system location permissions

## Visual Design

- **Feed**: Distance appears as `• 2.5km` in blue after location info
- **Explore**: Distance appears as `Location • 2.5km` inline with location
- **Color**: Blue (#4A90E2) to distinguish from other metadata
- **Typography**: Same size as other metadata, medium weight for emphasis

## Testing

To test the distance feature:

1. Ensure location services are enabled on your device
2. Grant location permissions to the app
3. Create events with GPS coordinates in the location field
4. View events in Feed or Explore pages
5. Distance should appear next to location information

## Future Enhancements

Potential improvements could include:
- Distance-based filtering in Explore page
- Sort by distance option
- Map view integration
- Radius-based event discovery
- Location caching for offline use
