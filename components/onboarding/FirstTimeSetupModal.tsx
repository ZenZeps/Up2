import { useTheme } from '@/lib/context/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface FirstTimeSetupModalProps {
    visible: boolean;
    userId: string;
    onComplete: () => void;
}

const FirstTimeSetupModal: React.FC<FirstTimeSetupModalProps> = ({
    visible,
    userId,
    onComplete,
}) => {
    const { colors } = useTheme();
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const steps = [
        {
            title: 'Welcome to Up2!',
            description: 'Let\'s set up a few things to give you the best experience.',
            icon: 'celebration',
            action: () => setCurrentStep(1),
            buttonText: 'Get Started'
        },
        {
            title: 'Enable Notifications',
            description: 'Stay updated on event invites, friend requests, and reminders.',
            icon: 'notifications',
            action: handleNotificationPermission,
            buttonText: 'Enable Notifications'
        },
        {
            title: 'Allow Location Access',
            description: 'Find events near you and get location-based recommendations.',
            icon: 'location-on',
            action: handleLocationPermission,
            buttonText: 'Enable Location'
        }
    ];

    async function handleNotificationPermission() {
        try {
            setIsLoading(true);

            const { status } = await Notifications.requestPermissionsAsync();

            if (status === 'granted') {
                // Set default notification preferences
                await AsyncStorage.multiSet([
                    [`notifications_enabled_${userId}`, 'true'],
                    [`event_reminders_${userId}`, 'true'],
                    [`friend_requests_${userId}`, 'true'],
                    [`group_invites_${userId}`, 'true'],
                    [`event_invites_${userId}`, 'true']
                ]);

                Alert.alert('Great!', 'Notifications are now enabled. You can customize them later in settings.');
            } else {
                Alert.alert(
                    'Notifications Disabled',
                    'You can enable notifications later in your device settings or in the app settings.',
                    [{ text: 'OK' }]
                );
            }

            setCurrentStep(2);
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            Alert.alert('Error', 'Failed to setup notifications. You can try again later in settings.');
            setCurrentStep(2);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleLocationPermission() {
        try {
            setIsLoading(true);

            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status === 'granted') {
                Alert.alert('Perfect!', 'Location access enabled. We\'ll use this to show you nearby events.');
            } else {
                Alert.alert(
                    'Location Disabled',
                    'You can enable location access later in your device settings to see nearby events.',
                    [{ text: 'OK' }]
                );
            }

            // Mark first-time setup as complete
            await AsyncStorage.setItem(`first_time_setup_${userId}`, 'true');
            onComplete();
        } catch (error) {
            console.error('Error requesting location permission:', error);
            Alert.alert('Error', 'Failed to setup location access. You can try again later in settings.');
            // Still mark as complete to avoid blocking the user
            await AsyncStorage.setItem(`first_time_setup_${userId}`, 'true');
            onComplete();
        } finally {
            setIsLoading(false);
        }
    }

    const handleSkip = async () => {
        if (currentStep === 0) {
            setCurrentStep(1);
        } else if (currentStep === 1) {
            setCurrentStep(2);
        } else {
            // Skip location and complete setup
            await AsyncStorage.setItem(`first_time_setup_${userId}`, 'true');
            onComplete();
        }
    };

    const currentStepData = steps[currentStep];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
        >
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.content}>
                    {/* Progress indicator */}
                    <View style={styles.progressContainer}>
                        {steps.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.progressDot,
                                    {
                                        backgroundColor: index <= currentStep
                                            ? colors.primary
                                            : colors.border
                                    }
                                ]}
                            />
                        ))}
                    </View>

                    {/* Icon */}
                    <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}20` }]}>
                        <MaterialIcons
                            name={currentStepData.icon as any}
                            size={64}
                            color={colors.primary}
                        />
                    </View>

                    {/* Title */}
                    <Text style={[styles.title, { color: colors.text }]}>
                        {currentStepData.title}
                    </Text>

                    {/* Description */}
                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        {currentStepData.description}
                    </Text>

                    {/* Action Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                            onPress={currentStepData.action}
                            disabled={isLoading}
                        >
                            <Text style={styles.primaryButtonText}>
                                {isLoading ? 'Setting up...' : currentStepData.buttonText}
                            </Text>
                        </TouchableOpacity>

                        {currentStep > 0 && (
                            <TouchableOpacity
                                style={[styles.secondaryButton, { borderColor: colors.border }]}
                                onPress={handleSkip}
                                disabled={isLoading}
                            >
                                <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                                    {currentStep === 2 ? 'Skip for now' : 'Skip'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    progressContainer: {
        flexDirection: 'row',
        marginBottom: 48,
        gap: 8,
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16,
        fontFamily: 'Rubik-ExtraBold',
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 48,
        fontFamily: 'Rubik-Regular',
    },
    buttonContainer: {
        width: '100%',
        gap: 16,
    },
    primaryButton: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Rubik-SemiBold',
    },
    secondaryButton: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'Rubik-Medium',
    },
});

export default FirstTimeSetupModal;