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
    };
}

const lightColors = {
    background: '#ffffff',
    surface: '#f8f9fa',
    primary: '#0061ff',
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
};

const darkColors = {
    background: '#121212',
    surface: '#1e1e1e',
    primary: '#4285f4',
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
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app_theme';

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
