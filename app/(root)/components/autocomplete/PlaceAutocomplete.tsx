import { useTheme } from '@/lib/context/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
    onSelect: (address: string, lat?: number, lng?: number) => void;
    placeholder?: string;
    value?: string;
    onChangeText?: (text: string) => void;
}

interface Suggestion {
    place_id: string;
    description: string;
    main_text: string;
    secondary_text: string;
    types: string[];
}

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

export default function PlaceAutocomplete({ value, onChangeText, onSelect, placeholder }: Props) {
    const { colors } = useTheme();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessionToken] = useState(() => {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    });

    useEffect(() => {
        const controller = new AbortController();

        const fetchSuggestions = async () => {
            if (!value || value.trim().length < 2) {
                setSuggestions([]);
                setShowSuggestions(false);
                setError(null);
                return;
            }

            if (!PLACES_API_KEY) {
                setError('Location services not available');
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
                    `input=${encodeURIComponent(value.trim())}` +
                    `&types=establishment` +
                    `&language=en` +
                    `&sessiontoken=${sessionToken}` +
                    `&key=${PLACES_API_KEY}`;

                const res = await fetch(url, {
                    signal: controller.signal,
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    }
                });

                if (!res.ok) {
                    throw new Error(`Google Places API error: ${res.status}`);
                }

                const json = await res.json();

                if (json.status === 'OK' && Array.isArray(json.predictions)) {
                    const enhancedSuggestions = json.predictions
                        .slice(0, 5)
                        .map((p: any) => ({
                            place_id: p.place_id,
                            description: p.description,
                            main_text: p.structured_formatting?.main_text || p.description,
                            secondary_text: p.structured_formatting?.secondary_text || '',
                            types: p.types || []
                        }));

                    setSuggestions(enhancedSuggestions);
                    setShowSuggestions(enhancedSuggestions.length > 0);
                } else {
                    setSuggestions([]);
                    setShowSuggestions(false);
                    if (json.status !== 'ZERO_RESULTS') {
                        setError('Location search encountered an error');
                    }
                }
            } catch (e: any) {
                if (e.name !== 'AbortError') {
                    console.error('Place autocomplete error:', e);
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
    }, [value, sessionToken]);

    const fetchPlaceDetails = async (placeId: string): Promise<{ address: string; lat?: number; lng?: number } | null> => {
        if (!PLACES_API_KEY) return null;

        try {
            const url = `https://maps.googleapis.com/maps/api/place/details/json?` +
                `place_id=${placeId}` +
                `&key=${PLACES_API_KEY}` +
                `&sessiontoken=${sessionToken}` +
                `&fields=place_id,formatted_address,name,geometry`;

            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            });

            if (!res.ok) {
                throw new Error(`Google Places Details API error: ${res.status}`);
            }

            const json = await res.json();

            if (json.status === 'OK' && json.result) {
                const result = json.result;
                const location = result.geometry?.location;

                return {
                    address: result.formatted_address || result.name,
                    lat: location?.lat,
                    lng: location?.lng
                };
            }

            return null;
        } catch (e: any) {
            console.error('Place details fetch error:', e.message);
            return null;
        }
    };

    const handleSuggestionPress = async (suggestion: Suggestion) => {
        setLoading(true);
        setShowSuggestions(false);

        try {
            const details = await fetchPlaceDetails(suggestion.place_id);

            if (details) {
                onSelect(details.address, details.lat, details.lng);
            } else {
                onSelect(suggestion.description);
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

    const getLocationIcon = (types: string[]) => {
        if (types.includes('restaurant')) return 'restaurant';
        if (types.includes('cafe')) return 'local-cafe';
        if (types.includes('bar')) return 'local-bar';
        if (types.includes('hotel')) return 'hotel';
        if (types.includes('store')) return 'store';
        if (types.includes('gas_station')) return 'local-gas-station';
        if (types.includes('hospital')) return 'local-hospital';
        if (types.includes('school')) return 'school';
        if (types.includes('park')) return 'park';
        if (types.includes('bank')) return 'account-balance-wallet';
        return 'place';
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
                        style={{ maxHeight: 200 }}
                    >
                        {suggestions.map((item, index) => (
                            <React.Fragment key={item.place_id}>
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
                                    <MaterialIcons
                                        name={getLocationIcon(item.types) as any}
                                        size={16}
                                        color="rgba(255,255,255,0.7)"
                                        style={styles.suggestionIcon}
                                    />
                                    <View style={styles.suggestionTextContainer}>
                                        <Text style={styles.suggestionMainText} numberOfLines={1}>
                                            {item.main_text}
                                        </Text>
                                        <Text style={styles.suggestionSecondaryText} numberOfLines={1}>
                                            {item.secondary_text}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </React.Fragment>
                        ))}
                    </ScrollView>
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
        maxHeight: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 1000,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
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
    suggestionIcon: {
        marginRight: 12,
    },
    suggestionTextContainer: {
        flex: 1,
        marginRight: 8,
    },
    suggestionMainText: {
        color: '#1f2937',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    suggestionSecondaryText: {
        color: '#6b7280',
        fontSize: 14,
        fontWeight: '400',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.08)',
        marginHorizontal: 16,
    },
});