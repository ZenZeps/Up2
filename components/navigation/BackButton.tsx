import { handleBack } from '@/lib/navigation/navigationUtils';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface BackButtonProps {
    onPress?: () => void;
    fallbackRoute?: string;
    style?: any;
    iconSize?: number;
    iconColor?: string;
    disabled?: boolean;
}

/**
 * Standardized back button component that ensures proper navigation
 * behavior throughout the app.
 */
export const BackButton: React.FC<BackButtonProps> = ({
    onPress,
    fallbackRoute,
    style,
    iconSize = 24,
    iconColor = 'white',
    disabled = false,
}) => {
    const handlePress = () => {
        if (onPress) {
            // If custom onPress is provided, use it
            onPress();
        } else {
            // Use the enhanced back navigation utility
            handleBack(fallbackRoute);
        }
    };

    return (
        <TouchableOpacity
            style={[styles.backButton, style]}
            onPress={handlePress}
            disabled={disabled}
            testID="back-button"
        >
            <MaterialIcons name="arrow-back" size={iconSize} color={iconColor} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    backButton: {
        padding: 8,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 40,
        minHeight: 40,
    },
});

export default BackButton;
