import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'colorful';

interface ThemeContextType {
    theme: Theme;
    isDark: boolean;
    isColorful: boolean;
    toggleTheme: () => void;
    setColorfulMode: (enabled: boolean) => void;
    colors: {
        background: string;
        surface: string;
        primary: string;
        secondary: string;
        text: string;
        textSecondary: string;
        border: string;
        error: string;
        success: string;
        warning: string;
        card: string;
        tabBar: string;
        shadow: string;
        buttonText: string;
    };
}

const lightColors = {
    background: '#ffffff',
    surface: '#f8f9fa',
    primary: '#000000',
    secondary: '#6c757d',
    text: '#000000',
    textSecondary: '#6c757d',
    border: '#e9ecef',
    error: '#dc3545',
    success: '#28a745',
    warning: '#ffc107',
    card: '#ffffff',
    tabBar: '#ffffff',
    shadow: 'rgba(0, 0, 0, 0.1)',
    // Text color to use on buttons that use primary as background
    buttonText: '#ffffff',
};

const darkColors = {
    background: '#121212',
    surface: '#1e1e1e',
    // In dark mode primary should be a light value so elements that use primary
    // (which are black in light mode) appear visible — use white here.
    primary: '#FFFFFF',
    secondary: '#8e8e93',
    text: '#ffffff',
    textSecondary: '#8e8e93',
    border: '#333333',
    error: '#ff453a',
    success: '#30d158',
    warning: '#ff9f0a',
    card: '#2c2c2e',
    tabBar: '#1c1c1e',
    shadow: 'rgba(0, 0, 0, 0.3)',
    // Use black text on primary-colored buttons in dark mode (primary may be light)
    buttonText: '#000000',
};

const colorfulColors = {
    background: '#ffffff', // Normal white background in colorful mode
    surface: 'rgba(255, 255, 255, 0.9)',
    primary: '#667eea', // Use gradient start color for primary highlights
    secondary: '#764ba2', // Use gradient end color for secondary highlights
    text: '#000000',
    textSecondary: '#333333',
    border: 'rgba(255, 255, 255, 0.3)',
    error: '#dc3545',
    success: '#28a745',
    warning: '#ffc107',
    card: 'rgba(255, 255, 255, 0.9)',
    tabBar: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Gradient for tab bar
    shadow: 'rgba(0, 0, 0, 0.2)',
    buttonText: '#ffffff',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app_theme';
const COLORFUL_MODE_KEY = 'colorful_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>('light');
    const [isColorfulMode, setIsColorfulMode] = useState(false);

    useEffect(() => {
        loadTheme();
        loadColorfulMode();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme === 'dark' || savedTheme === 'light') {
                setTheme(savedTheme);
            }
        } catch (error) {
            console.error('Error loading theme:', error);
        }
    };

    const loadColorfulMode = async () => {
        try {
            const savedColorfulMode = await AsyncStorage.getItem(COLORFUL_MODE_KEY);
            if (savedColorfulMode !== null) {
                setIsColorfulMode(savedColorfulMode === 'true');
            }
        } catch (error) {
            console.error('Error loading colorful mode:', error);
        }
    };

    const toggleTheme = async () => {
        const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);

        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
        } catch (error) {
            console.error('Error saving theme:', error);
        }
    };

    const setColorfulMode = async (enabled: boolean) => {
        setIsColorfulMode(enabled);
        try {
            await AsyncStorage.setItem(COLORFUL_MODE_KEY, enabled.toString());
        } catch (error) {
            console.error('Error saving colorful mode:', error);
        }
    };

    const getColors = () => {
        if (isColorfulMode) {
            return colorfulColors;
        }
        return theme === 'dark' ? darkColors : lightColors;
    };

    const value: ThemeContextType = {
        theme: isColorfulMode ? 'colorful' : theme,
        isDark: theme === 'dark',
        isColorful: isColorfulMode,
        toggleTheme,
        setColorfulMode,
        colors: getColors(),
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
