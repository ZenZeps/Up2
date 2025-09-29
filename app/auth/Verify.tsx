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
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
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

        // After successful verification, check if there's an active session
        let userHasSession = false;
        try {
          const user = await account.get();
          console.log("User session found after verification:", user);

          if (user && user.emailVerification) {
            // User is now verified and has an active session
            // Check if they have a complete profile
            const { getUserProfile } = await import('@/lib/api/user');
            const existingProfile = await getUserProfile(user.$id);

            userHasSession = true;
            setHasActiveSession(true);

            if (existingProfile) {
              // User has complete profile, go to home
              await refetch();
              setTimeout(() => {
                router.replace("/(root)/(tabs)/Home");
              }, 2000);
            } else {
              // User needs to complete profile, go to SignUp for profile completion
              setTimeout(() => {
                router.replace("/auth/SignUp");
              }, 2000);
            }
          }
        } catch (sessionError) {
          // No active session, user will need to sign in
          console.log("No active session after verification - user will need to sign in");
        }

        setVerified(true);

        // If no active session, send user to sign in
        if (!userHasSession) {
          setTimeout(() => {
            router.replace("/auth/SignIn");
          }, 2000);
        }

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
    // On error, send user to sign in so they can request a new verification email or sign in
    router.replace("/auth/SignIn");
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
            {hasActiveSession
              ? "Welcome! Please complete your profile setup to get started."
              : "Great! Now please sign in to complete your account setup."
            }
          </Text>
          <TouchableOpacity
            onPress={() => router.replace(hasActiveSession ? "/auth/SignUp" : "/auth/SignIn")}
            style={{
              backgroundColor: '#007AFF',
              paddingHorizontal: 30,
              paddingVertical: 12,
              borderRadius: 8,
              marginBottom: 15,
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
              {hasActiveSession ? "Complete Profile" : "Continue to Sign In"}
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
              Back to Sign In
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}


