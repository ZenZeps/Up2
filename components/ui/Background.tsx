import { useTheme } from '@/lib/context/ThemeContext';
import React from 'react';
import { View, ViewStyle } from 'react-native';

interface BackgroundProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

export const Background: React.FC<BackgroundProps> = ({ children, style }) => {
    const { colors } = useTheme();

    // Always use regular background - gradients are now only for headers and tab bars
    return (
        <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>
            {children}
        </View>
    );
};
