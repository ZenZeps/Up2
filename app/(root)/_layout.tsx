import { useGlobalContext } from '@/lib/global-provider';
import { Slot, useRouter } from 'expo-router';
import React from 'react';
import { EventsProvider } from './context/EventContext';

export default function RootLayout() {
  const { isLoggedIn, loading } = useGlobalContext();
  const router = useRouter();

  // Handle authentication redirect with error handling
  React.useEffect(() => {
    if (!loading && !isLoggedIn) {
      // Add a small delay to prevent race conditions
      const timer = setTimeout(() => {
        try {
          router.replace('/auth/SignIn');
        } catch (navError) {
          console.error('Navigation error during auth redirect:', navError);
          // In React Native, just try router again instead of window.location
          setTimeout(() => {
            router.replace('/auth/SignIn');
          }, 500);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, isLoggedIn, router]);

  // Don't render authenticated content if not logged in
  if (!loading && !isLoggedIn) {
    return null; // Let the useEffect handle navigation
  }

  return (
    <EventsProvider>
      <Slot />
    </EventsProvider>
  );
}