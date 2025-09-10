import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PlaceAutocomplete from '../(root)/components/PlaceAutocomplete';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

export default function GooglePlacesTest() {
    const [selectedLocation, setSelectedLocation] = useState('');
    const [locationCoordinates, setLocationCoordinates] = useState<{ lat?: number; lng?: number }>({});
    const [testLocation, setTestLocation] = useState('');

    const runAPITest = async () => {
        if (!GOOGLE_PLACES_API_KEY) {
            Alert.alert('API Key Missing', 'Please set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in your environment variables.');
            return;
        }

        try {
            const testUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Starbucks&types=establishment&key=${GOOGLE_PLACES_API_KEY}`;
            const response = await fetch(testUrl);
            const result = await response.json();

            Alert.alert(
                'Google Places API Test',
                `Status: ${result.status}\nResults: ${result.predictions?.length || 0} locations found`,
                [{ text: 'OK' }]
            );
        } catch (error) {
            Alert.alert('API Test Failed', `Error: ${error}`);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <MaterialIcons name="location-on" size={32} color="#4ECDC4" />
                <Text style={styles.title}>Google Places API Test</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>API Configuration</Text>
                <View style={styles.configItem}>
                    <Text style={styles.configLabel}>API Key Status:</Text>
                    <Text style={[styles.configValue, { color: GOOGLE_PLACES_API_KEY ? '#10B981' : '#EF4444' }]}>
                        {GOOGLE_PLACES_API_KEY ? 'Configured' : 'Missing'}
                    </Text>
                </View>

                {GOOGLE_PLACES_API_KEY && (
                    <View style={styles.configItem}>
                        <Text style={styles.configLabel}>API Key Preview:</Text>
                        <Text style={styles.configValue}>
                            {`${GOOGLE_PLACES_API_KEY.substring(0, 10)}...`}
                        </Text>
                    </View>
                )}

                <TouchableOpacity onPress={runAPITest} style={styles.testButton}>
                    <MaterialIcons name="play-arrow" size={20} color="#fff" />
                    <Text style={styles.testButtonText}>Test API Connection</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Location Autocomplete Test</Text>
                <PlaceAutocomplete
                    value={testLocation}
                    onChangeText={setTestLocation}
                    onSelect={(address: string, lat?: number, lng?: number) => {
                        setSelectedLocation(address);
                        setLocationCoordinates({ lat, lng });
                        Alert.alert(
                            'Location Selected',
                            `Address: ${address}\nCoordinates: ${lat ? `${lat}, ${lng}` : 'Not available'}`
                        );
                    }}
                    placeholder="Try typing 'Starbucks' or 'Central Park'..."
                />
            </View>

            {selectedLocation && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Last Selected Location</Text>
                    <View style={styles.resultCard}>
                        <MaterialIcons name="place" size={24} color="#4ECDC4" style={styles.resultIcon} />
                        <View style={styles.resultContent}>
                            <Text style={styles.resultAddress}>{selectedLocation}</Text>
                            {locationCoordinates.lat && locationCoordinates.lng ? (
                                <Text style={styles.resultCoordinates}>
                                    📍 {locationCoordinates.lat.toFixed(6)}, {locationCoordinates.lng.toFixed(6)}
                                </Text>
                            ) : (
                                <Text style={styles.resultNoCoordinates}>No coordinates available</Text>
                            )}
                        </View>
                    </View>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Setup Instructions</Text>
                <Text style={styles.instructionText}>
                    1. Get a Google Places API key from Google Cloud Console{'\n'}
                    2. Enable Places API in your project{'\n'}
                    3. Set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY environment variable{'\n'}
                    4. Restart your development server
                </Text>

                {!GOOGLE_PLACES_API_KEY && (
                    <View style={styles.warningCard}>
                        <MaterialIcons name="warning" size={20} color="#F59E0B" />
                        <Text style={styles.warningText}>
                            Google Places API key not configured. Location suggestions will use fallback data.
                        </Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1F2937',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
        paddingVertical: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 10,
    },
    section: {
        marginBottom: 30,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 15,
    },
    configItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    configLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
    },
    configValue: {
        fontSize: 14,
        fontWeight: '500',
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4ECDC4',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginTop: 15,
    },
    testButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
        marginLeft: 8,
    },
    resultCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: 15,
    },
    resultIcon: {
        marginRight: 12,
        marginTop: 2,
    },
    resultContent: {
        flex: 1,
    },
    resultAddress: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 5,
    },
    resultCoordinates: {
        color: '#10B981',
        fontSize: 14,
    },
    resultNoCoordinates: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        fontStyle: 'italic',
    },
    instructionText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        lineHeight: 20,
    },
    warningCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245,158,11,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.3)',
        borderRadius: 8,
        padding: 12,
        marginTop: 15,
    },
    warningText: {
        color: '#F59E0B',
        fontSize: 13,
        marginLeft: 8,
        flex: 1,
    },
});
