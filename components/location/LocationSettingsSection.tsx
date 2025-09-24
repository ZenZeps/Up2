import { useLocationPermission } from '@/lib/hooks/useLocationPermission';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function LocationSettingsSection() {
    const {
        requestLocationPermission,
        isLocationPermissionGranted,
        resetLocationPermissionState,
        wasLocationPermissionDenied,
        canAskForLocationAgain,
    } = useLocationPermission();

    const [isLocationEnabled, setIsLocationEnabled] = useState(false);
    const [wasLocationDenied, setWasLocationDenied] = useState(false);
    const [canAskAgain, setCanAskAgain] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    // Load current location permission status
    useEffect(() => {
        loadLocationStatus();
    }, []);

    const loadLocationStatus = async () => {
        try {
            setIsLoading(true);
            const [granted, denied, canAsk] = await Promise.all([
                isLocationPermissionGranted(),
                wasLocationPermissionDenied(),
                canAskForLocationAgain(),
            ]);

            setIsLocationEnabled(granted);
            setWasLocationDenied(denied);
            setCanAskAgain(canAsk);
        } catch (error) {
            console.error('Error loading location status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLocationToggle = async (value: boolean) => {
        if (value) {
            // User wants to enable location
            if (isLocationEnabled) {
                // Already enabled, nothing to do
                return;
            }

            if (wasLocationDenied && !canAskAgain) {
                // User recently denied, suggest settings
                Alert.alert(
                    'Location Permission Required',
                    'To enable location features, please allow location access in your device settings.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Open Settings',
                            onPress: () => Linking.openSettings(),
                        },
                    ]
                );
                return;
            }

            // Request permission with settings context
            const result = await requestLocationPermission('settings');

            if (result.granted) {
                setIsLocationEnabled(true);
                setWasLocationDenied(false);
                Alert.alert(
                    'Location Enabled! 🎯',
                    'You can now discover events near you and get travel recommendations.',
                    [{ text: 'Great!' }]
                );
            } else {
                setIsLocationEnabled(false);
                setWasLocationDenied(true);
            }
        } else {
            // User wants to disable location - show info about what they'll lose
            Alert.alert(
                'Disable Location Features?',
                'You\'ll lose access to:\n• Nearby event recommendations\n• Travel destination discovery\n• Location-aware TopPicks\n\nYou can re-enable this anytime.',
                [
                    { text: 'Keep Enabled', style: 'cancel' },
                    {
                        text: 'Disable',
                        style: 'destructive',
                        onPress: () => {
                            // We can't actually revoke permissions, but we can reset our tracking
                            resetLocationPermissionState();
                            setIsLocationEnabled(false);
                            setWasLocationDenied(false);
                            Alert.alert(
                                'Location Features Disabled',
                                'You can re-enable location features anytime from Settings.'
                            );
                        },
                    },
                ]
            );
        }
    };

    const handleOpenAppSettings = () => {
        Alert.alert(
            'Open Device Settings',
            'This will open your device settings where you can manage location permissions for Up2.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Open Settings',
                    onPress: () => Linking.openSettings(),
                },
            ]
        );
    };

    const handleResetLocationState = () => {
        Alert.alert(
            'Reset Location Settings',
            'This will reset all location permission preferences and allow you to set up location features again.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    onPress: async () => {
                        await resetLocationPermissionState();
                        await loadLocationStatus();
                        Alert.alert(
                            'Location Settings Reset',
                            'Location preferences have been reset. You can now set up location features again.'
                        );
                    },
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <View className="bg-white rounded-xl p-4 mb-4">
                <View className="flex-row items-center">
                    <MaterialIcons name="location-on" size={24} color="#6B7280" />
                    <Text className="text-gray-700 font-rubik-semibold text-lg ml-3">
                        Loading location settings...
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View className="bg-white rounded-xl p-4 mb-4">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center flex-1">
                    <MaterialIcons
                        name="location-on"
                        size={24}
                        color={isLocationEnabled ? "#10B981" : "#6B7280"}
                    />
                    <View className="ml-3 flex-1">
                        <Text className="text-gray-900 font-rubik-semibold text-lg">
                            Location Services
                        </Text>
                        <Text className="text-gray-600 font-rubik text-sm">
                            {isLocationEnabled
                                ? 'Enabled - Get personalized recommendations'
                                : 'Disabled - Limited event discovery'
                            }
                        </Text>
                    </View>
                </View>
                <Switch
                    value={isLocationEnabled}
                    onValueChange={handleLocationToggle}
                    trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                    thumbColor={isLocationEnabled ? '#ffffff' : '#ffffff'}
                />
            </View>

            {/* Feature Cards */}
            <View className="space-y-3 mb-4">
                <View className={`p-3 rounded-lg border ${isLocationEnabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    <View className="flex-row items-center">
                        <MaterialIcons
                            name="near-me"
                            size={20}
                            color={isLocationEnabled ? "#10B981" : "#9CA3AF"}
                        />
                        <Text className={`ml-2 font-rubik-medium ${isLocationEnabled ? 'text-green-800' : 'text-gray-600'}`}>
                            Nearby Events & TopPicks
                        </Text>
                    </View>
                </View>

                <View className={`p-3 rounded-lg border ${isLocationEnabled ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                    <View className="flex-row items-center">
                        <MaterialIcons
                            name="travel-explore"
                            size={20}
                            color={isLocationEnabled ? "#3B82F6" : "#9CA3AF"}
                        />
                        <Text className={`ml-2 font-rubik-medium ${isLocationEnabled ? 'text-blue-800' : 'text-gray-600'}`}>
                            Travel Destination Discovery
                        </Text>
                    </View>
                </View>
            </View>

            {/* Action Buttons */}
            <View className="space-y-2">
                {!isLocationEnabled && wasLocationDenied && (
                    <TouchableOpacity
                        onPress={handleOpenAppSettings}
                        className="bg-blue-500 py-3 rounded-lg"
                    >
                        <Text className="text-white text-center font-rubik-semibold">
                            Open Device Settings
                        </Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={handleResetLocationState}
                    className="border border-gray-300 py-3 rounded-lg"
                >
                    <Text className="text-gray-700 text-center font-rubik-medium">
                        Reset Location Preferences
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Info Footer */}
            <View className="mt-4 p-3 bg-gray-50 rounded-lg">
                <View className="flex-row items-start">
                    <MaterialIcons name="info" size={16} color="#6B7280" />
                    <Text className="text-gray-600 text-xs font-rubik ml-2 flex-1">
                        Location data is only used to show relevant events and stays on your device.
                        We never share your location with other users.
                    </Text>
                </View>
            </View>
        </View>
    );
}
