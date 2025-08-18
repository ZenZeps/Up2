import { useTheme } from '@/lib/context/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface LocationSearchModalProps {
    visible: boolean;
    onClose: () => void;
    onLocationSelect: (location: { name: string; coordinates?: { lat: number; lng: number } }) => void;
}

interface LocationFiltersProps {
    onLocationChange: (location: string) => void;
    onDateChange: (date: Date) => void;
    onProximityChange: (proximity: number) => void;
    locationFilter: string;
    dateFilter: Date;
    proximityFilter: number;
}

// Location search component with proximity filtering
export const LocationSearchModal: React.FC<LocationSearchModalProps> = ({
    visible,
    onClose,
    onLocationSelect
}) => {
    const { colors } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
    const [searchResults, setSearchResults] = useState<Array<{
        name: string;
        coordinates: { lat: number; lng: number };
        distance?: number;
    }>>([]);

    // Popular locations for quick selection
    const popularLocations = [
        { name: 'Sydney CBD', coordinates: { lat: -33.8688, lng: 151.2093 } },
        { name: 'Melbourne CBD', coordinates: { lat: -37.8136, lng: 144.9631 } },
        { name: 'Brisbane CBD', coordinates: { lat: -27.4698, lng: 153.0251 } },
        { name: 'Perth CBD', coordinates: { lat: -31.9505, lng: 115.8605 } },
        { name: 'Adelaide CBD', coordinates: { lat: -34.9285, lng: 138.6007 } },
    ];

    useEffect(() => {
        const getCurrentLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === Location.PermissionStatus.GRANTED) {
                    const location = await Location.getCurrentPositionAsync({});
                    setUserLocation(location);
                }
            } catch (error) {
                console.error('Error getting location:', error);
            }
        };

        if (visible) {
            getCurrentLocation();
        }
    }, [visible]);

    const handleUseCurrentLocation = async () => {
        if (userLocation) {
            try {
                const reverseGeocode = await Location.reverseGeocodeAsync({
                    latitude: userLocation.coords.latitude,
                    longitude: userLocation.coords.longitude,
                });

                const address = reverseGeocode[0];
                const locationName = `${address.city || address.subregion || 'Current Location'}`;

                onLocationSelect({
                    name: locationName,
                    coordinates: {
                        lat: userLocation.coords.latitude,
                        lng: userLocation.coords.longitude
                    }
                });
                onClose();
            } catch (error) {
                console.error('Error reverse geocoding:', error);
                onLocationSelect({
                    name: 'Current Location',
                    coordinates: {
                        lat: userLocation.coords.latitude,
                        lng: userLocation.coords.longitude
                    }
                });
                onClose();
            }
        } else {
            Alert.alert('Location not available', 'Please enable location services to use this feature.');
        }
    };

    // Calculate distance between two coordinates
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const filteredLocations = popularLocations
        .filter(location =>
            location.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .map(location => {
            if (userLocation) {
                const distance = calculateDistance(
                    userLocation.coords.latitude,
                    userLocation.coords.longitude,
                    location.coordinates.lat,
                    location.coordinates.lng
                );
                return { ...location, distance };
            }
            return { ...location, distance: undefined };
        })
        .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onClose}>
                        <MaterialIcons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Select Location</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.modalContent}>
                    {/* Search Bar */}
                    <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MaterialIcons name="search" size={20} color={colors.textSecondary} />
                        <TextInput
                            placeholder="Search for a location..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>

                    {/* Use Current Location */}
                    {userLocation && (
                        <TouchableOpacity
                            style={[styles.currentLocationButton, { backgroundColor: colors.primary }]}
                            onPress={handleUseCurrentLocation}
                        >
                            <MaterialIcons name="my-location" size={20} color="white" />
                            <Text style={styles.currentLocationText}>Use Current Location</Text>
                        </TouchableOpacity>
                    )}

                    {/* Location Results */}
                    <ScrollView style={styles.resultsContainer}>
                        {filteredLocations.map((location, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[styles.locationItem, { borderBottomColor: colors.border }]}
                                onPress={() => {
                                    onLocationSelect(location);
                                    onClose();
                                }}
                            >
                                <View style={styles.locationInfo}>
                                    <MaterialIcons name="place" size={24} color={colors.primary} />
                                    <View style={styles.locationTextContainer}>
                                        <Text style={[styles.locationName, { color: colors.text }]}>
                                            {location.name}
                                        </Text>
                                        {location.distance !== undefined && location.distance !== null && (
                                            <Text style={[styles.locationDistance, { color: colors.textSecondary }]}>
                                                {location.distance.toFixed(1)} km away
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

// Enhanced location filters component
export const LocationFilters: React.FC<LocationFiltersProps> = ({
    onLocationChange,
    onDateChange,
    onProximityChange,
    locationFilter,
    dateFilter,
    proximityFilter
}) => {
    const { colors } = useTheme();
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const proximityOptions = [1, 5, 10, 25, 50, 100];

    const handleLocationSelect = (location: { name: string; coordinates?: { lat: number; lng: number } }) => {
        onLocationChange(location.name);
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            onDateChange(selectedDate);
        }
    };

    return (
        <View style={styles.filtersContainer}>
            {/* Location Filter */}
            <View style={styles.filterSection}>
                <Text style={[styles.filterLabel, { color: colors.text }]}>Location</Text>
                <TouchableOpacity
                    style={[styles.filterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => setShowLocationModal(true)}
                >
                    <MaterialIcons name="place" size={20} color={colors.primary} />
                    <Text style={[styles.filterButtonText, { color: colors.text }]}>
                        {locationFilter || 'Select location'}
                    </Text>
                    <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Date Filter */}
            <View style={styles.filterSection}>
                <Text style={[styles.filterLabel, { color: colors.text }]}>Date</Text>
                <TouchableOpacity
                    style={[styles.filterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => setShowDatePicker(true)}
                >
                    <MaterialIcons name="event" size={20} color={colors.primary} />
                    <Text style={[styles.filterButtonText, { color: colors.text }]}>
                        {dateFilter.toLocaleDateString()}
                    </Text>
                    <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Proximity Filter */}
            {locationFilter && (
                <View style={styles.filterSection}>
                    <Text style={[styles.filterLabel, { color: colors.text }]}>Within</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.proximityScroll}>
                        {proximityOptions.map((distance) => (
                            <TouchableOpacity
                                key={distance}
                                style={[
                                    styles.proximityChip,
                                    {
                                        backgroundColor: proximityFilter === distance ? colors.primary : colors.surface,
                                        borderColor: colors.border
                                    }
                                ]}
                                onPress={() => onProximityChange(distance)}
                            >
                                <Text style={[
                                    styles.proximityChipText,
                                    { color: proximityFilter === distance ? 'white' : colors.text }
                                ]}>
                                    {distance}km
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Location Search Modal */}
            <LocationSearchModal
                visible={showLocationModal}
                onClose={() => setShowLocationModal(false)}
                onLocationSelect={handleLocationSelect}
            />

            {/* Date Picker */}
            {showDatePicker && (
                <DateTimePicker
                    value={dateFilter}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    modalContent: {
        flex: 1,
        padding: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
    },
    currentLocationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    currentLocationText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500',
        marginLeft: 8,
    },
    resultsContainer: {
        flex: 1,
    },
    locationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    locationTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    locationName: {
        fontSize: 16,
        fontWeight: '500',
    },
    locationDistance: {
        fontSize: 14,
        marginTop: 2,
    },
    filtersContainer: {
        padding: 16,
        gap: 16,
    },
    filterSection: {
        gap: 8,
    },
    filterLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    filterButtonText: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
    },
    proximityScroll: {
        flexDirection: 'row',
    },
    proximityChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
    },
    proximityChipText: {
        fontSize: 14,
        fontWeight: '500',
    },
});

export default LocationFilters;
