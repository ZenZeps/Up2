import images from "@/constants/images";
import {
  account,
  forgotPassword,
  loginWithEmail,
} from "@/lib/appwrite/appwrite";
import { authDebug } from "@/lib/debug/authDebug";
import { useGlobalContext } from "@/lib/global-provider";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SignIn = () => {
  const router = useRouter();
  const { refetch } = useGlobalContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    // Input validation
    if (!trimmedEmail || !password) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Weak Password", "Password must be at least 8 characters.");
      return;
    }

    try {
      setLoading(true);

      // Clear any existing sessions before login attempt
      try {
        const sessions = await account.listSessions();
        if (sessions.sessions.length > 0) {
          authDebug.info("Clearing existing sessions before login");
          for (const session of sessions.sessions) {
            await account.deleteSession(session.$id);
          }
        }
      } catch (clearError) {
        authDebug.debug("Could not clear sessions (this is normal for guest users)");
      }

      // Login flow
      authDebug.info("Logging in user");
      await loginWithEmail(trimmedEmail, password);

      authDebug.info("Fetching user details after login");
      const user = await account.get();
      authDebug.logUser(user);

      if (!user.emailVerification) {
        authDebug.warn("Email not verified, ending session");
        Alert.alert("Email Not Verified", "Please verify your email first.");
        await account.deleteSession("current");
        return;
      }

      // Navigate to home first
      authDebug.info("Authentication successful - navigating to home");

      // Trigger global state refresh immediately and wait for it
      try {
        await refetch();
        authDebug.info("Global state refreshed after login");
      } catch (error) {
        authDebug.warn("Could not refresh global state (not critical)", error);
      }

      // Navigate after state refresh
      router.replace("/(root)/(tabs)/Home");

    } catch (err: any) {
      authDebug.error("Authentication failed", err);
      Alert.alert("Error", err?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert("Error", "Please enter your email to reset password.");
      return;
    }
    try {
      setLoading(true);
      await forgotPassword(trimmedEmail);
      Alert.alert("Password Reset", "A password reset link has been sent to your email.");
    } catch (err: any) {
      console.error("Forgot password error:", err);
      Alert.alert("Error", err?.message || "Failed to send password reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="bg-white h-full">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView contentContainerClassName="h-full justify-center">
          <Image
            source={images.onboarding}
            className="w-full h-2/5"
            resizeMode="contain"
          />
          <View className="px-10 mt-6">
            <Text className="text-3xl font-rubik-semibold text-black-300 text-center mb-4">
              Welcome Back
            </Text>

            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              className="border border-gray-300 rounded-lg px-4 py-3 mb-4 font-rubik text-black-300"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#aaa"
            />

            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              className="border border-gray-300 rounded-lg px-4 py-3 mb-4 font-rubik text-black-300"
              secureTextEntry
              placeholderTextColor="#aaa"
            />

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              className={`rounded-full py-4 mt-2 ${loading ? "bg-gray-300" : "bg-primary-300"
                }`}
            >
              <Text className="text-white text-lg font-rubik-medium text-center">
                {loading ? "Please wait..." : "Login"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/SignUp')}
              className="mt-4"
            >
              <Text className="text-center text-black-200 font-rubik">
                Don't have an account? Sign Up
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleForgotPassword}
              className="mt-2 self-center"
            >
              <Text className="text-primary-300 font-rubik-medium">
                Forgot Password?
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignIn;
