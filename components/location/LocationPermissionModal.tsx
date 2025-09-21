import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
    Alert,
    Linking,
    Modal,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface LocationPermissionModalProps {
    visible: boolean;
    onPermissionResult: (granted: boolean) => void;
    onClose: () => void;
    context?: 'startup' | 'toppicks' | 'travel' | 'settings';
}

export default function LocationPermissionModal({
    visible,
    onPermissionResult,
    onClose,
    context = 'startup'
}: LocationPermissionModalProps) {
    const [isRequesting, setIsRequesting] = useState(false);

    const getContextContent = () => {
        switch (context) {
            case 'toppicks':
                return {
                    title: 'Get Personalized Event Recommendations',
                    subtitle: 'TopPicks uses your location to suggest the best nearby events',
                    examples: [
                        'Find events within walking distance',
                        'Discover popular spots in your area',
                        'Get recommendations based on your neighborhood'
                    ]
                };
            case 'travel':
                return {
                    title: 'Plan Your Travel Adventures',
                    subtitle: 'Find events at your destination before you arrive',
                    examples: [
                        'Traveling to Sydney? Find events Nov 24-30',
                        'Discover local experiences at any location',
                        'Plan your itinerary with location-specific events'
                    ]
                };
            case 'settings':
                return {
                    title: 'Manage Location Features',
                    subtitle: 'Enable location services to unlock these features',
                    examples: [
                        'Location-aware event recommendations',
                        'Travel destination event discovery',
                        'Nearby events and venues'
                    ]
                };
            default:
                return {
                    title: 'Unlock Location-Based Features',
                    subtitle: 'Get the most out of Up2 with location services',
                    examples: [
                        'Find events happening near you',
                        'Get travel recommendations for any city',
                        'Discover what\'s popular in your area'
                    ]
                };
        }
    };

    const content = getContextContent();

    const handleRequestPermission = async () => {
        setIsRequesting(true);

        try {
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status === 'granted') {
                onPermissionResult(true);
                Alert.alert(
                    'Location Enabled! 🎯',
                    'You\'ll now see personalized recommendations and can discover events anywhere you travel.',
                    [{ text: 'Great!', onPress: onClose }]
                );
            } else {
                // Permission denied
                onPermissionResult(false);
                Alert.alert(
                    'Location Permission Needed',
                    'To use location features, you can enable location access in your device settings.',
                    [
                        { text: 'Maybe Later', style: 'cancel', onPress: onClose },
                        {
                            text: 'Open Settings',
                            onPress: () => {
                                Linking.openSettings();
                                onClose();
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Error requesting location permission:', error);
            onPermissionResult(false);
            Alert.alert(
                'Error',
                'Unable to request location permission. Please try again.',
                [{ text: 'OK', onPress: onClose }]
            );
        } finally {
            setIsRequesting(false);
        }
    };

    const handleSkip = () => {
        onPermissionResult(false);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-white">
                {/* Header */}
                <View className="bg-gradient-to-r from-blue-500 to-purple-600 pt-12 pb-8 px-6">
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="w-8" />
                        <MaterialIcons name="location-on" size={48} color="white" />
                        <TouchableOpacity onPress={onClose} className="w-8">
                            <MaterialIcons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    <Text className="text-white text-2xl font-rubik-bold text-center mb-2">
                        {content.title}
                    </Text>
                    <Text className="text-white/90 text-center font-rubik-medium">
                        {content.subtitle}
                    </Text>
                </View>

                <ScrollView className="flex-1 px-6 py-6">
                    {/* Feature Cards */}
                    <View className="space-y-4 mb-8">
                        {content.examples.map((example, index) => (
                            <View
                                key={index}
                                className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 flex-row items-center"
                            >
                                <View className="bg-blue-500 rounded-full p-2 mr-4">
                                    <MaterialIcons
                                        name={index === 0 ? "near-me" : index === 1 ? "travel-explore" : "map"}
                                        size={20}
                                        color="white"
                                    />
                                </View>
                                <Text className="flex-1 text-gray-800 font-rubik-medium">
                                    {example}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Example Use Case */}
                    <View className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 mb-8">
                        <View className="flex-row items-center mb-3">
                            <MaterialIcons name="lightbulb" size={24} color="#10B981" />
                            <Text className="text-emerald-800 font-rubik-bold text-lg ml-2">
                                Real Example
                            </Text>
                        </View>
                        <Text className="text-emerald-700 font-rubik-medium">
                            Planning a trip to Sydney from November 24-30? With location services,
                            you can instantly discover concerts, food festivals, and local events
                            happening during your visit - all before you even arrive!
                        </Text>
                    </View>

                    {/* Privacy Notice */}
                    <View className="bg-gray-50 rounded-xl p-4 mb-6">
                        <View className="flex-row items-center mb-2">
                            <MaterialIcons name="privacy-tip" size={20} color="#6B7280" />
                            <Text className="text-gray-700 font-rubik-semibold ml-2">
                                Your Privacy
                            </Text>
                        </View>
                        <Text className="text-gray-600 font-rubik text-sm">
                            We only use your location to show relevant events. Your location data
                            stays on your device and is never shared with other users.
                        </Text>
                    </View>
                </ScrollView>

                {/* Action Buttons */}
                <View className="px-6 pb-8 pt-4 border-t border-gray-100">
                    <TouchableOpacity
                        onPress={handleRequestPermission}
                        disabled={isRequesting}
                        className={`py-4 rounded-xl mb-3 ${isRequesting
                                ? 'bg-gray-300'
                                : 'bg-gradient-to-r from-blue-500 to-purple-600'
                            }`}
                    >
                        <Text className="text-white text-center font-rubik-bold text-lg">
                            {isRequesting ? 'Requesting...' : 'Enable Location Services'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleSkip}
                        disabled={isRequesting}
                        className="py-3"
                    >
                        <Text className="text-gray-600 text-center font-rubik-medium">
                            Skip for Now
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
