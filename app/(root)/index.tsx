import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '@/lib/appwrite';

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const user = await getCurrentUser();
      if (user) {
        router.replace('/(root)/(tabs)/Home');
      } else {
        router.replace('/SignIn');
      }
      setChecking(false);
    };
    checkAuth();
  }, []);

  if (checking) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return null;
}
