import { account, verifyEmail } from "@/lib/appwrite/appwrite";
import { useGlobalContext } from "@/lib/global-provider";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

export default function Verify() {
  const { userId, secret } = useLocalSearchParams();
  const router = useRouter();
  const { refetch } = useGlobalContext();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleVerification = async () => {
      if (!userId || !secret) {
        setError("Verification link is invalid or missing parameters.");
        setVerifying(false);
        return;
      }

      try {
        // Verify the email using the provided userId and secret
        await verifyEmail(String(userId), String(secret));

        // After successful verification, we need to create a session for the user
        // The user now has a verified email, so let's check if we can get their account
        try {
          // Try to get the user account (this might work if there's still a session)
          const user = await account.get();
          console.log("User session found after verification:", user);
        } catch (sessionError) {
          // No active session, but that's okay - the routing logic will handle this
          console.log("No active session after verification - user will be prompted to sign in");
        }

        setVerified(true);

        // Try to refresh global context to get updated user state
        try {
          await refetch();
        } catch (refreshError) {
          console.warn("Could not refresh global context after verification");
        }

        // Auto-redirect to index to let routing logic handle the verified user properly
        setTimeout(() => {
          router.replace("/");
        }, 2000);

      } catch (err: any) {
        console.error("Email verification failed:", err);
        let errorMessage = "Could not verify your email. ";

        if (err.message?.includes("expired")) {
          errorMessage += "The verification link has expired.";
        } else if (err.message?.includes("invalid")) {
          errorMessage += "The verification link is invalid.";
        } else {
          errorMessage += "Please try again or request a new verification email.";
        }

        setError(errorMessage);
      } finally {
        setVerifying(false);
      }
    };

    handleVerification();
  }, [userId, secret, refetch, router]);

  const handleRetry = () => {
    router.replace("/");
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 40 }}>
      {verifying ? (
        <>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={{ fontSize: 18, color: '#666', marginTop: 16, textAlign: 'center' }}>
            Verifying your email address...
          </Text>
        </>
      ) : verified ? (
        <>
          <View style={{ backgroundColor: '#4CAF50', width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: 'white', fontSize: 40 }}>✓</Text>
          </View>
          <Text style={{ fontSize: 20, color: '#4CAF50', fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
            Email Verified Successfully!
          </Text>
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30 }}>
            Great! Now please sign in to complete your profile setup.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/")}
            style={{
              backgroundColor: '#007AFF',
              paddingHorizontal: 30,
              paddingVertical: 12,
              borderRadius: 8,
              marginBottom: 15,
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
              Continue
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 14, color: '#999', textAlign: 'center' }}>
            Or wait to be automatically redirected...
          </Text>
        </>
      ) : (
        <>
          <View style={{ backgroundColor: '#F44336', width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: 'white', fontSize: 40 }}>✗</Text>
          </View>
          <Text style={{ fontSize: 20, color: '#F44336', fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
            Verification Failed
          </Text>
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30 }}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={handleRetry}
            style={{
              backgroundColor: '#007AFF',
              paddingHorizontal: 30,
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
              Back to Sign Up
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}


