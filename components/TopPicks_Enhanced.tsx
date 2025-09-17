/**
 * TopPicks Component
 * 
 * Displays personalized event recommendations in a horizontal scrollable row
 * Enhanced with location-based recommendations and travel awareness
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getEventEmoji } from '@/constants/categories';
import { useTheme } from '@/lib/context/ThemeContext';
import { EnhancedTopPickEvent, generateEnhancedTopPicks } from '@/lib/services/enhancedTopPicks';
import { Event as AppEvent } from '@/lib/types/Events';

interface TopPicksProps {
    allEvents?: AppEvent[]; // Optional - we now get recommendations from the service
    userFriends?: string[];
    currentUserId?: string;
    maxPicks?: number;
}

const TopPicks: React.FC<TopPicksProps> = ({
    allEvents = [],
    userFriends = [],
    currentUserId,
    maxPicks = 8
}) => {
    const { colors } = useTheme();
    const [topPicks, setTopPicks] = useState<EnhancedTopPickEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [recommendationSource, setRecommendationSource] = useState<'location' | 'fallback'>('location');

    console.log('🎯 TopPicks: Enhanced render', {
        currentUserId,
        maxPicks,
        hasLocationService: true
    });

    // Enhanced TopPicks generation using location-based recommendations
    useEffect(() => {
        const generateLocationBasedTopPicks = async () => {
            console.log('🎯 TopPicks: Starting enhanced generation...', {
                currentUserId,
                maxPicks
            });

            if (!currentUserId) {
                console.log('🎯 TopPicks: No user ID available');
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            try {
                // Generate enhanced recommendations using the new service
                const enhancedPicks = await generateEnhancedTopPicks({
                    userId: currentUserId,
                    maxDistance: 25, // 25km radius for local events
                    includeTravelEvents: true,
                    friendsWeight: 0.3,
                    locationWeight: 0.4,
                    popularityWeight: 0.3,
                    limit: maxPicks
                });

                if (enhancedPicks.length > 0) {
                    console.log('🎯 TopPicks: Generated', enhancedPicks.length, 'location-based picks');
                    setTopPicks(enhancedPicks);
                    setRecommendationSource('location');

                    // Cache the results
                    try {
                        await AsyncStorage.setItem('enhanced_top_picks', JSON.stringify(enhancedPicks));
                    } catch (error) {
                        console.warn('TopPicks: Failed to cache picks:', error);
                    }
                } else {
                    console.log('🎯 TopPicks: No enhanced picks found, using fallback');
                    setRecommendationSource('fallback');
                    // Could implement fallback logic here
                }

            } catch (error) {
                console.error('🎯 TopPicks: Enhanced generation failed:', error);
                setRecommendationSource('fallback');
                // Could implement fallback logic here
            } finally {
                setIsLoading(false);
            }
        };

        generateLocationBasedTopPicks();
    }, [currentUserId, maxPicks]);

    // Load from cache on component mount
    useEffect(() => {
        const loadFromCache = async () => {
            if (!currentUserId) return;

            try {
                const cached = await AsyncStorage.getItem('enhanced_top_picks');
                if (cached) {
                    const cachedPicks = JSON.parse(cached);
                    if (cachedPicks && Array.isArray(cachedPicks) && cachedPicks.length > 0) {
                        console.log('🎯 TopPicks: Loaded', cachedPicks.length, 'enhanced picks from cache');
                        setTopPicks(cachedPicks);
                        setIsLoading(false);
                    }
                }
            } catch (error) {
                console.warn('TopPicks: Failed to load from cache:', error);
            }
        };

        loadFromCache();
    }, [currentUserId]);

    // Handle event press
    const handleEventPress = (eventId: string) => {
        router.push(`/event/${eventId}?from=top-picks` as any);
    };

    // Get recommendation reason icon
    const getRecommendationIcon = (reason: EnhancedTopPickEvent['recommendationReason']) => {
        switch (reason) {
            case 'location': return '📍';
            case 'travel': return '✈️';
            case 'friends': return '👥';
            case 'popularity': return '⭐';
            case 'mixed': return '🎯';
            default: return '🎉';
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
                                colors={[colors.surface + '40', colors.surface + '20']}
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

    // Don't render if no picks available
    if (topPicks.length === 0) {
        console.log('🎯 TopPicks: No picks to display');
        return null;
    }

    console.log('🎯 TopPicks: Rendering', topPicks.length, 'picks');

    return (
        <View style={[styles.container, { backgroundColor: 'transparent' }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Top Picks</Text>
                {recommendationSource === 'location' && (
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        📍 Based on your location & travel plans
                    </Text>
                )}
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                style={styles.scrollView}
            >
                {topPicks.map((event, index) => {
                    const emoji = getEventEmoji(event.tags || ['other']);
                    const eventDate = dayjs(event.startTime).format('MMM D');
                    const reasonIcon = getRecommendationIcon(event.recommendationReason);

                    return (
                        <TouchableOpacity
                            key={event.$id}
                            style={styles.pickItem}
                            onPress={() => handleEventPress(event.$id)}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={[colors.primary + '30', colors.primary + '10']}
                                style={styles.pickCircle}
                            >
                                <Text style={styles.pickEmoji}>{emoji}</Text>
                                <View style={styles.reasonBadge}>
                                    <Text style={styles.reasonIcon}>{reasonIcon}</Text>
                                </View>
                            </LinearGradient>
                            <Text
                                style={[styles.pickName, { color: colors.text }]}
                                numberOfLines={2}
                            >
                                {event.title}
                            </Text>
                            <Text style={[styles.pickDate, { color: colors.textSecondary }]}>
                                {eventDate}
                            </Text>
                            {event.distanceFromUser && (
                                <Text style={[styles.pickDistance, { color: colors.textSecondary }]}>
                                    {event.distanceFromUser.toFixed(1)}km
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
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
    subtitle: {
        fontSize: 14,
        fontWeight: '500',
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
        position: 'relative',
    },
    pickEmoji: {
        fontSize: 28,
    },
    placeholderEmoji: {
        fontSize: 24,
        opacity: 0.5,
    },
    reasonBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    reasonIcon: {
        fontSize: 10,
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
