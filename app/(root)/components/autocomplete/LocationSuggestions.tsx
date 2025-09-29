import { useTheme } from '@/lib/context/ThemeContext';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LocationSuggestionsProps {
    onSelect: (locationName: string) => void;
    searchQuery: string;
}

const LocationSuggestions: React.FC<LocationSuggestionsProps> = ({ onSelect, searchQuery }) => {
    const { colors } = useTheme();

    // Common location suggestions based on search query
    const getDefaultSuggestions = () => {
        if (searchQuery.length === 0) {
            return [
                'London, UK',
                'Paris, France',
                'New York, USA',
                'Tokyo, Japan',
                'Sydney, Australia',
                'Berlin, Germany',
                'Amsterdam, Netherlands',
                'Barcelona, Spain'
            ];
        }

        // Filter suggestions based on search query
        const allSuggestions = [
            'London, UK',
            'Los Angeles, USA',
            'Las Vegas, USA',
            'Liverpool, UK',
            'Lyon, France',
            'Lisbon, Portugal',
            'Lima, Peru',
            'Paris, France',
            'Prague, Czech Republic',
            'Portland, USA',
            'Perth, Australia',
            'Phoenix, USA',
            'New York, USA',
            'Naples, Italy',
            'Nashville, USA',
            'Nice, France',
            'Newcastle, UK',
            'Tokyo, Japan',
            'Toronto, Canada',
            'Tel Aviv, Israel',
            'Taipei, Taiwan',
            'Sydney, Australia',
            'Stockholm, Sweden',
            'Singapore',
            'Seoul, South Korea',
            'San Francisco, USA',
            'Berlin, Germany',
            'Barcelona, Spain',
            'Brussels, Belgium',
            'Budapest, Hungary',
            'Bangkok, Thailand',
            'Buenos Aires, Argentina',
            'Amsterdam, Netherlands',
            'Athens, Greece',
            'Auckland, New Zealand',
            'Austin, USA',
            'Adelaide, Australia'
        ];

        const query = searchQuery.toLowerCase();
        return allSuggestions.filter(location =>
            location.toLowerCase().includes(query)
        ).slice(0, 8);
    };

    const suggestions = getDefaultSuggestions();

    if (suggestions.length === 0) {
        return null;
    }

    const styles = StyleSheet.create({
        container: {
            backgroundColor: colors.card,
            borderRadius: 8,
            marginTop: 4,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        suggestion: {
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        lastSuggestion: {
            borderBottomWidth: 0,
        },
        suggestionText: {
            fontSize: 16,
            color: colors.text,
        },
        header: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        headerText: {
            fontSize: 12,
            color: colors.textSecondary,
            fontWeight: '600',
            textTransform: 'uppercase',
        },
    });

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerText}>
                    {searchQuery.length === 0 ? 'Popular Destinations' : 'Suggestions'}
                </Text>
            </View>
            {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                    key={suggestion}
                    style={[
                        styles.suggestion,
                        index === suggestions.length - 1 && styles.lastSuggestion
                    ]}
                    onPress={() => onSelect(suggestion)}
                >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

export default LocationSuggestions;