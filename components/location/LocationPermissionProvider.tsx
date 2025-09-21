import React from 'react';
import { useLocationPermission } from '../../lib/hooks/useLocationPermission';
import LocationPermissionModal from './LocationPermissionModal';

interface LocationPermissionProviderProps {
    children: React.ReactNode;
}

export default function LocationPermissionProvider({ children }: LocationPermissionProviderProps) {
    const {
        isModalVisible,
        modalContext,
        handleModalResult,
        closeModal,
    } = useLocationPermission();

    return (
        <>
            {children}
            <LocationPermissionModal
                visible={isModalVisible}
                context={modalContext}
                onPermissionResult={handleModalResult}
                onClose={closeModal}
            />
        </>
    );
}
