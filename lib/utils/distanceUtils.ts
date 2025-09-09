/**
 * Distance calculation utilities for displaying event distances
 */

import * as Location from 'expo-location';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Get user's current location
 */
export const getUserLocation = async (): Promise<UserLocation | null> => {
  try {
    // Request location permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted');
      return null;
    }

    // Get current location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.warn('Failed to get user location:', error);
    return null;
  }
};

/**
 * Extract latitude and longitude from event location string
 * Supports various formats like "lat,lng" or "address (lat,lng)"
 */
export const extractEventCoordinates = (location: string): { lat: number; lng: number } | null => {
  if (!location) return null;

  // Look for coordinates in various formats
  const coordRegex = /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/;
  const match = location.match(coordRegex);
  
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    // Basic validation for realistic coordinates
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  
  return null;
};

/**
 * Format distance for display
 */
export const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  } else if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)}km`;
  } else {
    return `${Math.round(distanceKm)}km`;
  }
};

/**
 * Calculate distance between user location and event location
 */
export const calculateEventDistance = (
  userLocation: UserLocation | null,
  eventLocation: string
): number | null => {
  if (!userLocation || !eventLocation) {
    return null;
  }

  const eventCoords = extractEventCoordinates(eventLocation);
  if (!eventCoords) {
    return null;
  }

  return calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    eventCoords.lat,
    eventCoords.lng
  );
};
