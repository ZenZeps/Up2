import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const LOCATION_PERMISSION_ASKED_KEY = 'location_permission_asked';
const LOCATION_PERMISSION_DENIED_KEY = 'location_permission_denied';

export interface LocationServiceConfig {
    showPermissionModal: (context: 'startup' | 'toppicks' | 'travel' | 'settings') => Promise<boolean>;
}

class LocationService {
    private config: LocationServiceConfig | null = null;

    configure(config: LocationServiceConfig) {
        this.config = config;
    }

    /**
     * Check if we should show the permission onboarding
     */
    async shouldShowLocationOnboarding(): Promise<boolean> {
        try {
            // Check current permission status
            const { status } = await Location.getForegroundPermissionsAsync();

            // If already granted, no need to show onboarding
            if (status === 'granted') {
                return false;
            }

            // Check if user has been asked before
            const hasBeenAsked = await AsyncStorage.getItem(LOCATION_PERMISSION_ASKED_KEY);

            // Show onboarding if first time user
            return hasBeenAsked === null;
        } catch (error) {
            console.error('Error checking location onboarding status:', error);
            return false;
        }
    }

    /**
     * Request location permission with enhanced UX
     */
    async requestLocationPermission(context: 'startup' | 'toppicks' | 'travel' | 'settings' = 'startup'): Promise<{
        granted: boolean;
        location?: { latitude: number; longitude: number };
    }> {
        try {
            // Check current status first
            const { status: currentStatus } = await Location.getForegroundPermissionsAsync();

            if (currentStatus === 'granted') {
                // Already have permission, get location
                const location = await this.getCurrentLocation();
                return { granted: true, location: location || undefined };
            }

            // Mark that we've asked for permission
            await AsyncStorage.setItem(LOCATION_PERMISSION_ASKED_KEY, 'true');

            // If we have a configured modal handler, use it
            if (this.config?.showPermissionModal) {
                const userAccepted = await this.config.showPermissionModal(context);

                if (userAccepted) {
                    const location = await this.getCurrentLocation();
                    return { granted: true, location: location || undefined };
                } else {
                    await AsyncStorage.setItem(LOCATION_PERMISSION_DENIED_KEY, Date.now().toString());
                    return { granted: false };
                }
            }

            // Fallback: direct permission request (legacy behavior)
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status === 'granted') {
                const location = await this.getCurrentLocation();
                return { granted: true, location: location || undefined };
            } else {
                await AsyncStorage.setItem(LOCATION_PERMISSION_DENIED_KEY, Date.now().toString());
                return { granted: false };
            }

        } catch (error) {
            console.error('Error requesting location permission:', error);
            return { granted: false };
        }
    }

    /**
     * Get current location if permission is granted
     */
    async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();

            if (status !== 'granted') {
                return null;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 10000, // 10 seconds
            });

            return {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };
        } catch (error) {
            console.error('Error getting current location:', error);
            return null;
        }
    }

    /**
     * Check if location permission is currently granted
     */
    async isLocationPermissionGranted(): Promise<boolean> {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            return status === 'granted';
        } catch (error) {
            console.error('Error checking location permission:', error);
            return false;
        }
    }

    /**
     * Check if user previously denied permission
     */
    async wasLocationPermissionDenied(): Promise<boolean> {
        try {
            const deniedTimestamp = await AsyncStorage.getItem(LOCATION_PERMISSION_DENIED_KEY);
            return deniedTimestamp !== null;
        } catch (error) {
            console.error('Error checking location denial status:', error);
            return false;
        }
    }

    /**
     * Reset location permission state (useful for testing or settings reset)
     */
    async resetLocationPermissionState(): Promise<void> {
        try {
            await AsyncStorage.multiRemove([
                LOCATION_PERMISSION_ASKED_KEY,
                LOCATION_PERMISSION_DENIED_KEY
            ]);
        } catch (error) {
            console.error('Error resetting location permission state:', error);
        }
    }

    /**
     * Get time since user denied location permission
     */
    async getTimeSinceLocationDenied(): Promise<number | null> {
        try {
            const deniedTimestamp = await AsyncStorage.getItem(LOCATION_PERMISSION_DENIED_KEY);
            if (!deniedTimestamp) return null;

            return Date.now() - parseInt(deniedTimestamp, 10);
        } catch (error) {
            console.error('Error getting time since location denied:', error);
            return null;
        }
    }

    /**
     * Check if enough time has passed to ask for location permission again
     * (e.g., after 24 hours, or 7 days)
     */
    async canAskForLocationAgain(cooldownMs: number = 24 * 60 * 60 * 1000): Promise<boolean> {
        try {
            const timeSinceDenied = await this.getTimeSinceLocationDenied();
            if (timeSinceDenied === null) return true; // Never denied, can ask

            return timeSinceDenied > cooldownMs;
        } catch (error) {
            console.error('Error checking location ask cooldown:', error);
            return false;
        }
    }
}

// Export singleton instance
export const locationService = new LocationService();
