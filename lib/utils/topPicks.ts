/**
 * Top Picks Algorithm for Feed
 * 
 * This utility calculates personalized event recommendations based on:
 * 1. Proximity to user's current location
 * 2. Number of user's friends attending
 * 3. Event popularity score
 */

import { getEventAttendeesFor, isUserAttendingEvent } from '@/lib/api/event';
import { Event as AppEvent } from '@/lib/types/Events';
import { getCurrentUserLocation } from './locationUtils';

export interface TopPickEvent extends AppEvent {
  distance: number; // in kilometers
  friendsAttending: number;
  popularityScore: number;
  totalScore: number;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
const calculateDistance = (
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
    // Use the enhanced location utilities for better UX
    const location = await getCurrentUserLocation('toppicks');
    return location;
  } catch (error) {
    console.warn('Failed to get user location for TopPicks:', error);
    return null;
  }
};

/**
 * Extract latitude and longitude from event location string
 * Supports various formats like "lat,lng" or "address (lat,lng)"
 */
const extractEventCoordinates = (location: string): { lat: number; lng: number } | null => {
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
 * Calculate popularity score based on attendee count
 * Uses a logarithmic scale to avoid bias toward very large events
 */
const calculatePopularityScore = (attendeeCount: number): number => {
  if (attendeeCount <= 0) return 0;

  // Logarithmic scoring: log10(attendees + 1) * 10
  // Examples: 1 attendee = 3 points, 10 attendees = 10 points, 100 attendees = 20 points
  return Math.log10(attendeeCount + 1) * 10;
};

/**
 * Calculate distance score (inverse of distance)
 * Closer events get higher scores
 */
const calculateDistanceScore = (distance: number): number => {
  if (distance <= 0) return 100; // Same location gets max score

  // Inverse exponential decay: 100 * e^(-distance/10)
  // Examples: 1km = 90 points, 5km = 61 points, 10km = 37 points, 20km = 14 points
  return 100 * Math.exp(-distance / 10);
};

/**
 * Calculate friend attendance score
 * More friends attending = higher score
 */
const calculateFriendScore = (friendsAttending: number): number => {
  // Linear scoring: friends * 20, capped at 100
  return Math.min(friendsAttending * 20, 100);
};

/**
 * Generate top picks for a user based on all available events
 */
export const generateTopPicks = async (
  allEvents: AppEvent[],
  userFriends: string[],
  userLocation: UserLocation | null,
  limit: number = 10,
  currentUserId?: string
): Promise<TopPickEvent[]> => {
  console.log('🎯 Generating top picks for user...', {
    totalEvents: allEvents.length,
    friendsCount: userFriends.length,
    hasLocation: Boolean(userLocation),
    currentUserId: currentUserId || 'not provided',
    limit
  });

  if (!userLocation) {
    console.warn('No user location available, using fallback ranking');
  }

  // Filter to future events only
  const futureEvents = allEvents.filter(event => {
    const eventTime = new Date(event.endTime || event.startTime);
    return eventTime > new Date();
  });

  console.log('📅 Filtered to future events:', futureEvents.length);

  // Filter out events the user is already attending if currentUserId is provided
  let availableEvents = futureEvents;
  if (currentUserId) {
    // For performance, we'll check attendance using the junction table for the filtered events
    const attendancePromises = futureEvents.map(async (event) => {
      try {
        const isAttending = await isUserAttendingEvent(currentUserId, event.$id);
        return { event, isAttending };
      } catch (error) {
        // If there's an error checking attendance, include the event to be safe
        console.warn('Error checking attendance for event', event.$id, error);
        return { event, isAttending: false };
      }
    });

    const attendanceResults = await Promise.all(attendancePromises);
    availableEvents = attendanceResults
      .filter(result => !result.isAttending)
      .map(result => result.event);

    console.log('🚫 Filtered out attending events:', {
      futureEvents: futureEvents.length,
      availableEvents: availableEvents.length,
      excludedEvents: futureEvents.length - availableEvents.length
    });
  }

  // Get event attendees in batch for the available events
  const eventIds = availableEvents.map(event => event.$id);
  const attendeesMap = await getEventAttendeesFor(eventIds);

  // Process each event to calculate scores
  const topPickCandidates: TopPickEvent[] = await Promise.all(
    availableEvents.map(async (event): Promise<TopPickEvent> => {
      // Extract coordinates from event location
      const eventCoords = extractEventCoordinates(event.location || '');

      // Calculate distance score
      let distance = 0;
      let distanceScore = 0;

      if (userLocation && eventCoords) {
        distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          eventCoords.lat,
          eventCoords.lng
        );
        distanceScore = calculateDistanceScore(distance);
      } else if (!userLocation) {
        // If no user location, give neutral distance score
        distanceScore = 25; // Neutral score
      }

      // Get event attendees
      const attendeeIds = attendeesMap[event.$id] || [];

      // Calculate friend attendance
      const friendsAttending = attendeeIds.filter((id: string) => userFriends.includes(id)).length;
      const friendScore = calculateFriendScore(friendsAttending);

      // Calculate popularity score
      const totalAttendees = attendeeIds.length;
      const popularityScore = calculatePopularityScore(totalAttendees);

      // Calculate weighted total score
      // Weights: Distance 40%, Friends 40%, Popularity 20%
      const totalScore = (distanceScore * 0.4) + (friendScore * 0.4) + (popularityScore * 0.2);

      return {
        ...event,
        distance,
        friendsAttending,
        popularityScore,
        totalScore,
      };
    })
  );

  // Sort by total score (highest first) and return top picks
  const topPicks = topPickCandidates
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit);

  console.log('🏆 Generated top picks:', {
    totalCandidates: topPickCandidates.length,
    topPicksCount: topPicks.length,
    topScores: topPicks.slice(0, 3).map(pick => ({
      title: pick.title,
      score: pick.totalScore.toFixed(1),
      distance: pick.distance.toFixed(1) + 'km',
      friends: pick.friendsAttending,
      popularity: pick.popularityScore.toFixed(1)
    }))
  });

  return topPicks;
};

