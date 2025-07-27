import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    isDark: boolean;
    toggleTheme: () => void;
    colors: {
        background: string;
        surface: string;
        surfaceSecondary: string;
        primary: string;
        primaryLight: string;
        primaryDark: string;
        secondary: string;
        accent: string;
        text: string;
        textSecondary: string;
        textMuted: string;
        border: string;
        borderLight: string;
        error: string;
        success: string;
        warning: string;
        info: string;
        card: string;
        cardElevated: string;
        tabBar: string;
        shadow: string;
        overlay: string;
        gradient: {
            primary: string[];
            secondary: string[];
            card: string[];
        };
    };
    spacing: {
        xs: number;
        sm: number;
        md: number;
        lg: number;
        xl: number;
        xxl: number;
    };
    borderRadius: {
        sm: number;
        md: number;
        lg: number;
        xl: number;
        full: number;
    };
    typography: {
        size: {
            xs: number;
            sm: number;
            base: number;
            lg: number;
            xl: number;
            xxl: number;
        };
        weight: {
            light: string;
            regular: string;
            medium: string;
            semibold: string;
            bold: string;
        };
    };
}

const lightColors = {
    background: '#ffffff',
    surface: '#f8f9fa',
    surfaceSecondary: '#e9ecef',
    primary: '#0061ff',
    primaryLight: '#4285f4',
    primaryDark: '#0052d9',
    secondary: '#6c757d',
    accent: '#17a2b8',
    text: '#000000',
    textSecondary: '#6c757d',
    textMuted: '#adb5bd',
    border: '#e9ecef',
    borderLight: '#f8f9fa',
    error: '#dc3545',
    success: '#28a745',
    warning: '#ffc107',
    info: '#17a2b8',
    card: '#ffffff',
    cardElevated: '#ffffff',
    tabBar: '#ffffff',
    shadow: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    gradient: {
        primary: ['#0061ff', '#4285f4'],
        secondary: ['#6c757d', '#495057'],
        card: ['#ffffff', '#f8f9fa'],
    },
};

const darkColors = {
    background: '#000000',
    surface: '#1c1c1e',
    surfaceSecondary: '#2c2c2e',
    primary: '#0a84ff',
    primaryLight: '#64d2ff',
    primaryDark: '#0056b3',
    secondary: '#8e8e93',
    accent: '#5ac8fa',
    text: '#ffffff',
    textSecondary: '#8e8e93',
    textMuted: '#636366',
    border: '#38383a',
    borderLight: '#48484a',
    error: '#ff453a',
    success: '#30d158',
    warning: '#ff9f0a',
    info: '#5ac8fa',
    card: '#1c1c1e',
    cardElevated: '#2c2c2e',
    tabBar: '#1c1c1e',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    gradient: {
        primary: ['#0a84ff', '#64d2ff'],
        secondary: ['#8e8e93', '#636366'],
        card: ['#1c1c1e', '#2c2c2e'],
    },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app_theme';

// Design tokens for consistent spacing, typography, and layout
const designTokens = {
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },
    borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
        xl: 16,
        full: 9999,
    },
    typography: {
        size: {
            xs: 12,
            sm: 14,
            base: 16,
            lg: 18,
            xl: 20,
            xxl: 24,
        },
        weight: {
            light: '300',
            regular: '400',
            medium: '500',
            semibold: '600',
            bold: '700',
        },
    },
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>('light');

    useEffect(() => {
        loadTheme();
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

    const toggleTheme = async () => {
        const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);

        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
        } catch (error) {
            console.error('Error saving theme:', error);
        }
    };

    const value: ThemeContextType = {
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        colors: theme === 'dark' ? darkColors : lightColors,
        ...designTokens,
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
