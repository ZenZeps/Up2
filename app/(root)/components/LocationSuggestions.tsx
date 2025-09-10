import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LocationSuggestion {
    id: string;
    name: string;
    description: string;
    type: 'venue' | 'area' | 'landmark';
    icon: string;
}

// Popular location suggestions as fallback
const POPULAR_LOCATIONS: LocationSuggestion[] = [
    { id: '1', name: 'Coffee Shop', description: 'Local coffee shop or café', type: 'venue', icon: 'local-cafe' },
    { id: '2', name: 'Restaurant', description: 'Restaurant or dining venue', type: 'venue', icon: 'restaurant' },
    { id: '3', name: 'Park', description: 'Public park or recreational area', type: 'venue', icon: 'park' },
    { id: '4', name: 'Library', description: 'Public or university library', type: 'venue', icon: 'local-library' },
    { id: '5', name: 'Community Center', description: 'Local community center', type: 'venue', icon: 'business' },
    { id: '6', name: 'Shopping Center', description: 'Mall or shopping district', type: 'venue', icon: 'shopping-cart' },
    { id: '7', name: 'Downtown', description: 'City center or downtown area', type: 'area', icon: 'location-city' },
    { id: '8', name: 'University Campus', description: 'College or university campus', type: 'area', icon: 'school' },
    { id: '9', name: 'Beach', description: 'Beach or waterfront area', type: 'landmark', icon: 'beach-access' },
    { id: '10', name: 'Sports Complex', description: 'Athletic facility or gym', type: 'venue', icon: 'fitness-center' },
];

interface Props {
    onSelect: (locationName: string) => void;
    searchQuery: string;
}

export default function LocationSuggestions({ onSelect, searchQuery }: Props) {
    // Filter suggestions based on search query
    const filteredSuggestions = POPULAR_LOCATIONS.filter(location =>
        !searchQuery ||
        location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        location.description.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);

    if (filteredSuggestions.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.noSuggestionsContainer}>
                    <MaterialIcons name="location-off" size={24} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.noSuggestionsText}>
                        No location suggestions available
                    </Text>
                    <Text style={styles.noSuggestionsSubtext}>
                        You can still enter a location manually
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <MaterialIcons name="location-on" size={16} color="rgba(255,255,255,0.7)" />
                <Text style={styles.headerText}>Popular locations</Text>
            </View>

            <FlatList
                data={filteredSuggestions}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item, index }) => (
                    <TouchableOpacity
                        onPress={() => onSelect(item.name)}
                        style={[
                            styles.suggestionItem,
                            index === filteredSuggestions.length - 1 && styles.lastSuggestionItem
                        ]}
                        activeOpacity={0.7}
                    >
                        <MaterialIcons
                            name={item.icon as any}
                            size={18}
                            color="rgba(255,255,255,0.7)"
                            style={styles.suggestionIcon}
                        />
                        <View style={styles.suggestionTextContainer}>
                            <Text style={styles.suggestionMainText}>
                                {item.name}
                            </Text>
                            <Text style={styles.suggestionSecondaryText}>
                                {item.description}
                            </Text>
                        </View>
                        <MaterialIcons
                            name="arrow-forward-ios"
                            size={12}
                            color="rgba(255,255,255,0.4)"
                        />
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(0,0,0,0.9)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        maxHeight: 220,
        marginTop: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '500',
        marginLeft: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    lastSuggestionItem: {
        borderBottomWidth: 0,
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
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 2,
    },
    suggestionSecondaryText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: '400',
    },
    noSuggestionsContainer: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 20,
    },
    noSuggestionsText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 8,
    },
    noSuggestionsSubtext: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
    },
});
