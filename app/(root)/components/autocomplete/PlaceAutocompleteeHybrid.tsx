import { useTheme } from '@/lib/context/ThemeContext';
import { hybridLocationService } from '@/lib/utils/hybridLocationService';
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
    source: 'osm' | 'google' | 'cache';
    distance?: number;
    type: string;
}

export default function PlaceAutocompleteHybrid({ value, onChangeText, onSelect, placeholder }: Props) {
    const { colors } = useTheme();
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Initialize user location for better results
        hybridLocationService.initializeUserLocation();
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        const fetchSuggestions = async () => {
            if (!value || value.trim().length < 2) {
                setSuggestions([]);
                setShowSuggestions(false);
                setError(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                console.log('🔍 Searching with hybrid service:', value.trim());

                // Use hybrid service with Google fallback for premium searches
                const useGoogleFallback = value.trim().length > 3; // Only use Google for longer queries
                const results = await hybridLocationService.getLocationSuggestions(value.trim(), useGoogleFallback);

                console.log(`✅ Found ${results.length} suggestions:`, results.map(r => `${r.name} (${r.source})`));

                setSuggestions(results);
                setShowSuggestions(results.length > 0);

            } catch (e: any) {
                if (e.name !== 'AbortError') {
                    console.error('❌ Hybrid search error:', e);
                    setError('Connection error. Please check your internet.');
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
            } finally {
                setLoading(false);
            }
        };

        const debounceTimer = setTimeout(fetchSuggestions, 300);

        return () => {
            clearTimeout(debounceTimer);
            controller.abort();
        };
    }, [value]);

    const handleSuggestionPress = async (suggestion: LocationSuggestion) => {
        setLoading(true);
        setShowSuggestions(false);

        try {
            console.log('📍 Selected location:', suggestion.name, suggestion.source);

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
            case 'cache': return 'stars'; // Popular/cached locations
            case 'osm': return 'map'; // OpenStreetMap results
            case 'google': return 'place'; // Google Places results
            default: return 'location-on';
        }
    };

    const getSourceColor = (source: string) => {
        switch (source) {
            case 'cache': return '#FFD700'; // Gold for popular
            case 'osm': return '#4CAF50'; // Green for free OSM
            case 'google': return '#4285F4'; // Google blue
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

    return (
        <View style={styles.container}>
            <TextInput
                placeholder={placeholder || 'Search for a location...'}
                value={value}
                onChangeText={(text) => {
                    onChangeText?.(text);
                    if (text.trim().length > 0) {
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
                    <Text style={styles.loadingText}>Searching locations...</Text>
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
                        style={{ maxHeight: 250 }}
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
                                            name={getLocationTypeIcon(item.type)}
                                            size={16}
                                            color="rgba(255,255,255,0.7)"
                                        />
                                        <MaterialIcons
                                            name={getSourceIcon(item.source)}
                                            size={12}
                                            color={getSourceColor(item.source)}
                                            style={styles.sourceIcon}
                                        />
                                    </View>

                                    <View style={styles.suggestionTextContainer}>
                                        <Text style={styles.suggestionMainText} numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                        <View style={styles.suggestionMetaContainer}>
                                            <Text style={styles.suggestionSecondaryText} numberOfLines={1}>
                                                {item.address}
                                            </Text>
                                            <View style={styles.suggestionBadges}>
                                                {item.distance && (
                                                    <Text style={styles.distanceBadge}>
                                                        {item.distance < 1 ? `${Math.round(item.distance * 1000)}m` : `${item.distance.toFixed(1)}km`}
                                                    </Text>
                                                )}
                                                <Text style={[styles.sourceBadge, { backgroundColor: getSourceColor(item.source) + '20' }]}>
                                                    {item.source === 'cache' ? 'Popular' : item.source === 'osm' ? 'Free' : 'Premium'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            </React.Fragment>
                        ))}
                    </ScrollView>

                    {/* Cost information footer */}
                    {suggestions.some(s => s.source === 'google') && (
                        <View style={styles.costInfo}>
                            <MaterialIcons name="info-outline" size={14} color="rgba(255,255,255,0.5)" />
                            <Text style={styles.costInfoText}>
                                Premium results shown • Free alternatives available
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* No results fallback */}
            {!loading && suggestions.length === 0 && value && value.length > 2 && (
                <View style={styles.noResultsContainer}>
                    <MaterialIcons name="search-off" size={20} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.noResultsText}>No locations found for "{value}"</Text>
                    <Text style={styles.noResultsSubtext}>Try a different search term or check spelling</Text>
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
        maxHeight: 280,
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
        top: -2,
        right: -6,
    },
    suggestionTextContainer: {
        flex: 1,
        marginRight: 8,
    },
    suggestionMainText: {
        color: '#1f2937',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
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
        overflow: 'hidden',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.08)',
        marginHorizontal: 16,
    },
    costInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    costInfoText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginLeft: 6,
        fontStyle: 'italic',
    },
    noResultsContainer: {
        alignItems: 'center',
        paddingVertical: 20,
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
        textAlign: 'center',
    },
});