import { useFonts } from "expo-font";
import { SplashScreen, Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import * as Linking from "expo-linking";
import "./globals.css";
import GlobalProvider from "@/lib/global-provider";

const prefix = Linking.createURL("/");

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Rubik-ExtraBold": require("../assets/fonts/Rubik-ExtraBold.ttf"),
    "Rubik-Light": require("../assets/fonts/Rubik-Light.ttf"),
    "Rubik-Medium": require("../assets/fonts/Rubik-Medium.ttf"),
    "Rubik-Regular": require("../assets/fonts/Rubik-Regular.ttf"),
    "Rubik-SemiBold": require("../assets/fonts/Rubik-SemiBold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GlobalProvider>
      <Stack
        screenOptions={{ headerShown: false }}
        // Linking config for deep linking
        linking={{
          prefixes: [prefix],
          config: {
            screens: {
              "auth-callback": "auth-callback", // Handle redirect here
              "(tabs)": {
                screens: {
                  Home: "home",
                  Explore: "explore",
                  Profile: "profile",
                },
              },
            },
          },
        }}
      />
    </GlobalProvider>
  );
}
