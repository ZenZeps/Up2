import { router } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface NavigationContextType {
    navigationHistory: string[];
    currentRoute: string;
    canGoBack: boolean;
    goBack: () => void;
    navigateTo: (route: string) => void;
    replaceWith: (route: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
    const [currentRoute, setCurrentRoute] = useState<string>('');
    const [canGoBack, setCanGoBack] = useState<boolean>(false);

    useEffect(() => {
        // Update can go back status
        setCanGoBack(router.canGoBack());
    }, [currentRoute]);

    const goBack = () => {
        try {
            if (router.canGoBack()) {
                router.back();
                // Remove the last route from history
                setNavigationHistory(prev => prev.slice(0, -1));
            } else {
                // Fallback to home if no back navigation is possible
                router.push('/(root)/(tabs)/Home' as any);
            }
        } catch (error) {
            console.error('Navigation error in goBack:', error);
            // Emergency fallback
            router.push('/(root)/(tabs)/Home' as any);
        }
    };

    const navigateTo = (route: string) => {
        try {
            router.push(route as any);
            // Add to navigation history
            setNavigationHistory(prev => [...prev, currentRoute].filter(Boolean));
            setCurrentRoute(route);
        } catch (error) {
            console.error('Navigation error in navigateTo:', error);
        }
    };

    const replaceWith = (route: string) => {
        try {
            router.replace(route as any);
            setCurrentRoute(route);
            // Don't add to history for replace operations
        } catch (error) {
            console.error('Navigation error in replaceWith:', error);
        }
    };

    return (
        <NavigationContext.Provider value={{
            navigationHistory,
            currentRoute,
            canGoBack,
            goBack,
            navigateTo,
            replaceWith,
        }}>
            {children}
        </NavigationContext.Provider>
    );
};

export const useNavigation = () => {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error('useNavigation must be used within a NavigationProvider');
    }
    return context;
};

export default NavigationProvider;
