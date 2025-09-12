import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from './index';

interface LanguageContextType {
    currentLanguage: string;
    setLanguage: (language: string) => Promise<void>;
    t: (key: string, options?: any) => string;
    isReady: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { t, i18n } = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState(getCurrentLanguage());
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Wait for i18n to be initialized
        const checkReady = () => {
            if (i18n.isInitialized) {
                setIsReady(true);
                setCurrentLanguage(getCurrentLanguage());
            } else {
                setTimeout(checkReady, 100);
            }
        };
        checkReady();
    }, [i18n]);

    const setLanguage = async (language: string) => {
        try {
            await changeLanguage(language);
            setCurrentLanguage(language);
        } catch (error) {
            console.error('Error changing language:', error);
        }
    };

    const value: LanguageContextType = {
        currentLanguage,
        setLanguage,
        t,
        isReady,
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
