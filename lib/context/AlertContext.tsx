/**
 * Alert Provider
 * 
 * Provides custom alert functionality throughout the app
 * to replace system Alert.alert calls with styled dialogs
 */

import React, { createContext, ReactNode, useContext, useState } from 'react';
import CustomAlert from '../../components/CustomAlert';

interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface AlertContextType {
    showAlert: (
        title: string,
        message: string,
        buttons?: AlertButton[],
        icon?: 'success' | 'error' | 'warning' | 'info'
    ) => void;
    hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

interface AlertProviderProps {
    children: ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
    const [alertProps, setAlertProps] = useState<{
        title: string;
        message: string;
        buttons?: AlertButton[];
        icon?: 'success' | 'error' | 'warning' | 'info';
        visible: boolean;
    } | null>(null);

    const showAlert = (
        title: string,
        message: string,
        buttons?: AlertButton[],
        icon?: 'success' | 'error' | 'warning' | 'info'
    ) => {
        setAlertProps({
            title,
            message,
            buttons,
            icon,
            visible: true
        });
    };

    const hideAlert = () => {
        setAlertProps(null);
    };

    const handleClose = () => {
        setAlertProps(null);
    };

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            {alertProps && (
                <CustomAlert
                    visible={alertProps.visible}
                    title={alertProps.title}
                    message={alertProps.message}
                    buttons={alertProps.buttons}
                    icon={alertProps.icon}
                    onClose={handleClose}
                />
            )}
        </AlertContext.Provider>
    );
};

export const useAlert = (): AlertContextType => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};

// Convenience function for common alert types
export const useAlertHelpers = () => {
    const { showAlert } = useAlert();

    return {
        showSuccess: (title: string, message: string) =>
            showAlert(title, message, [{ text: 'OK' }], 'success'),

        showError: (title: string, message: string) =>
            showAlert(title, message, [{ text: 'OK' }], 'error'),

        showWarning: (title: string, message: string) =>
            showAlert(title, message, [{ text: 'OK' }], 'warning'),

        showInfo: (title: string, message: string) =>
            showAlert(title, message, [{ text: 'OK' }], 'info'),

        showConfirm: (
            title: string,
            message: string,
            onConfirm: () => void,
            onCancel?: () => void,
            confirmText = 'OK',
            cancelText = 'Cancel'
        ) => showAlert(title, message, [
            { text: cancelText, style: 'cancel', onPress: onCancel },
            { text: confirmText, style: 'default', onPress: onConfirm }
        ]),

        showDestructiveConfirm: (
            title: string,
            message: string,
            onConfirm: () => void,
            onCancel?: () => void,
            confirmText = 'Delete',
            cancelText = 'Cancel'
        ) => showAlert(title, message, [
            { text: cancelText, style: 'cancel', onPress: onCancel },
            { text: confirmText, style: 'destructive', onPress: onConfirm }
        ])
    };
};
