/**
 * Custom Alert Component
 * 
 * Provides styled alert dialogs that match the app's design system
 * instead of using the plain system alerts.
 */

import { useTheme } from '@/lib/context/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useState } from 'react';
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message: string;
    buttons?: AlertButton[];
    onClose: () => void;
    icon?: 'success' | 'error' | 'warning' | 'info';
}

const CustomAlert: React.FC<CustomAlertProps> = ({
    visible,
    title,
    message,
    buttons = [{ text: 'OK' }],
    onClose,
    icon
}) => {
    const { colors, isDark } = useTheme();

    const getIconConfig = () => {
        switch (icon) {
            case 'success':
                return { name: 'check-circle' as const, color: '#10B981' };
            case 'error':
                return { name: 'error' as const, color: '#EF4444' };
            case 'warning':
                return { name: 'warning' as const, color: '#F59E0B' };
            case 'info':
                return { name: 'info' as const, color: colors.primary };
            default:
                return null;
        }
    };

    const iconConfig = getIconConfig();

    const handleButtonPress = (button: AlertButton) => {
        if (button.onPress) {
            button.onPress();
        }
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <BlurView
                    intensity={20}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                />

                <View style={[styles.alertContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {/* Icon */}
                    {iconConfig && (
                        <View style={styles.iconContainer}>
                            <MaterialIcons
                                name={iconConfig.name}
                                size={48}
                                color={iconConfig.color}
                            />
                        </View>
                    )}

                    {/* Title */}
                    <Text style={[styles.title, { color: colors.text }]}>
                        {title}
                    </Text>

                    {/* Message */}
                    <Text style={[styles.message, { color: colors.textSecondary }]}>
                        {message}
                    </Text>

                    {/* Buttons */}
                    <View style={styles.buttonContainer}>
                        {buttons.map((button, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.button,
                                    {
                                        backgroundColor: button.style === 'destructive'
                                            ? '#EF4444'
                                            : button.style === 'cancel'
                                                ? colors.background
                                                : colors.primary,
                                        borderColor: button.style === 'cancel' ? colors.border : 'transparent',
                                        borderWidth: button.style === 'cancel' ? 1 : 0,
                                        marginLeft: index > 0 ? 12 : 0,
                                    }
                                ]}
                                onPress={() => handleButtonPress(button)}
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={[
                                        styles.buttonText,
                                        {
                                            color: button.style === 'cancel'
                                                ? colors.text
                                                : 'white',
                                            fontWeight: button.style === 'cancel' ? '500' : '600'
                                        }
                                    ]}
                                >
                                    {button.text}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// Hook for using custom alerts
let alertManager: {
    showAlert: (props: Omit<CustomAlertProps, 'visible' | 'onClose'>) => void;
} | null = null;

export const useCustomAlert = () => {
    const [alertProps, setAlertProps] = useState<CustomAlertProps | null>(null);

    const showAlert = (props: Omit<CustomAlertProps, 'visible' | 'onClose'>) => {
        setAlertProps({
            ...props,
            visible: true,
            onClose: () => setAlertProps(null)
        });
    };

    const hideAlert = () => {
        setAlertProps(null);
    };

    // Register the alert manager globally
    React.useEffect(() => {
        alertManager = { showAlert };
        return () => {
            alertManager = null;
        };
    }, []);

    return {
        showAlert,
        hideAlert,
        AlertComponent: alertProps ? (
            <CustomAlert
                {...alertProps}
                visible={true}
                onClose={() => setAlertProps(null)}
            />
        ) : null
    };
};

// Global alert function to replace Alert.alert
export const showCustomAlert = (
    title: string,
    message: string,
    buttons?: AlertButton[],
    icon?: 'success' | 'error' | 'warning' | 'info'
) => {
    if (alertManager) {
        alertManager.showAlert({ title, message, buttons, icon });
    } else {
        // Fallback to system alert if manager is not ready
        console.warn('Custom alert manager not ready, using system alert');
        // You could still use Alert.alert here as fallback
    }
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    alertContainer: {
        width: screenWidth - 64,
        maxWidth: 320,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.25,
        shadowRadius: 25,
        elevation: 25,
        borderWidth: 1,
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
        fontFamily: 'Rubik-Bold',
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
        fontFamily: 'Rubik-Regular',
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    buttonText: {
        fontSize: 16,
        fontFamily: 'Rubik-Medium',
    },
});

export default CustomAlert;