/**
 * Generate fallback top picks when location is not available
 * Uses only friend attendance and popularity
 */
export const generateFallbackTopPicks = async (
  allEvents: AppEvent[],
  userFriends: string[],
  limit: number = 10,
  currentUserId?: string
): Promise<TopPickEvent[]> => {
  console.log('🎯 Generating fallback top picks (no location)...', {
    totalEvents: allEvents.length,
    friendsCount: userFriends.length,
    currentUserId: currentUserId || 'not provided',
    limit
  });

  // Filter to future events only
  const futureEvents = allEvents.filter(event => {
    const eventTime = new Date(event.endTime || event.startTime);
    return eventTime > new Date();
  });

  // Filter out events the user is already attending if currentUserId is provided
  let availableEvents = futureEvents;
  if (currentUserId) {
    const attendancePromises = futureEvents.map(async (event) => {
      try {
        const isAttending = await isUserAttendingEvent(currentUserId, event.$id);
        return { event, isAttending };
      } catch (error) {
        console.warn('Error checking attendance for event', event.$id, error);
        return { event, isAttending: false };
      }
    });

    const attendanceResults = await Promise.all(attendancePromises);
    availableEvents = attendanceResults
      .filter(result => !result.isAttending)
      .map(result => result.event);

    console.log('🚫 Filtered out attending events (fallback):', {
      futureEvents: futureEvents.length,
      availableEvents: availableEvents.length,
      excludedEvents: futureEvents.length - availableEvents.length
    });
  }

  // Get event attendees in batch for available events
  const eventIds = availableEvents.map(event => event.$id);
  const attendeesMap = await getEventAttendeesFor(eventIds);

  // Process each event to calculate scores (no distance component)
  const topPickCandidates: TopPickEvent[] = await Promise.all(
    availableEvents.map(async (event): Promise<TopPickEvent> => {
      const attendeeIds = attendeesMap[event.$id] || [];

      // Calculate friend attendance
      const friendsAttending = attendeeIds.filter((id: string) => userFriends.includes(id)).length;
      const friendScore = calculateFriendScore(friendsAttending);

      // Calculate popularity score
      const totalAttendees = attendeeIds.length;
      const popularityScore = calculatePopularityScore(totalAttendees);

      // Calculate total score without distance component
      // Weights: Friends 60%, Popularity 40%
      const totalScore = (friendScore * 0.6) + (popularityScore * 0.4);

      return {
        ...event,
        distance: 0, // No distance calculation
        friendsAttending,
        popularityScore,
        totalScore,
      };
    })
  );

  // Sort by total score (highest first) and return top picks
  return topPickCandidates
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit);
};
