import { EventsProvider } from './context/EventContext';
import { Redirect, Slot } from 'expo-router';
import { useGlobalContext } from '@/lib/global-provider';

export default function RootLayout() {
  const { isLoggedIn, loading } = useGlobalContext();

  if (!loading && !isLoggedIn) return <Redirect href="/SignIn" />;

  return (
    <EventsProvider>
      <Slot />
    </EventsProvider>
  );
}