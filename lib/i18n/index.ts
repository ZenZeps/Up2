import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
import en from './locales/en.json';
import es from './locales/es.json';

const STORAGE_KEY = 'user_language';

const resources = {
    en: {
        translation: en,
    },
    es: {
        translation: es,
    },
};

const initI18n = async () => {
    let savedLanguage = 'en'; // default

    try {
        const storedLanguage = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedLanguage) {
            savedLanguage = storedLanguage;
        }
    } catch (error) {
        console.log('Error loading saved language:', error);
    }

    i18n
        .use(initReactI18next)
        .init({
            resources,
            lng: savedLanguage,
            fallbackLng: 'en',
            interpolation: {
                escapeValue: false,
            },
            react: {
                useSuspense: false,
            },
        });
};

export const changeLanguage = async (language: string) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, language);
        await i18n.changeLanguage(language);
    } catch (error) {
        console.log('Error saving language:', error);
    }
};

export const getCurrentLanguage = () => {
    return i18n.language;
};

// Initialize i18n
initI18n();

export default i18n;
