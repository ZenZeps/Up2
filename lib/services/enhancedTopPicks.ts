/**
 * Enhanced Top Picks Algorithm with Location-Based Recommendations
 * 
 * This utility provides personalized event recommendations integrating:
 * 1. Current location proximity
 * 2. Travel destination awareness
 * 3. Friend attendance data
 * 4. Event popularity and engagement
 */

import LocationEventService from '@/lib/services/locationEventService';
import { Event as AppEvent } from '@/lib/types/Events';

export interface EnhancedTopPickEvent extends AppEvent {
    distance?: number; // Distance from user in kilometers
    friendsAttending?: number; // Number of user's friends attending
    totalScore: number; // Composite recommendation score
    recommendationReason: 'location' | 'travel' | 'friends' | 'popularity' | 'mixed';
}

export interface TopPicksConfig {
    userId: string;
    maxDistance?: number; // Maximum distance for local events (km)
    includeTravelEvents?: boolean; // Include events at travel destinations
    friendsWeight?: number; // Weight for friend attendance (0-1)
    locationWeight?: number; // Weight for location proximity (0-1)
    popularityWeight?: number; // Weight for event popularity (0-1)
    limit?: number; // Maximum number of recommendations
}

/**
 * Generate enhanced top picks using location intelligence and travel awareness
 */
export async function generateEnhancedTopPicks(config: TopPicksConfig): Promise<EnhancedTopPickEvent[]> {
    const {
        userId,
        maxDistance = 25,
        includeTravelEvents = true,
        friendsWeight = 0.3,
        locationWeight = 0.4,
        popularityWeight = 0.3,
        limit = 20
    } = config;

    try {
        console.log('🎯 Attempting to get location-based recommendations...');

        // Try to get location-based recommendations from the new service
        const locationEvents = await LocationEventService.getLocationBasedRecommendations(userId, limit);

        if (locationEvents.length === 0) {
            console.log('No location-based events found, using fallback recommendations');
            return generateFallbackRecommendations(userId, limit);
        }

        // Enhance events with additional scoring
        const enhancedEvents = await Promise.all(
            locationEvents.map(async (event): Promise<EnhancedTopPickEvent> => {
                // Calculate enhanced scores
                const locationScore = calculateLocationScore(event);
                const popularityScore = event.popularityScore || calculateBasicPopularity(event);
                const friendsScore = await calculateFriendsScore(event, userId);

                // Weighted total score
                const totalScore =
                    (locationScore * locationWeight) +
                    (popularityScore * popularityWeight) +
                    (friendsScore * friendsWeight);

                // Determine primary recommendation reason
                const recommendationReason = determineRecommendationReason(
                    locationScore, popularityScore, friendsScore, event
                );

                return {
                    ...event,
                    totalScore,
                    recommendationReason,
                    friendsAttending: await getFriendsAttendingCount(event, userId)
                };
            })
        );

        // Sort by total score and return top picks
        const sortedEvents = enhancedEvents
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, limit);

        console.log(`Generated ${sortedEvents.length} enhanced top picks for user ${userId}`);

        return sortedEvents;

    } catch (error) {
        console.warn('Enhanced top picks generation failed, using fallback:', error);
        return generateFallbackRecommendations(userId, limit);
    }
}

/**
 * Calculate location-based score considering distance and travel context
 */
function calculateLocationScore(event: AppEvent): number {
    const distance = event.distanceFromUser;

    if (!distance) {
        // If this is a travel event (no distance calculated for current location)
        return 0.8; // High score for travel destination events
    }

    // Distance-based scoring for local events
    if (distance <= 5) return 1.0;    // Very close
    if (distance <= 10) return 0.9;   // Close
    if (distance <= 25) return 0.7;   // Reasonable distance
    if (distance <= 50) return 0.5;   // Far but accessible
    return 0.2; // Very far
}

/**
 * Calculate basic popularity score from event metrics
 */
