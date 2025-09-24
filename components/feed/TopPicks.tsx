/**
 * TopPicks Component
 * 
 * Displays personalized event recommendations in a horizontal scrollable row
 * Using the original working algorithm with enhanced fallback support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import EventImage from '@/components/EventImage';
import { getEventEmoji } from '@/constants/categories';
import { useTheme } from '@/lib/context/ThemeContext';
import { Event as AppEvent } from '@/lib/types/Events';
import { TopPickEvent, generateFallbackTopPicks, generateTopPicks as generateTopPicksAlgorithm, getUserLocation } from '@/lib/utils/topPicks';

interface TopPicksProps {
  allEvents: AppEvent[];
  userFriends: string[];
  currentUserId?: string;
  maxPicks?: number;
}

const TopPicks: React.FC<TopPicksProps> = ({
  allEvents,
  userFriends,
  currentUserId,
  maxPicks = 8
}) => {
  const { colors } = useTheme();
  const [topPicks, setTopPicks] = useState<TopPickEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recommendationSource, setRecommendationSource] = useState<'location' | 'fallback' | null>(null);

  console.log('🎯 TopPicks: Render', {
    allEventsCount: allEvents?.length || 0,
    userFriendsCount: userFriends?.length || 0,
    currentUserId,
    maxPicks
  });

  // Load from cache initially
  useEffect(() => {
    // Early return if no current user - but inside useEffect to maintain hook order
    if (!currentUserId) {
      console.log('🎯 TopPicks: No current user, skipping cache load');
      return;
    }

    const loadFromCache = async () => {
      try {
        const cached = await AsyncStorage.getItem('simple_top_picks');
        if (cached) {
          const cachedPicks = JSON.parse(cached);
          if (cachedPicks && Array.isArray(cachedPicks) && cachedPicks.length > 0) {
            console.log('🎯 TopPicks: Loaded', cachedPicks.length, 'picks from cache');
            setTopPicks(cachedPicks);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.warn('TopPicks: Failed to load from cache:', error);
      }
    };

    loadFromCache();
  }, []);

  // Generate TopPicks when data changes
  useEffect(() => {
    // Early return if no current user
    if (!currentUserId) {
      console.log('🎯 TopPicks: No current user, skipping generation');
      setIsLoading(false);
      setTopPicks([]);
      return;
    }

    const generateTopPicks = async () => {
      console.log('🎯 TopPicks: Starting generation...', {
        allEventsCount: allEvents?.length || 0,
        hasEvents: Boolean(allEvents && allEvents.length > 0)
      });

      // If we have no events, only clear if we're not currently showing picks
      if (!allEvents || allEvents.length === 0) {
        console.log('🎯 TopPicks: No events available');
        setTopPicks(currentPicks => {
          if (currentPicks.length === 0) {
            console.log('🎯 TopPicks: No existing picks, setting loading false');
            setIsLoading(false);
            return currentPicks;
          } else {
            console.log('🎯 TopPicks: Keeping existing picks during reload');
            return currentPicks;
          }
        });
        return;
      }

      setIsLoading(true);

      try {
        console.log('🎯 TopPicks: Generating with', allEvents.length, 'events');

        // Get user location (with fallback)
        const userLocation = await getUserLocation();

        let picks: TopPickEvent[];
        if (userLocation) {
          console.log('📍 Using location-based algorithm');
          picks = await generateTopPicksAlgorithm(allEvents, userFriends || [], userLocation, maxPicks, currentUserId);
          setRecommendationSource('location');
        } else {
          console.log('🔄 Using fallback algorithm');
          picks = await generateFallbackTopPicks(allEvents, userFriends || [], maxPicks, currentUserId);
          setRecommendationSource('fallback');
        }

        console.log('✅ Generated', picks.length, 'top picks');
        setTopPicks(picks);

        // Simple cache save
        try {
          await AsyncStorage.setItem('simple_top_picks', JSON.stringify(picks));
          console.log('💾 TopPicks: Cached', picks.length, 'picks');
        } catch (error) {
          console.warn('TopPicks: Failed to cache picks:', error);
        }

      } catch (error) {
        console.error('❌ TopPicks generation failed:', error);
        // Use functional update to avoid circular dependency
        setTopPicks(currentPicks => {
          if (currentPicks.length === 0) {
            return [];
          }
          return currentPicks; // Keep existing picks on error
        });
      } finally {
        setIsLoading(false);
      }
    };

    generateTopPicks();
  }, [allEvents, userFriends, currentUserId, maxPicks]);

  // Handle event press
  const handleEventPress = (eventId: string) => {
    router.push(`/event/${eventId}?from=top-picks` as any);
  };

  // Get recommendation reason icon (if available on event)
  const getRecommendationIcon = (reason: any) => {
    switch (reason) {
      case 'location': return '📍';
      case 'travel': return '✈️';
      case 'friends': return '👥';
      case 'popularity': return '⭐';
      case 'mixed': return '🎯';
      default: return null;
    }
  };

  // Show loading state only if we have no picks to display
  if (isLoading && topPicks.length === 0) {
    console.log('🎯 TopPicks: Showing loading placeholders');
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Top Picks</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={`placeholder-${index}`} style={styles.pickItem}>
              <LinearGradient
                colors={[colors.primary + '30', colors.primary + '10']}
                style={styles.pickCircle}
              >
                <Text style={styles.placeholderEmoji}>✨</Text>
              </LinearGradient>
              <Text style={[styles.pickName, { color: colors.textSecondary }]}>Loading...</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Don't render if no current user
  if (!currentUserId) {
    console.log('🎯 TopPicks: No current user, not rendering');
    return null;
  }

  // Don't render if no picks available
  if (topPicks.length === 0) {
    console.log('🎯 TopPicks: No picks to display');
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Top Picks</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {Array.isArray(topPicks) && topPicks.length > 0 ?
          topPicks.filter(event => event && event.$id && event.title).map((event, index) => {
            try {
              // Ensure all values are properly converted to safe strings
              const rawEmoji = getEventEmoji(event.tags || ['other']);
              const emoji = (rawEmoji && typeof rawEmoji === 'string') ? rawEmoji : '🎉';

              const rawEventDate = dayjs(event.startTime).format('MMM D');
              const eventDate = (rawEventDate && typeof rawEventDate === 'string') ? rawEventDate : 'TBD';

              const rawEventTitle = event.title;
              const eventTitle = (rawEventTitle && typeof rawEventTitle === 'string') ? String(rawEventTitle) : 'Untitled Event';

              // Final safety check - ensure ALL values are strings before proceeding
              if (typeof emoji !== 'string' || typeof eventDate !== 'string' || typeof eventTitle !== 'string') {
                console.warn('TopPicks: Skipping event due to invalid data types after conversion', {
                  emoji: typeof emoji,
                  eventDate: typeof eventDate,
                  eventTitle: typeof eventTitle,
                  event: event
                });
                return null;
              }

              return (
                <TouchableOpacity
                  key={event.$id}
                  style={styles.pickItem}
                  onPress={() => handleEventPress(event.$id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.pickCircle}>
                    <EventImage
                      photoId={(event as any).photoId}
                      tags={event.tags || []}
                      size={70}
                      style={{ borderRadius: 35 }}
                    />
                    {((event as any).recommendationReason) && getRecommendationIcon((event as any).recommendationReason) && (
                      <View style={styles.reasonBadge}>
                        <Text style={styles.reasonIcon}>{getRecommendationIcon((event as any).recommendationReason)}</Text>
                      </View>
                    )}
                    {/* Attending count bubble */}
                    {((event as any).attendeeCount && (event as any).attendeeCount > 0) && (
                      <View style={styles.attendingBubble}>
                        <Text style={styles.attendingCount}>
                          {(event as any).attendeeCount}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[styles.pickName, { color: colors.text || '#000000' }]}
                    numberOfLines={2}
                  >
                    {eventTitle}
                  </Text>
                  <Text style={[styles.pickDate, { color: colors.textSecondary || '#666666' }]}>
                    {eventDate}
                  </Text>
                  {event.distance && typeof event.distance === 'number' && event.distance > 0 && (
                    <Text style={[styles.pickDistance, { color: colors.textSecondary || '#666666' }]}>
                      {event.distance.toFixed(1)}km
                    </Text>
                  )}
                </TouchableOpacity>
              );
            } catch (error) {
              console.error('Error rendering TopPick item:', error);
              return null;
            }
          }) :
          // Fallback when no valid topPicks
          Array.from({ length: 3 }).map((_, index) => (
            <View key={`fallback-${index}`} style={styles.pickItem}>
              <View style={styles.pickCircle}>
                <EventImage
                  tags={['social']}
                  size={70}
                  style={{ borderRadius: 35 }}
                />
              </View>
              <Text style={[styles.pickName, { color: colors.textSecondary }]}>Loading...</Text>
            </View>
          ))
        }
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  scrollView: {
    paddingLeft: 16,
  },
  scrollContent: {
    paddingRight: 16,
  },
  pickItem: {
    alignItems: 'center',
    marginRight: 20,
    width: 80,
  },
  pickCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  pickEmoji: {
    fontSize: 28,
  },
  placeholderEmoji: {
    fontSize: 24,
    opacity: 0.5,
  },
  pickName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: 14,
  },
  pickDate: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
  },
  pickDistance: {
    fontSize: 9,
    fontWeight: '400',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  reasonBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonIcon: {
    fontSize: 10,
  },
  attendingBubble: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  attendingCount: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default TopPicks;
