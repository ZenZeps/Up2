import { account } from "@/lib/appwrite/client";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import { setupGlobalErrorHandler } from "@/lib/debug/globalErrorHandler";
import GlobalProvider from "@/lib/global-provider";
import notificationService from "@/lib/notifications/notificationService";
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking';
import { SplashScreen, Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler } from "react-native";
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

  const [isAppReady, setIsAppReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Handle hardware back button for proper navigation
  useEffect(() => {
    const backAction = () => {
      if (router.canGoBack()) {
        router.back();
        return true; // Prevent default behavior
      }
      return false; // Allow default behavior (exit app)
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [router]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if Appwrite is properly configured
        if (!process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID) {
          console.error("Appwrite configuration missing");
          setIsAuthenticated(false);
          setIsAppReady(true);
          return;
        }

        await account.get(); // Will throw if not logged in
        setIsAuthenticated(true);
        console.log("User is authenticated");
      } catch (err: any) {
        // These errors are expected for unauthenticated users, don't log them
        let errorMessage = typeof err === 'string' ? err :
          err?.message ||
          (err?.toString ? err.toString() : 'Unknown error');

        if (
          !errorMessage.includes('missing scope (account)') &&
          !errorMessage.includes('User (role: guests)')
        ) {
          console.error("Auth error:", err);
        } else {
          console.log("User is not authenticated (expected behavior)");
        }
        setIsAuthenticated(false);
      } finally {
        setIsAppReady(true);
      }
    };

    if (fontsLoaded) {
      SplashScreen.hideAsync();
      checkAuth();
    }
  }, [fontsLoaded]);

  // Handle deep links for email verification, password reset, and invites
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      const { hostname, path, queryParams } = Linking.parse(url);

      if (hostname === 'verify' || path === '/verify') {
        // Handle email verification
        const { userId, secret } = queryParams as { userId?: string; secret?: string };
        if (userId && secret) {
          router.push(`/Verify?userId=${userId}&secret=${secret}`);
        }
      } else if (hostname === 'reset-password' || path === '/reset-password') {
        // Handle password reset
        const { userId, secret, expire } = queryParams as {
          userId?: string;
          secret?: string;
          expire?: string;
        };
        if (userId && secret) {
          // Include expire parameter if present for additional validation
          const resetUrl = `/ResetPassword?userId=${userId}&secret=${secret}${expire ? `&expire=${expire}` : ''}`;
          router.push(resetUrl as any); // Type assertion for dynamic URL
        }
      } else if (hostname === 'invite' || path === '/invite') {
        // Handle event invites
        const { eventId, inviter, type } = queryParams as {
          eventId?: string;
          inviter?: string;
          type?: string;
        };
        if (type === 'event-invite' && eventId) {
          router.push(`/(root)/InviteLanding?eventId=${eventId}&inviter=${inviter || ''}`);
        }
      }
    };

    // Handle app being opened from a deep link
    const getInitialURL = async () => {
      const initialURL = await Linking.getInitialURL();
      if (initialURL) {
        handleDeepLink(initialURL);
      }
    };

    // Handle deep links when app is already running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    getInitialURL();

    return () => subscription?.remove();
  }, [router]);

  // Set up notification listeners
  useEffect(() => {
    const setupNotifications = () => {
      // Add notification response listener (when user taps notification)
      const responseListener = notificationService.addNotificationResponseListener(
        (response) => {
          const data = response.notification.request.content.data;

          if (data?.type === 'event_invite' && data?.eventId) {
            // Navigate to event details
            router.push(`/(root)/event/${data.eventId}` as any);
          } else if (data?.type === 'chat_message' && data?.chatId) {
            // Navigate to chat
            router.push(`/(root)/Messages/${data.chatId}` as any);
          } else if (data?.type === 'friend_request') {
            // Navigate to invites page
            router.push('/(root)/Invites' as any);
          }
        }
      );

      // Add notification received listener (when notification arrives)
      const notificationListener = notificationService.addNotificationListener(
        (notification) => {
          console.log('Notification received:', notification);
          // You can add any custom handling here (e.g., badge updates)
        }
      );

      // Cleanup listeners
      return () => {
        notificationService.removeNotificationListener(responseListener);
        notificationService.removeNotificationListener(notificationListener);
      };
    };

    const cleanup = setupNotifications();
    return cleanup;
  }, [router]);

  if (!fontsLoaded || !isAppReady || isAuthenticated === null) return null;

  // Wrap the Stack in ThemeProvider, GlobalProvider, and ErrorBoundary for crash protection
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <GlobalProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(root)" />
            <Stack.Screen name="SignIn" />
            <Stack.Screen name="SignUp" />
            <Stack.Screen name="Verify" />
            <Stack.Screen name="ResetPassword" />
          </Stack>
        </GlobalProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}