function calculateBasicPopularity(event: AppEvent): number {
    const attendeeCount = event.attendeeCount || 0;
    const viewCount = event.viewCount || 0;
    const inviteCount = event.inviteCount || 0;

    // Logarithmic scaling to prevent bias toward huge events
    const attendeeScore = Math.min(Math.log(attendeeCount + 1) / 10, 1.0);
    const engagementScore = viewCount > 0 ? Math.min(Math.log(viewCount + 1) / 15, 1.0) : 0;
    const responseRate = inviteCount > 0 ? Math.min(attendeeCount / inviteCount, 1.0) : 0.5;

    return (attendeeScore * 0.4) + (engagementScore * 0.3) + (responseRate * 0.3);
}

/**
 * Calculate friends attendance score
 */
async function calculateFriendsScore(event: AppEvent, userId: string): Promise<number> {
    try {
        // This would integrate with your friends/social system
        // For now, return a placeholder score
        const friendsCount = await getFriendsAttendingCount(event, userId);

        // Diminishing returns: 1 friend = 0.5, 2 friends = 0.7, 5+ friends = 1.0
        if (friendsCount === 0) return 0;
        if (friendsCount === 1) return 0.5;
        if (friendsCount === 2) return 0.7;
        if (friendsCount >= 5) return 1.0;

        return Math.min(0.3 + (friendsCount * 0.15), 1.0);
    } catch (error) {
        console.warn('Error calculating friends score:', error);
        return 0;
    }
}

/**
 * Get count of user's friends attending an event
 */
async function getFriendsAttendingCount(event: AppEvent, userId: string): Promise<number> {
    try {
        // Placeholder implementation - integrate with your friends/attendees system
        // This would query the junction tables for friends who are attending
        return 0;
    } catch (error) {
        console.warn('Error getting friends attending count:', error);
        return 0;
    }
}

/**
 * Determine the primary reason for recommending this event
 */
function determineRecommendationReason(
    locationScore: number,
    popularityScore: number,
    friendsScore: number,
    event: AppEvent
): EnhancedTopPickEvent['recommendationReason'] {
    const scores = { locationScore, popularityScore, friendsScore };
    const maxScore = Math.max(...Object.values(scores));

    // Travel events get special treatment
    if (!event.distanceFromUser || event.distanceFromUser > 50) {
        return 'travel';
    }

    // If multiple scores are close, it's a mixed recommendation
    const closeScores = Object.values(scores).filter(score => score >= maxScore - 0.1).length;
    if (closeScores > 1) {
        return 'mixed';
    }

    // Single dominant factor
    if (locationScore === maxScore) return 'location';
    if (friendsScore === maxScore) return 'friends';
    if (popularityScore === maxScore) return 'popularity';

    return 'mixed';
}

/**
 * Fallback recommendations when location services fail
 */
async function generateFallbackRecommendations(userId: string, limit: number): Promise<EnhancedTopPickEvent[]> {
    try {
        // This would query your events database directly
        // For now, return empty array - implement based on your database structure
        console.warn('Using fallback recommendations - implement database query');
        return [];
    } catch (error) {
        console.error('Error generating fallback recommendations:', error);
        return [];
    }
}

/**
 * Get travel-aware recommendations for a specific destination
 */
export async function getTravelRecommendations(
    destination: string,
    startDate: string,
    endDate: string,
    userId: string,
    limit: number = 10
): Promise<EnhancedTopPickEvent[]> {
    try {
        const travelEvents = await LocationEventService.getEventsForTravelDestination({
            destination,
            startDate,
            endDate,
            userId
        });

        const enhancedTravelEvents = travelEvents.map((event): EnhancedTopPickEvent => ({
            ...event,
            totalScore: event.popularityScore || 0.5,
            recommendationReason: 'travel' as const,
            friendsAttending: 0 // Could be enhanced with social data
        }));

        return enhancedTravelEvents
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, limit);

    } catch (error) {
        console.error('Error getting travel recommendations:', error);
        return [];
    }
}

export default {
    generateEnhancedTopPicks,
    getTravelRecommendations
};
