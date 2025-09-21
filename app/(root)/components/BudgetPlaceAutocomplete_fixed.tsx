import { budgetLocationService, FreeLocationSuggestion } from '@/lib/services/budgetLocationService';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
    value: string;
    onChangeText: (v: string) => void;
    onSelect: (address: string, lat?: number, lng?: number) => void;
    placeholder?: string;
}

export default function BudgetPlaceAutocomplete({ value, onChangeText, onSelect, placeholder }: Props) {
    const [suggestions, setSuggestions] = useState<FreeLocationSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                const results = await budgetLocationService.searchLocations(value.trim());
                setSuggestions(results);
                setShowSuggestions(results.length > 0);

                if (results.length === 0) {
                    setError('No locations found. Try a different search term.');
                }
            } catch (e: any) {
                console.error('Budget location search error:', e);
                setError('Unable to search locations. Please check your internet connection.');
                setSuggestions([]);
                setShowSuggestions(false);
            } finally {
                setLoading(false);
            }
        };

        const debounceTimer = setTimeout(fetchSuggestions, 400); // Longer debounce to reduce requests

        return () => {
            clearTimeout(debounceTimer);
            controller.abort();
        };
    }, [value]);

    const handleSuggestionPress = (suggestion: FreeLocationSuggestion) => {
        setShowSuggestions(false);
        setSuggestions([]);

        // For fallback suggestions without coordinates, just use the name
        if (suggestion.lat === 0 && suggestion.lng === 0) {
            onSelect(suggestion.name);
        } else {
            onSelect(suggestion.address, suggestion.lat, suggestion.lng);
        }

        setError(null);
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
                    <Text style={styles.loadingText}>Searching free location database...</Text>
                </View>
            )}

            {error && (
                <View style={styles.errorContainer}>
                    <MaterialIcons name="info" size={16} color="#F59E0B" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {showSuggestions && suggestions.length > 0 && !loading && (
                <View style={styles.suggestionsContainer}>
                    <View style={styles.suggestionHeader}>
                        <MaterialIcons name="location-on" size={16} color="#6b7280" />
                        <Text style={styles.suggestionHeaderText}>
                            {suggestions.some(s => s.lat !== 0) ? 'OpenStreetMap Results' : 'Suggested Locations'}
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowSuggestions(false)}
                            style={styles.closeButton}
                        >
                            <MaterialIcons name="close" size={16} color="#9ca3af" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={suggestions}
                        keyExtractor={(item) => item.id}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                        renderItem={({ item, index }) => (
                            <TouchableOpacity
                                onPress={() => handleSuggestionPress(item)}
                                style={[
                                    styles.suggestionItem,
                                    index === suggestions.length - 1 && styles.lastSuggestionItem
                                ]}
                                activeOpacity={0.7}
                            >
                                <MaterialIcons
                                    name={item.icon as any}
                                    size={18}
                                    color="#6b7280"
                                    style={styles.suggestionIcon}
                                />
                                <View style={styles.suggestionTextContainer}>
                                    <Text style={styles.suggestionMainText} numberOfLines={1}>
                                        {item.name}
                                    </Text>
                                    <Text style={styles.suggestionSecondaryText} numberOfLines={1}>
                                        {item.address}
                                    </Text>
                                    {item.lat !== 0 && item.lng !== 0 && (
                                        <View style={styles.coordinatesContainer}>
                                            <MaterialIcons name="my-location" size={12} color="#10B981" />
                                            <Text style={styles.coordinatesText}>
                                                GPS: {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <MaterialIcons
                                    name="arrow-forward-ios"
                                    size={12}
                                    color="#9ca3af"
                                />
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}

            {/* Cost savings indicator */}
            {__DEV__ && (
                <View style={styles.budgetIndicator}>
                    <MaterialIcons name="savings" size={14} color="#10B981" />
                    <Text style={styles.budgetText}>
                        Using FREE OpenStreetMap • No API costs
                    </Text>
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
        fontSize: 13,
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
        color: '#F59E0B',
        fontSize: 13,
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
        maxHeight: 250,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 1000,
    },
    suggestionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
        backgroundColor: '#f8fafc',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    suggestionHeaderText: {
        color: '#374151',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
        flex: 1,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    closeButton: {
        padding: 4,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    lastSuggestionItem: {
        borderBottomWidth: 0,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    suggestionIcon: {
        marginRight: 12,
        marginTop: 2,
    },
    suggestionTextContainer: {
        flex: 1,
        marginRight: 8,
    },
    suggestionMainText: {
        color: '#1f2937',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 3,
    },
    suggestionSecondaryText: {
        color: '#6b7280',
        fontSize: 13,
        fontWeight: '400',
        marginBottom: 4,
    },
    coordinatesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    coordinatesText: {
        color: '#10B981',
        fontSize: 11,
        marginLeft: 4,
        fontWeight: '500',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.08)',
        marginHorizontal: 16,
    },
    budgetIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(16,185,129,0.1)',
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    budgetText: {
        color: '#10B981',
        fontSize: 11,
        marginLeft: 4,
        fontWeight: '500',
    },
});
