import { freeLocationService } from '@/lib/utils/freeLocationService';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
    onSelect: (address: string, lat?: number, lng?: number) => void;
    placeholder?: string;
    value?: string;
    onChangeText?: (text: string) => void;
}

interface LocationSuggestion {
    id: string;
    name: string;
    address: string;
    coordinates?: { lat: number; lng: number };
    source: 'cache' | 'osm' | 'local';
    distance?: number;
    type: string;
    popularity?: number;
}

export default function PlaceAutocompleteFree({ value, onChangeText, onSelect, placeholder }: Props) {
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [serviceStats, setServiceStats] = useState<any>(null);

    useEffect(() => {
        // Initialize free location service
        freeLocationService.initializeUserLocation();

        // Get service statistics
        setServiceStats(freeLocationService.getServiceStats());
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        const fetchSuggestions = async () => {
            if (!value || value.trim().length < 1) {
                // Show popular suggestions when no query
                if (!value || value.trim().length === 0) {
                    const popularSuggestions = await freeLocationService.getLocationSuggestions('popular');
                    setSuggestions(popularSuggestions.slice(0, 4));
                    setShowSuggestions(true);
                } else {
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
                setError(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                console.log('🆓 FREE Search initiated for:', value.trim());

                const results = await freeLocationService.getLocationSuggestions(value.trim());

                console.log(`✅ Found ${results.length} FREE suggestions:`,
                    results.map(r => `${r.name} (${r.source}, ${r.distance ? Math.round(r.distance) + 'km' : 'no distance'})`));

                setSuggestions(results);
                setShowSuggestions(results.length > 0);

            } catch (e: any) {
                if (e.name !== 'AbortError') {
                    console.error('❌ FREE search error:', e);
                    setError('Search temporarily unavailable. Try again in a moment.');
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
            } finally {
                setLoading(false);
            }
        };

        const debounceTimer = setTimeout(fetchSuggestions, 200); // Faster debounce for free service

        return () => {
            clearTimeout(debounceTimer);
            controller.abort();
        };
    }, [value]);

    const handleSuggestionPress = async (suggestion: LocationSuggestion) => {
        setLoading(true);
        setShowSuggestions(false);

        try {
            console.log('📍 Selected FREE location:', suggestion.name, `(${suggestion.source})`);

            if (suggestion.coordinates) {
                onSelect(suggestion.address, suggestion.coordinates.lat, suggestion.coordinates.lng);
            } else {
                onSelect(suggestion.address);
            }

            setSuggestions([]);
            setError(null);
        } catch (e) {
            console.error('Error selecting location:', e);
            setError('Failed to select location. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getSourceIcon = (source: string) => {
        switch (source) {
            case 'cache': return 'stars'; // Popular cached locations
            case 'osm': return 'public'; // OpenStreetMap (community data)
            case 'local': return 'home'; // Local database
            default: return 'place';
        }
    };

    const getSourceColor = (source: string) => {
        switch (source) {
            case 'cache': return '#FFD700'; // Gold for popular
            case 'osm': return '#4CAF50'; // Green for community
            case 'local': return '#2196F3'; // Blue for local
            default: return 'rgba(255,255,255,0.7)';
        }
    };

    const getLocationTypeIcon = (type: string) => {
        switch (type) {
            case 'restaurant': return 'restaurant';
            case 'cafe': return 'local-cafe';
            case 'bar': return 'local-bar';
            case 'store': case 'shopping': return 'store';
            case 'park': return 'park';
            case 'establishment': return 'business';
            case 'locality': return 'location-city';
            default: return 'place';
        }
    };

    const getPopularityIndicator = (popularity?: number) => {
        if (!popularity) return null;
        if (popularity >= 80) return '🔥'; // Hot
        if (popularity >= 60) return '⭐'; // Popular
        if (popularity >= 40) return '👍'; // Good
        return null;
    };

    return (
        <View style={styles.container}>
            <TextInput
                placeholder={placeholder || 'Search locations (100% free)...'}
                value={value}
                onChangeText={(text) => {
                    onChangeText?.(text);
                    if (text.trim().length >= 0) {
                        setShowSuggestions(true);
                    }
                }}
                onFocus={() => {
                    if (suggestions.length > 0) {
                        setShowSuggestions(true);
                    }
                }}
                style={[styles.textInput, {
                    borderBottomColor: error ? '#EF4444' : 'rgba(255,255,255,0.3)',
                    color: '#000'
                }]}
                placeholderTextColor="rgba(255,255,255,0.6)"
                autoCorrect={false}
                autoCapitalize="words"
            />

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                    <Text style={styles.loadingText}>Searching free database...</Text>
                </View>
            )}

            {error && (
                <View style={styles.errorContainer}>
                    <MaterialIcons name="error-outline" size={16} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {showSuggestions && suggestions.length > 0 && !loading && (
                <View style={styles.suggestionsContainer}>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled={true}
                        style={{ maxHeight: 280 }}
                    >
                        {suggestions.map((item, index) => (
                            <React.Fragment key={item.id}>
                                {index > 0 && <View style={styles.separator} />}
                                <TouchableOpacity
                                    onPress={() => handleSuggestionPress(item)}
                                    style={[
                                        styles.suggestionItem,
                                        index === 0 && styles.firstSuggestionItem,
                                        index === suggestions.length - 1 && styles.lastSuggestionItem
                                    ]}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.iconContainer}>
                                        <MaterialIcons
                                            name={getLocationTypeIcon(item.type) as any}
                                            size={18}
                                            color="rgba(255,255,255,0.8)"
                                        />
                                        <MaterialIcons
                                            name={getSourceIcon(item.source) as any}
                                            size={12}
                                            color={getSourceColor(item.source)}
                                            style={styles.sourceIcon}
                                        />
                                    </View>

                                    <View style={styles.suggestionTextContainer}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.suggestionMainText} numberOfLines={1}>
                                                {item.name}
                                            </Text>
                                            {getPopularityIndicator(item.popularity) && (
                                                <Text style={styles.popularityIcon}>
                                                    {getPopularityIndicator(item.popularity)}
                                                </Text>
                                            )}
                                        </View>

                                        <View style={styles.suggestionMetaContainer}>
                                            <Text style={styles.suggestionSecondaryText} numberOfLines={1}>
                                                {item.address}
                                            </Text>

                                            <View style={styles.suggestionBadges}>
                                                {item.distance && (
                                                    <Text style={styles.distanceBadge}>
                                                        {item.distance < 1 ?
                                                            `${Math.round(item.distance * 1000)}m` :
                                                            `${item.distance.toFixed(1)}km`
                                                        }
                                                    </Text>
                                                )}
                                                <Text style={[styles.sourceBadge, {
                                                    backgroundColor: getSourceColor(item.source) + '20',
                                                    borderColor: getSourceColor(item.source) + '40'
                                                }]}>
                                                    {item.source === 'cache' ? 'Popular' :
                                                        item.source === 'osm' ? 'Community' : 'Local'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            </React.Fragment>
                        ))}
                    </ScrollView>

                    {/* Free service info footer */}
                    <View style={styles.freeServiceInfo}>
                        <View style={styles.freeIconRow}>
                            <MaterialIcons name="money-off" size={16} color="#4CAF50" />
                            <Text style={styles.freeServiceText}>
                                100% Free • No API costs • {serviceStats?.totalCachedLocations}+ locations
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {/* No results with helpful suggestions */}
            {!loading && suggestions.length === 0 && value && value.length > 2 && (
                <View style={styles.noResultsContainer}>
                    <MaterialIcons name="search-off" size={24} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.noResultsText}>No locations found for "{value}"</Text>
                    <Text style={styles.noResultsSubtext}>
                        Try: city names, landmarks, or venue types (cafe, restaurant, park)
                    </Text>

                    <TouchableOpacity
                        style={styles.suggestButton}
                        onPress={() => {
                            // Add the custom location to our free database
                            freeLocationService.addCustomLocation({
                                name: value,
                                address: `${value} (User suggested)`,
                                lat: 0, // Will be populated when user provides location
                                lng: 0,
                                type: 'establishment',
                                popularity: 30
                            });

                            onSelect(value);
                            setShowSuggestions(false);
                        }}
                    >
                        <MaterialIcons name="add-location" size={16} color="#4CAF50" />
                        <Text style={styles.suggestButtonText}>Use "{value}" anyway</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        zIndex: 1000,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: '#000',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.3)',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    loadingText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginLeft: 8,
        fontStyle: 'italic',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    errorText: {
        color: '#EF4444',
        fontSize: 14,
        marginLeft: 6,
        fontWeight: '500',
    },
    suggestionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        maxHeight: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 1000,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'transparent',
    },
    firstSuggestionItem: {
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    lastSuggestionItem: {
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    iconContainer: {
        position: 'relative',
        marginRight: 12,
        paddingTop: 2,
    },
    sourceIcon: {
        position: 'absolute',
        top: -4,
        right: -8,
    },
    suggestionTextContainer: {
        flex: 1,
        marginRight: 8,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    suggestionMainText: {
        color: '#1f2937',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    popularityIcon: {
        fontSize: 14,
        marginLeft: 6,
    },
    suggestionMetaContainer: {
        flex: 1,
    },
    suggestionSecondaryText: {
        color: '#6b7280',
        fontSize: 14,
        fontWeight: '400',
        marginBottom: 6,
    },
    suggestionBadges: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
    },
    distanceBadge: {
        fontSize: 12,
        color: '#059669',
        fontWeight: '500',
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    sourceBadge: {
        fontSize: 11,
        color: '#374151',
        fontWeight: '500',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        overflow: 'hidden',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.08)',
        marginHorizontal: 16,
    },
    freeServiceInfo: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: 'rgba(76, 175, 80, 0.05)',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(76, 175, 80, 0.1)',
    },
    freeIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    freeServiceText: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
    noResultsContainer: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 16,
    },
    noResultsText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        fontWeight: '500',
        marginTop: 8,
        textAlign: 'center',
    },
    noResultsSubtext: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        marginTop: 4,
        marginBottom: 16,
        textAlign: 'center',
        lineHeight: 20,
    },
    suggestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(76, 175, 80, 0.3)',
    },
    suggestButtonText: {
        color: '#4CAF50',
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 6,
    },
});