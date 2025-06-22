import React from 'react';
import { View, Text, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { loginWithGoogle } from './appwrite/auth';
import images from '@/constants/images';
import { client } from './appwrite/client';
import { AppwriteException } from 'appwrite';

const SignIn = () => {
  const router = useRouter();

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      router.replace('/(root)/(tabs)/Home');
    } catch (error: any) {
      Alert.alert('Login Error', error.message || 'Try again');
    }
  };

  const pingAppwrite = async () => {
  try {
    // Use a valid endpoint to test connection
    const res = await client.call("get", "/health"); // or /health/ping
    Alert.alert("Ping successful!", JSON.stringify(res));
  } catch (error) {
    if (error instanceof AppwriteException) {
      Alert.alert("Ping failed", error.message);
    } else {
      Alert.alert("Ping failed", "Unknown error occurred");
    }
  }
};


  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
      <Image source={images.onboarding} className="w-4/5 h-1/3 mb-6" resizeMode="contain" />
      <Text className="text-2xl font-bold mb-4">Welcome to the Social Calendar</Text>

      <TouchableOpacity
        onPress={handleGoogleLogin}
        className="bg-blue-600 px-6 py-3 rounded-full mb-4"
      >
        <Text className="text-white text-lg font-medium">Continue with Google</Text>
      </TouchableOpacity>

      {/* Ping Appwrite Button */}
      <TouchableOpacity
        onPress={pingAppwrite}
        className="bg-green-500 px-6 py-2 rounded-full"
      >
        <Text className="text-white text-base font-medium">Ping Appwrite</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default SignIn;
