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
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const TopPicks: React.FC<TopPicksProps> = React.memo(({
  allEvents,
  userFriends,
  currentUserId,
  maxPicks = 8
}) => {
  const { colors, isColorful } = useTheme();
  const [topPicks, setTopPicks] = useState<TopPickEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recommendationSource, setRecommendationSource] = useState<'location' | 'fallback' | null>(null);
  const generationRef = useRef<{ timeoutId?: ReturnType<typeof setTimeout>, lastGeneration: number }>({ lastGeneration: 0 });

  // Stable reference for events to prevent unnecessary effect runs
  const eventIds = useMemo(() =>
    allEvents?.map(e => e.$id).sort().join('|') || '',
    [allEvents?.length, allEvents?.map(e => e.$id).join(',')]
  );

  const friendIds = useMemo(() =>
    userFriends?.map(f => f).sort().join('|') || '',
    [userFriends?.length, userFriends?.join(',')]
  );

  // Prevent component re-render when picks haven't changed
  const stableTopPicks = useMemo(() => topPicks, [
    topPicks.length,
    topPicks.map(p => p.$id || p.id).join(',')
  ]);

  // Load from cache initially - only once per user
  useEffect(() => {
    if (!currentUserId) return;

    let mounted = true;

    const loadFromCache = async () => {
      try {
        const cacheKey = `top_picks_${currentUserId}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && mounted) {
          const cachedPicks = JSON.parse(cached);
          const validPicks = cachedPicks?.filter((pick: any) => pick?.$id && pick?.title) || [];
          if (validPicks.length > 0) {
            setTopPicks(validPicks);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.warn('TopPicks: Cache load failed:', error);
      }
    };

    loadFromCache();

    return () => {
      mounted = false;
    };
  }, [currentUserId]);

  // Generate TopPicks when data changes
  useEffect(() => {
    if (!currentUserId || !allEvents?.length) {
      setIsLoading(false);
      setTopPicks([]);
      return;
    }

    // Debounce generation to prevent rapid successive calls
    if (generationRef.current.timeoutId) {
      clearTimeout(generationRef.current.timeoutId);
    }

    // Rate limit: minimum 1 second between generations
    const now = Date.now();
    const timeSinceLastGeneration = now - generationRef.current.lastGeneration;
    const delay = timeSinceLastGeneration < 1000 ? 1000 - timeSinceLastGeneration : 100;

    generationRef.current.timeoutId = setTimeout(() => {
      generateTopPicks();
    }, delay);

    const timeoutId = setTimeout(() => setIsLoading(false), 10000);

    const generateTopPicks = async () => {
      generationRef.current.lastGeneration = Date.now();

      // Skip generation if we already have picks for the same event set
      if (topPicks.length > 0 && topPicks.every(pick =>
        allEvents?.some(event => event.$id === pick.$id)
      )) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const userLocation = await getUserLocation();
        let picks: TopPickEvent[];

        if (userLocation) {
          picks = await generateTopPicksAlgorithm(allEvents, userFriends || [], userLocation, maxPicks, currentUserId);
          setRecommendationSource('location');
        } else {
          picks = await generateFallbackTopPicks(allEvents, userFriends || [], maxPicks, currentUserId);
          setRecommendationSource('fallback');
        }

        setTopPicks(picks);

        // Cache the results
        try {
          const cacheKey = `top_picks_${currentUserId}`;
          await AsyncStorage.setItem(cacheKey, JSON.stringify(picks));
        } catch (error) {
          console.warn('TopPicks: Cache save failed:', error);
        }

      } finally {
        setIsLoading(false);
        clearTimeout(timeoutId);
      }
    };

    generateTopPicks();

    return () => {
      clearTimeout(timeoutId);
      if (generationRef.current.timeoutId) {
        clearTimeout(generationRef.current.timeoutId);
      }
    };
  }, [currentUserId, eventIds, friendIds, maxPicks]);

  // Handle event press
  const handleEventPress = (eventId: string) => {
    router.push(`/(root)/events/${eventId}?from=top-picks` as any);
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
  if (isLoading && stableTopPicks.length === 0) {
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
                colors={isColorful ? ['#667eea', '#764ba2'] : [colors.primary + '30', colors.primary + '10']}
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
    return null;
  }

  // Don't render if no picks available
  if (stableTopPicks.length === 0) {
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
        {Array.isArray(stableTopPicks) && stableTopPicks.length > 0 ? (
          stableTopPicks
            .filter(event => {
              // More thorough validation
              if (!event || typeof event !== 'object') return false;
              if (!event.$id || typeof event.$id !== 'string') return false;
              if (!event.title || typeof event.title !== 'string') return false;
              if (!event.startTime) return false;
              return true;
            })
            .map((event, index) => {
              try {
                const emoji = getEventEmoji(event.tags || ['other']) || '🎉';
                const eventDate = dayjs(event.startTime).format('MMM D') || 'TBD';
                const eventTitle = event.title || 'Untitled Event';

                // Early return null if essential data is missing
                if (!event.$id || !eventTitle) {
                  return null;
                }

                return (
                  <TouchableOpacity
                    key={`pick-${event.$id}-${index}`}
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
                      {(event as any).recommendationReason && getRecommendationIcon((event as any).recommendationReason) && (
                        <View style={styles.badge}>
                          <Text style={{ fontSize: 10 }}>
                            {getRecommendationIcon((event as any).recommendationReason) || ''}
                          </Text>
                        </View>
                      )}
                      {/* Attending count bubble */}
                      {(() => {
                        const attendeeCount = (event as any).attendeeCount;
                        if (attendeeCount && attendeeCount > 0) {
                          return (
                            <View style={styles.badge}>
                              <Text style={styles.attendingCount}>
                                {attendeeCount}
                              </Text>
                            </View>
                          );
                        }
                        return null;
                      })()}
                    </View>
                    <Text
                      style={[styles.pickName, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {eventTitle}
                    </Text>
                    <Text style={[styles.pickDate, { color: colors.textSecondary }]}>
                      {eventDate}
                    </Text>
                    {event.distance && event.distance > 0 && (
                      <Text style={[styles.pickDistance, { color: colors.textSecondary }]}>
                        {event.distance.toFixed(1)}km
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              } catch (error) {
                console.warn('TopPicks: Error processing event:', event.$id, error);
                return null;
              }
            })
            .filter(Boolean) // Remove any null entries
        ) : (
          Array.from({ length: 3 }, (_, index) => (
            <View key={`fallback-${index}`} style={styles.pickItem}>
              <LinearGradient
                colors={isColorful ? ['#667eea', '#764ba2'] : [colors.primary + '30', colors.primary + '10']}
                style={styles.pickCircle}
              >
                <Text style={styles.placeholderEmoji}>✨</Text>
              </LinearGradient>
              <Text style={[styles.pickName, { color: colors.textSecondary }]}>Loading...</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8, // Reduced from 16 to 8
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 8, // Reduced from 12 to 8
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
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
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

TopPicks.displayName = 'TopPicks';

export default TopPicks;
