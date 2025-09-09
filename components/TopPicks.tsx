/**
 * TopPicks Component
 * 
 * Displays personalized event recommendations in a horizontal scrollable row
 * Similar to Instagram stories format with round avatars, event names, and dates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@react-navigation/native';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getEventEmoji } from '@/constants/categories';
import { Event as AppEvent } from '@/lib/types/Events';
import { TopPickEvent, generateFallbackTopPicks, generateTopPicks as generateTopPicksAlgorithm, getUserLocation } from '@/lib/utils/topPicks';

interface TopPicksProps {
  allEvents: AppEvent[];
  userFriends: string[];
  maxPicks?: number;
}

// Simple hash function for arrays (removed complex caching for now)
// const hashArray = (arr: any[]): string => {
//   if (!arr || arr.length === 0) return 'empty';
//   try {
//     const sorted = arr.map(item => item.$id || item).sort();
//     return btoa(JSON.stringify(sorted)).slice(0, 16);
//   } catch (error) {
//     console.warn('TopPicks: Hash generation failed:', error);
//     return `fallback_${arr.length}_${Date.now()}`;
//   }
// };

const TopPicks: React.FC<TopPicksProps> = ({
  allEvents,
  userFriends,
  maxPicks = 8
}) => {
  const { colors } = useTheme();
  const [topPicks, setTopPicks] = useState<TopPickEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  console.log('🎯 TopPicks: Render', {
    allEventsCount: allEvents?.length || 0,
    userFriendsCount: userFriends?.length || 0,
    topPicksCount: topPicks.length,
    isLoading
  });

  // Try to load from simple cache on mount
  useEffect(() => {
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

  // Clear stale picks if no events for too long
  useEffect(() => {
    if (!allEvents || allEvents.length === 0) {
      const timeout = setTimeout(() => {
        if (topPicks.length > 0 && (!allEvents || allEvents.length === 0)) {
          console.log('🎯 TopPicks: Clearing stale picks after timeout');
          setTopPicks([]);
        }
      }, 5000); // 5 second timeout for stale data

      return () => clearTimeout(timeout);
    }
  }, [allEvents, topPicks.length]);

  // Simplified generation - always generate when data changes
  useEffect(() => {
    const generateTopPicks = async () => {
      console.log('🎯 TopPicks: Starting generation...', {
        allEventsCount: allEvents?.length || 0,
        hasEvents: Boolean(allEvents && allEvents.length > 0)
      });

      // If we have no events, only clear if we're not currently showing picks
      // This prevents flashing when Feed is reloading data
      if (!allEvents || allEvents.length === 0) {
        console.log('🎯 TopPicks: No events available');

        // If we already have picks displayed, keep showing them during data reload
        if (topPicks.length === 0) {
          console.log('🎯 TopPicks: No existing picks, setting loading false');
          setIsLoading(false);
        } else {
          console.log('🎯 TopPicks: Keeping existing picks during reload');
        }
        return;
      }

      // We have events, proceed with generation
      setIsLoading(true);

      try {
        console.log('🎯 TopPicks: Generating with', allEvents.length, 'events');

        // Get user location (with fallback)
        const userLocation = await getUserLocation();

        let picks: TopPickEvent[];
        if (userLocation) {
          console.log('📍 Using location-based algorithm');
          picks = await generateTopPicksAlgorithm(allEvents, userFriends || [], userLocation, maxPicks);
        } else {
          console.log('🔄 Using fallback algorithm');
          picks = await generateFallbackTopPicks(allEvents, userFriends || [], maxPicks);
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
        // Don't clear existing picks on error, just log it
        if (topPicks.length === 0) {
          setTopPicks([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    generateTopPicks();
  }, [allEvents, userFriends, maxPicks]); // Simple dependencies

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
          <Text style={[styles.title, { color: '#FFFFFF' }]}>Top Picks</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={`loading-${index}`} style={styles.pickItem}>
              <View style={[styles.pickAvatar, styles.loadingPlaceholder]} />
              <View style={[styles.loadingTextPlaceholder, styles.loadingPlaceholder]} />
              <View style={[styles.loadingTextPlaceholder, styles.loadingPlaceholder]} />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Hide if no picks and not loading
  if (!topPicks.length && !isLoading) {
    console.log('🎯 TopPicks: No picks available, hiding component');
    return null;
  }

  // Show picks (even if loading in background)
  if (topPicks.length > 0) {
    console.log('🎯 TopPicks: Rendering', topPicks.length, 'actual picks');
  }

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: '#FFFFFF' }]}>Top Picks</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {topPicks.map((pick, index) => (
          <TouchableOpacity
            key={pick.$id}
            style={styles.pickItem}
            onPress={() => handleEventPress(pick.$id)}
            activeOpacity={0.7}
          >
            {/* Event Avatar with Gradient Background */}
            <LinearGradient
              colors={["#c78aa5", "#db7d95", "#f2948f", "#f6b793", "#fbf4be"]}
              style={styles.pickAvatar}
            >
              <Text style={styles.pickEmoji}>{getEventEmoji(pick.tags)}</Text>
            </LinearGradient>

            {/* Event Title */}
            <Text style={[styles.pickTitle, { color: '#FFFFFF' }]} numberOfLines={2}>
              {pick.title}
            </Text>

            {/* Event Date */}
            <Text style={[styles.pickDate, { color: '#FFFFFF' }]}>
              {dayjs(pick.startTime).format('MMM D')}
            </Text>

            {/* Optional: Show metrics for debugging */}
            {__DEV__ && (
              <View style={styles.debugInfo}>
                <Text style={styles.debugText}>
                  {pick.totalScore.toFixed(0)}pt
                </Text>
                {pick.friendsAttending > 0 && (
                  <Text style={styles.debugText}>
                    {pick.friendsAttending}👥
                  </Text>
                )}
                {pick.distance > 0 && (
                  <Text style={styles.debugText}>
                    {pick.distance.toFixed(1)}km
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Utility function to clear top picks cache (simplified for now)
export const clearTopPicksCache = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('top_picks_cache');
    console.log('🗑️ TopPicks: Cache cleared successfully');
  } catch (error) {
    console.warn('TopPicks: Failed to clear cache:', error);
  }
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 0, // Removed top padding completely
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 8, // Slightly increased to compensate for removed container padding
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  scrollContainer: {
    paddingHorizontal: 4,
  },
  pickItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 80,
  },
  pickAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pickEmoji: {
    fontSize: 24,
  },
  pickTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2, // Reduced from 4 to bring date closer
    lineHeight: 16,
    minHeight: 32, // Ensure consistent spacing
  },
  pickDate: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  loadingPlaceholder: {
    backgroundColor: '#e0e0e0',
    opacity: 0.3,
  },
  loadingTextPlaceholder: {
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  debugInfo: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  debugText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '500',
  },
});

export default TopPicks;
