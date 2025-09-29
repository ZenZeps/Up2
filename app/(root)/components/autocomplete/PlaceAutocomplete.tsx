import { useTheme } from '@/lib/context/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LocationSuggestions from './LocationSuggestions';

interface Suggestion {
    place_id: string;
    description: string;
    main_text: string;
    secondary_text: string;
    types: string[];
}

interface Props {
    value: string;
    onChangeText: (v: string) => void;
    onSelect: (address: string, lat?: number, lng?: number) => void;
    placeholder?: string;
}

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

// Google Places API configuration
const PLACES_CONFIG = {
    autocomplete: {
        types: 'establishment', // Focus on businesses and points of interest
        components: 'country:us|country:ca|country:gb|country:au|country:nz', // Major English-speaking countries
        language: 'en',
        sessiontoken: null as string | null, // For session-based billing
    },
    details: {
        fields: 'place_id,formatted_address,name,geometry,types,business_status,rating,user_ratings_total,price_level,opening_hours',
    }
};

export default function PlaceAutocomplete({ value, onChangeText, onSelect, placeholder }: Props) {
    const { colors } = useTheme();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessionToken] = useState(() => {
        // Generate a unique session token for billing optimization
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
                // Enhanced Google Places Autocomplete API call
                const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
                    `input=${encodeURIComponent(value.trim())}` +
                    `&types=${PLACES_CONFIG.autocomplete.types}` +
                    `&components=${PLACES_CONFIG.autocomplete.components}` +
                    `&language=${PLACES_CONFIG.autocomplete.language}` +
                    `&sessiontoken=${sessionToken}` +
                    `&key=${PLACES_API_KEY}`;

                console.log('Fetching Google Places suggestions for:', value.trim());
                const res = await fetch(url, {
                    signal: controller.signal,
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    }
                });

                if (!res.ok) {
                    throw new Error(`Google Places API error: ${res.status} ${res.statusText}`);
                }

                const json = await res.json();
                console.log('Google Places API response status:', json.status);

                if (json.status === 'OK' && Array.isArray(json.predictions)) {
                    // Process and enhance suggestions from Google Places
                    const enhancedSuggestions = json.predictions
                        .filter((p: any) => {
                            // Filter for quality locations
                            const hasEstablishment = p.types?.includes('establishment');
                            const hasGeocode = p.types?.includes('geocode');
                            const isPolitical = p.types?.includes('political');
                            const isLocality = p.types?.includes('locality');

                            // Prefer establishments, but allow addresses and localities
                            return hasEstablishment || hasGeocode || (isPolitical && isLocality);
                        })
                        .slice(0, 5) // Limit to 5 high-quality suggestions
                        .map((p: any) => ({
                            place_id: p.place_id,
                            description: p.description,
                            main_text: p.structured_formatting?.main_text || p.description,
                            secondary_text: p.structured_formatting?.secondary_text || '',
                            types: p.types || []
                        }));

                    setSuggestions(enhancedSuggestions);
                    setShowSuggestions(enhancedSuggestions.length > 0);

                    console.log(`Found ${enhancedSuggestions.length} Google Places suggestions`);
                } else if (json.status === 'ZERO_RESULTS') {
                    setSuggestions([]);
                    setShowSuggestions(false);
                    console.log('No Google Places results found');
                } else if (json.status === 'INVALID_REQUEST') {
                    console.error('Invalid Google Places API request:', json.error_message);
                    setError('Invalid location search. Please try different keywords.');
                    setSuggestions([]);
                    setShowSuggestions(false);
                } else if (json.status === 'OVER_QUERY_LIMIT') {
                    console.error('Google Places API quota exceeded');
                    setError('Location search temporarily unavailable. Please try again later.');
                    setSuggestions([]);
                    setShowSuggestions(false);
                } else if (json.status === 'REQUEST_DENIED') {
                    console.error('Google Places API request denied:', json.error_message);
                    setError('Location services not properly configured.');
                    setSuggestions([]);
                    setShowSuggestions(false);
                } else {
                    console.warn('Unexpected Google Places API response:', json.status, json.error_message);
                    setError('Location search encountered an error. Please try again.');
                    setSuggestions([]);
                    setShowSuggestions(false);
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

        const debounceTimer = setTimeout(fetchSuggestions, 300); // Slightly longer debounce

        return () => {
            clearTimeout(debounceTimer);
            controller.abort();
        };
    }, [value]);

    const fetchPlaceDetails = async (placeId: string): Promise<{ address: string; lat?: number; lng?: number } | null> => {
        if (!PLACES_API_KEY) return null;

        try {
            const url = `https://maps.googleapis.com/maps/api/place/details/json?` +
                `place_id=${placeId}` +
                `&key=${PLACES_API_KEY}` +
                `&sessiontoken=${sessionToken}` +
                `&fields=${PLACES_CONFIG.details.fields}`;

            console.log('Fetching place details for place_id:', placeId);
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            });

            if (!res.ok) {
                throw new Error(`Google Places Details API error: ${res.status} ${res.statusText}`);
            }

            const json = await res.json();
            console.log('Place details API response status:', json.status);

            if (json.status === 'OK' && json.result) {
                const result = json.result;

                // Prefer name for businesses, formatted_address for locations
                let displayAddress = result.formatted_address;
                if (result.name && result.types?.includes('establishment')) {
                    displayAddress = `${result.name}, ${result.formatted_address}`;
                }

                const location = result.geometry?.location;

                const placeDetails = {
                    address: displayAddress || result.name,
                    lat: location?.lat,
                    lng: location?.lng
                };

                console.log('Successfully fetched place details:', {
                    name: result.name,
                    address: displayAddress,
                    coordinates: location ? `${location.lat}, ${location.lng}` : 'No coordinates',
                    types: result.types
                });

                return placeDetails;
            } else {
                console.warn('Place details API error:', json.status, json.error_message);
                return null;
            }
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
                // Fallback to the suggestion description
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
        // Google Places API types mapping to Material Icons
        if (types.includes('restaurant') || types.includes('meal_takeaway') || types.includes('meal_delivery')) return 'restaurant';
        if (types.includes('food') || types.includes('bakery') || types.includes('cafe')) return 'local-cafe';
        if (types.includes('bar') || types.includes('night_club') || types.includes('liquor_store')) return 'local-bar';
        if (types.includes('lodging') || types.includes('rv_park')) return 'hotel';
        if (types.includes('shopping_mall') || types.includes('department_store')) return 'shopping-cart';
        if (types.includes('store') || types.includes('clothing_store') || types.includes('shoe_store')) return 'store';
        if (types.includes('gas_station') || types.includes('car_wash')) return 'local-gas-station';
        if (types.includes('hospital') || types.includes('pharmacy') || types.includes('doctor')) return 'local-hospital';
        if (types.includes('school') || types.includes('university') || types.includes('library')) return 'school';
        if (types.includes('gym') || types.includes('spa') || types.includes('beauty_salon')) return 'fitness-center';
        if (types.includes('park') || types.includes('campground') || types.includes('zoo')) return 'park';
        if (types.includes('movie_theater') || types.includes('amusement_park')) return 'movie';
        if (types.includes('church') || types.includes('hindu_temple') || types.includes('mosque')) return 'account-balance';
        if (types.includes('bank') || types.includes('atm') || types.includes('finance')) return 'account-balance-wallet';
        if (types.includes('airport') || types.includes('bus_station') || types.includes('subway_station')) return 'flight';
        if (types.includes('tourist_attraction') || types.includes('museum') || types.includes('art_gallery')) return 'museum';
        if (types.includes('establishment')) return 'business';
        if (types.includes('point_of_interest')) return 'place';
        if (types.includes('street_address') || types.includes('premise')) return 'home';
        if (types.includes('locality') || types.includes('administrative_area_level_1')) return 'location-city';

        // Default fallback
        return 'place';
    };

    return (
        <View style={styles.container}>
            <TextInput
                placeholder={placeholder || 'Search for a location...'}
                value={value}
                onChangeText={(text) => {
                    onChangeText(text);
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
                    {__DEV__ && !PLACES_API_KEY && (
                        <TouchableOpacity
                            onPress={() => {
                                console.log('Google Places API Configuration Check:');
                                console.log('- API Key present:', !!PLACES_API_KEY);
                                console.log('- API Key preview:', PLACES_API_KEY ? `${PLACES_API_KEY.substring(0, 10)}...` : 'Not set');
                                console.log('- Session token:', sessionToken);
                            }}
                            style={styles.debugButton}
                        >
                            <Text style={styles.debugButtonText}>Debug API</Text>
                        </TouchableOpacity>
                    )}
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
                                        name={getLocationIcon(item.types)}
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

            {/* Fallback suggestions when no API key or no results */}
            {!PLACES_API_KEY && value.length === 0 && (
                <LocationSuggestions
                    onSelect={(locationName: string) => {
                        onSelect(locationName);
                        setShowSuggestions(false);
                    }}
                    searchQuery=""
                />
            )}

            {PLACES_API_KEY && suggestions.length === 0 && value.length > 2 && !loading && !error && (
                <LocationSuggestions
                    onSelect={(locationName: string) => {
                        onSelect(`${locationName} (${value})`);
                        setShowSuggestions(false);
                    }}
                    searchQuery={value}
                />
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
    debugButton: {
        marginLeft: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(245,158,11,0.2)',
        borderRadius: 4,
    },
    debugButtonText: {
        color: '#F59E0B',
        fontSize: 11,
        fontWeight: '500',
    },
});