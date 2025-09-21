import { useCallback, useState } from 'react';
import { locationService } from '../services/locationService';

export function useLocationPermission() {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalContext, setModalContext] = useState<'startup' | 'toppicks' | 'travel' | 'settings'>('startup');
    const [permissionResult, setPermissionResult] = useState<{
        granted: boolean;
        location?: { latitude: number; longitude: number };
    } | null>(null);

    // Configure the location service to use our modal
    locationService.configure({
        showPermissionModal: async (context: 'startup' | 'toppicks' | 'travel' | 'settings') => {
            return new Promise((resolve) => {
                setModalContext(context);
                setIsModalVisible(true);

                // Set up one-time listeners for the modal result
                const handlePermissionResult = (granted: boolean) => {
                    setIsModalVisible(false);
                    resolve(granted);
                };

                // Store the resolver so the modal can call it
                (global as any).__locationPermissionResolver = handlePermissionResult;
            });
        }
    });

    const requestLocationPermission = useCallback(async (
        context: 'startup' | 'toppicks' | 'travel' | 'settings' = 'startup'
    ) => {
        const result = await locationService.requestLocationPermission(context);
        setPermissionResult(result);
        return result;
    }, []);

    const handleModalResult = useCallback((granted: boolean) => {
        // Call the stored resolver if it exists
        if ((global as any).__locationPermissionResolver) {
            (global as any).__locationPermissionResolver(granted);
            (global as any).__locationPermissionResolver = null;
        }
    }, []);

    const closeModal = useCallback(() => {
        setIsModalVisible(false);
        // If modal was closed without a result, treat as denied
        if ((global as any).__locationPermissionResolver) {
            (global as any).__locationPermissionResolver(false);
            (global as any).__locationPermissionResolver = null;
        }
    }, []);

    return {
        // Modal state
        isModalVisible,
        modalContext,

        // Permission functions
        requestLocationPermission,

        // Modal handlers
        handleModalResult,
        closeModal,

        // Last result
        permissionResult,

        // Service utilities
        isLocationPermissionGranted: locationService.isLocationPermissionGranted.bind(locationService),
        getCurrentLocation: locationService.getCurrentLocation.bind(locationService),
        shouldShowLocationOnboarding: locationService.shouldShowLocationOnboarding.bind(locationService),
        wasLocationPermissionDenied: locationService.wasLocationPermissionDenied.bind(locationService),
        canAskForLocationAgain: locationService.canAskForLocationAgain.bind(locationService),
        resetLocationPermissionState: locationService.resetLocationPermissionState.bind(locationService),
    };
}
