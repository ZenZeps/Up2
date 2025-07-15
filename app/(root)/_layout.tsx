import { useGlobalContext } from '@/lib/global-provider';
import { Slot, useRouter } from 'expo-router';
import React from 'react';
import { EventsProvider } from './context/EventContext';

// Load the debug dashboard component dynamically to avoid circular dependencies
const StandaloneDebugDashboard = React.lazy(() =>
  import('@/app/components/StandaloneDebugDashboard')
);

// Check if app is running in development mode using React Native's __DEV__ global
const isDev = __DEV__;

export default function RootLayout() {
  const { isLoggedIn, loading } = useGlobalContext();
  const [showDebug, setShowDebug] = React.useState(false);
  const router = useRouter();

  // Only mount the debug dashboard after the component is rendered
  React.useEffect(() => {
    if (isDev) {
      const timer = setTimeout(() => {
        setShowDebug(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle authentication redirect
  React.useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.replace('/SignIn');
    }
  }, [loading, isLoggedIn, router]);

  // Don't render authenticated content if not logged in
  if (!loading && !isLoggedIn) {
    return null; // Let the useEffect handle navigation
  }

  return (
    <EventsProvider>
      <Slot />
      {isDev && showDebug && (
        <React.Suspense fallback={null}>
          <StandaloneDebugDashboard />
        </React.Suspense>
      )}
    </EventsProvider>
  );
}