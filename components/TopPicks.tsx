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
        } else {
          console.log('🔄 Using fallback algorithm');
          picks = await generateFallbackTopPicks(allEvents, userFriends || [], maxPicks, currentUserId);
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
                <Text style={styles.placeholderEmoji}>⏳</Text>
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
        {topPicks.filter(event => event && event.$id && event.title).map((event, index) => {
          try {
            const emoji = getEventEmoji(event.tags || ['other']) || '🎉';
            const eventDate = dayjs(event.startTime).format('MMM D');
            const eventTitle = event.title || 'Untitled Event';

            // Ensure all variables are strings and properly defined
            if (!emoji || typeof emoji !== 'string' || !eventDate || typeof eventDate !== 'string' || !eventTitle || typeof eventTitle !== 'string') {
              console.warn('TopPicks: Skipping event due to invalid data types', {
                emoji: typeof emoji,
                eventDate: typeof eventDate,
                eventTitle: typeof eventTitle,
                emojiValue: emoji,
                eventDateValue: eventDate,
                eventTitleValue: eventTitle
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
                <LinearGradient
                  colors={[(colors.primary || '#007AFF') + '30', (colors.primary || '#007AFF') + '10']}
                  style={styles.pickCircle}
                >
                  <Text style={styles.pickEmoji}>{emoji}</Text>
                </LinearGradient>
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
        })}
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
});

export default TopPicks;
