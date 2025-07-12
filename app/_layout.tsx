import { account } from "@/lib/appwrite/client";
import GlobalProvider from "@/lib/global-provider";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import { SplashScreen, Stack } from "expo-router";
import { useEffect, useState } from "react";
import "./globals.css";

const prefix = Linking.createURL("/");

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Rubik-ExtraBold": require("../assets/fonts/Rubik-ExtraBold.ttf"),
    "Rubik-Light": require("../assets/fonts/Rubik-Light.ttf"),
    "Rubik-Medium": require("../assets/fonts/Rubik-Medium.ttf"),
    "Rubik-Regular": require("../assets/fonts/Rubik-Regular.ttf"),
    "Rubik-SemiBold": require("../assets/fonts/Rubik-SemiBold.ttf"),
  });

  const [isAppReady, setIsAppReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
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

  if (!fontsLoaded || !isAppReady || isAuthenticated === null) return null;

  // Wrap the Stack in GlobalProvider
  return (
    <GlobalProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(root)" />
      </Stack>
    </GlobalProvider>
  );
}