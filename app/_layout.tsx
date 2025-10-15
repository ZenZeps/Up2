import { account } from "@/lib/appwrite/client";
import { AlertProvider } from "@/lib/context/AlertContext";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import { setupGlobalErrorHandler } from "@/lib/debug/globalErrorHandler";
import GlobalProvider from "@/lib/global-provider";
import "@/lib/i18n"; // Initialize i18n
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import notificationService from "@/lib/notifications/notificationService";
import { dataPreloader } from "@/lib/services/dataPreloader";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking';
import { SplashScreen, Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { BackHandler } from "react-native";
import { CustomSplashScreen } from "../components/SplashScreen";
import FirstTimeSetupModal from "../components/onboarding/FirstTimeSetupModal";
import ErrorBoundary from "./components/ErrorBoundary";
import "./globals.css";

// Set up global error handling
setupGlobalErrorHandler();

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    "Rubik-ExtraBold": require("../assets/fonts/Rubik-ExtraBold.ttf"),
    "Rubik-Light": require("../assets/fonts/Rubik-Light.ttf"),
    "Rubik-Medium": require("../assets/fonts/Rubik-Medium.ttf"),
    "Rubik-Regular": require("../assets/fonts/Rubik-Regular.ttf"),
    "Rubik-SemiBold": require("../assets/fonts/Rubik-SemiBold.ttf"),
  });

  // Consolidated app state for better performance
  const [appState, setAppState] = useState(() => ({
    isAppReady: false,
    isAuthenticated: null as boolean | null,
    showCustomSplash: true,
    currentUserId: null as string | null,
    showFirstTimeSetup: false
  }));

  // Memoized destructuring for performance
  const { isAppReady, isAuthenticated, showCustomSplash, currentUserId, showFirstTimeSetup } = appState;

  // Optimized back button handler with memoization
  const backAction = useCallback(() => {
    try {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error handling back button:', error);
      try {
        if (router.canGoBack()) {
          router.back();
          return true;
        }
      } catch {
        // Silent fallback
      }
      return false;
    }
  }, [router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [backAction]);

  const checkAuth = useCallback(async () => {
    try {
      if (!process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID) {
        console.error("Appwrite configuration missing");
        setAppState(prev => ({ ...prev, isAuthenticated: false, isAppReady: true }));
        return;
      }

      const user = await account.get();

      // Parallel check for first-time setup
      const firstTimeSetupCompleted = await AsyncStorage.getItem(`first_time_setup_${user.$id}`);

      setAppState(prev => ({
        ...prev,
        isAuthenticated: true,
        currentUserId: user.$id,
        showFirstTimeSetup: !firstTimeSetupCompleted,
        isAppReady: true
      }));
    } catch (err: any) {
      const errorMessage = typeof err === 'string' ? err : err?.message || 'Unknown error';

      // Only log unexpected errors
      if (!errorMessage.includes('missing scope') && !errorMessage.includes('User (role: guests)')) {
        console.error("Auth error:", err);
      }

      setAppState(prev => ({ ...prev, isAuthenticated: false, isAppReady: true }));
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.preventAutoHideAsync();
      checkAuth();
    }
  }, [fontsLoaded, checkAuth]);

  // Optimized deep link handler with memoization
  const handleDeepLink = useCallback((url: string) => {
    const { hostname, path, queryParams } = Linking.parse(url);

    if (hostname === 'verify' || path === '/verify') {
      const { userId, secret } = queryParams as { userId?: string; secret?: string };
      if (userId && secret) {
        router.push(`/auth/Verify?userId=${userId}&secret=${secret}`);
      }
    } else if (hostname === 'reset-password' || path === '/reset-password') {
      const { userId, secret, expire } = queryParams as {
        userId?: string;
        secret?: string;
        expire?: string;
      };
      if (userId && secret) {
        const resetUrl = `/ResetPassword?userId=${userId}&secret=${secret}${expire ? `&expire=${expire}` : ''}`;
        router.push(resetUrl as any);
      }
    } else if (hostname === 'invite' || path === '/invite') {
      const { eventId, inviter, type } = queryParams as {
        eventId?: string;
        inviter?: string;
        type?: string;
      };
      if (type === 'event-invite' && eventId) {
        router.push(`/(root)/invites/inviteLanding?eventId=${eventId}&inviter=${inviter || ''}`);
      }
    }
  }, [router]);

  useEffect(() => {

    const getInitialURL = async () => {
      const initialURL = await Linking.getInitialURL();
      if (initialURL) {
        handleDeepLink(initialURL);
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    getInitialURL();
    return () => subscription?.remove();
  }, [handleDeepLink]);

  // Optimized notification setup with memoized handlers
  const handleNotificationResponse = useCallback((response: any) => {
    const data = response.notification.request.content.data;

    if (data?.type === 'event_invite' && data?.eventId) {
      router.push(`/(root)/events/${data.eventId}` as any);
    } else if (data?.type === 'chat_message' && data?.chatId) {
      router.push(`/Messages/${data.chatId}` as any);
    } else if (data?.type === 'friend_request') {
      router.push('/Invites' as any);
    }
  }, [router]);

  const handleNotificationReceived = useCallback((notification: any) => {
    // Custom handling for received notifications (e.g., badge updates)
    // Removed console.log for better performance
  }, []);

  useEffect(() => {
    const responseListener = notificationService.addNotificationResponseListener(handleNotificationResponse);
    const notificationListener = notificationService.addNotificationListener(handleNotificationReceived);

    return () => {
      notificationService.removeNotificationListener(responseListener);
      notificationService.removeNotificationListener(notificationListener);
    };
  }, [handleNotificationResponse, handleNotificationReceived]);

  // Optimized preload handler with reduced logging
  const handlePreloadData = useCallback(async () => {
    try {
      await dataPreloader.preloadAppData({
        userId: currentUserId || undefined,
        skipCache: false
      });
    } catch (error) {
      console.error('Preload failed:', error);
      // Don't throw - let the app start even if preload fails
    }
  }, [currentUserId]);

  const handleSplashFinish = useCallback(() => {
    setAppState(prev => ({ ...prev, showCustomSplash: false }));
  }, []);

  // Show custom splash screen while app is initializing
  if (!fontsLoaded || !isAppReady || isAuthenticated === null || showCustomSplash) {
    if (fontsLoaded && isAppReady && isAuthenticated !== null) {
      return (
        <ThemeProvider>
          <CustomSplashScreen
            onFinish={handleSplashFinish}
            preloadData={handlePreloadData}
            minimumDisplayTime={4000} // 4 seconds to ensure Home/Feed screens are ready
          />
        </ThemeProvider>
      );
    }
    return null;
  }

  // Decide whether to expose debug screens (dev or explicit flag)
  const showDebugScreens = __DEV__ || process.env.EXPO_PUBLIC_SHOW_CONFIG_SCREEN === '1';

  // Wrap the Stack in ThemeProvider, AlertProvider, GlobalProvider, LanguageProvider, and ErrorBoundary for crash protection
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider>
          <AlertProvider>
            <GlobalProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(root)" />
                <Stack.Screen name="SignIn" />
                <Stack.Screen name="SignUp" />
                <Stack.Screen name="Verify" />
                <Stack.Screen name="ResetPassword" />
                {showDebugScreens && <Stack.Screen name="DebugConfig" />}
              </Stack>

              {/* First-time setup modal for new users */}
              {showFirstTimeSetup && currentUserId && (
                <FirstTimeSetupModal
                  visible={showFirstTimeSetup}
                  userId={currentUserId}
                  onComplete={() => setAppState(prev => ({ ...prev, showFirstTimeSetup: false }))}
                />
              )}
            </GlobalProvider>
          </AlertProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}