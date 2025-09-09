/**
 * Hook for managing user location and distance calculations
 */

import { calculateEventDistance, formatDistance, getUserLocation, UserLocation } from '@/lib/utils/distanceUtils';
import { useCallback, useEffect, useState } from 'react';

export const useUserLocation = () => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const fetchUserLocation = useCallback(async () => {
    setIsLoadingLocation(true);
    try {
      const location = await getUserLocation();
      setUserLocation(location);
      setLocationPermissionGranted(location !== null);
    } catch (error) {
      console.error('Failed to get user location:', error);
      setLocationPermissionGranted(false);
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);

  useEffect(() => {
    fetchUserLocation();
  }, [fetchUserLocation]);

  const getEventDistance = useCallback((eventLocation: string): { distance: number | null; formattedDistance: string | null } => {
    const distance = calculateEventDistance(userLocation, eventLocation);
    return {
      distance,
      formattedDistance: distance ? formatDistance(distance) : null
    };
  }, [userLocation]);

  return {
    userLocation,
    locationPermissionGranted,
    isLoadingLocation,
    refreshLocation: fetchUserLocation,
    getEventDistance
  };
};
