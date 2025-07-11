import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Alert } from "react-native";
import { useSearchParams, useRouter } from "expo-router";
import { account } from "@/lib/appwrite/appwrite";

export default function Verify() {
  const { userId, secret } = useSearchParams();
  const router = useRouter();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!userId || !secret) {
        Alert.alert("Missing info", "Verification link is invalid.");
        router.replace("/SignIn");
        return;
      }

      try {
        await account.updateVerification(String(userId), String(secret));
        setVerified(true);
        setTimeout(() => {
          router.replace("/SignIn");
        }, 2500);
      } catch (err: any) {
        console.error("Verification error:", err);
        Alert.alert("Verification Failed", err.message || "Could not verify email.");
        router.replace("/SignIn");
      } finally {
        setVerifying(false);
      }
    };

    verifyEmail();
  }, [userId, secret]);

  return (
    <View className="flex-1 justify-center items-center bg-white px-10">
      {verifying ? (
        <>
          <ActivityIndicator size="large" color="#0061FF" />
          <Text className="text-lg text-gray-500 mt-4">Verifying your email...</Text>
        </>
      ) : verified ? (
        <Text className="text-lg text-green-600 font-semibold text-center">
          Email verified successfully! Redirecting...
        </Text>
      ) : (
        <Text className="text-lg text-red-500">Verification failed.</Text>
      )}
    </View>
  );
}


