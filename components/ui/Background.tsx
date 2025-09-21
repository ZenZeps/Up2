import { useTheme } from '@/lib/context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { View, ViewStyle } from 'react-native';

interface BackgroundProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

export const Background: React.FC<BackgroundProps> = ({ children, style }) => {
    const { isColorful, colors } = useTheme();

    if (isColorful) {
        return (
            <LinearGradient
                colors={["#9b8fb6", "#c78aa5", "#db7d95", "#f2948f", "#f6b793", "#fbf4be"]}
                style={[{ flex: 1 }, style]}
            >
                {children}
            </LinearGradient>
        );
    }

    return (
        <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>
            {children}
        </View>
    );
};
