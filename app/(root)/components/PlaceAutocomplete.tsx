import { useTheme } from '@/lib/context/ThemeContext';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Suggestion {
    place_id: string;
    description: string;
}

interface Props {
    value: string;
    onChangeText: (v: string) => void;
    onSelect: (address: string, lat?: number, lng?: number) => void;
    placeholder?: string;
}

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

export default function PlaceAutocomplete({ value, onChangeText, onSelect, placeholder }: Props) {
    const { colors } = useTheme();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        const fetchSuggestions = async () => {
            if (!PLACES_API_KEY || !value || value.trim().length < 3) {
                setSuggestions([]);
                return;
            }

            setLoading(true);
            try {
                const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
                    value
                )}&types=address&key=${PLACES_API_KEY}`;

                const res = await fetch(url, { signal: controller.signal });
                const json = await res.json();

                if (json && Array.isArray(json.predictions)) {
                    setSuggestions(json.predictions.map((p: any) => ({ place_id: p.place_id, description: p.description })));
                } else {
                    setSuggestions([]);
                }
            } catch (e) {
                // Ignore autocomplete errors silently
                setSuggestions([]);
            } finally {
                setLoading(false);
            }
        };

        const t = setTimeout(fetchSuggestions, 250); // Debounce
        return () => {
            clearTimeout(t);
            controller.abort();
        };
    }, [value]);

    const fetchPlaceDetails = async (placeId: string) => {
        if (!PLACES_API_KEY) return null;
        try {
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${PLACES_API_KEY}&fields=formatted_address,geometry`;
            const res = await fetch(url);
            const json = await res.json();
            if (json && json.result) {
                const addr = json.result.formatted_address as string;
                const loc = json.result.geometry?.location;
                return { address: addr, lat: loc?.lat, lng: loc?.lng };
            }
        } catch (e) {
            return null;
        }
        return null;
    };

    return (
        <View>
            <TextInput
                placeholder={placeholder || 'Location'}
                value={value}
                onChangeText={onChangeText}
                style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8, paddingHorizontal: 6 }}
            />

            {loading && <ActivityIndicator style={{ marginTop: 6 }} />}

            {suggestions.length > 0 && (
                <FlatList
                    data={suggestions}
                    keyExtractor={(item) => item.place_id}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={async () => {
                                const details = await fetchPlaceDetails(item.place_id);
                                if (details) {
                                    onSelect(details.address, details.lat, details.lng);
                                } else {
                                    onSelect(item.description);
                                }
                                setSuggestions([]);
                            }}
                            style={{ paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                        >
                            <Text>{item.description}</Text>
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}
