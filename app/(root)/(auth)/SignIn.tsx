import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  loginWithEmail,
  signupWithEmail,
  account,
  forgotPassword,
} from "@/lib/appwrite/appwrite";
import {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
} from "@/lib/api/user";
import images from "@/constants/images";

const SignIn = () => {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // NEW
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedEmail || !password || (mode === "signup" && (!trimmedName || !confirmPassword))) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Weak Password", "Password must be at least 8 characters.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

    if (mode === "signup") {
      await signupWithEmail(trimmedEmail, password, trimmedName);
      // Log in to create a session so verification can be sent
      await loginWithEmail(trimmedEmail, password);
      await account.createVerification(`myapp://auth/verify`);
      Alert.alert("Verify Email", "Check your email to verify your account.");
      return;
}

      await loginWithEmail(trimmedEmail, password);
      const user = await account.get();

      if (!user.emailVerification) {
        Alert.alert("Email Not Verified", "Please verify your email first.");
        await account.deleteSession("current");
        return;
      }

      let existingProfile = null;
      try {
        console.log("Attempting to fetch user profile...");
        existingProfile = await getUserProfile(user.$id);
      } catch (profileError: any) {
        console.error("Error fetching user profile in SignIn.tsx:", profileError);
        // Continue with the flow, assuming profile might not exist yet
      }

      if (!existingProfile) {
        await createUserProfile({
          id: user.$id,
          name: user.name || trimmedName || "Unnamed",
          email: user.email ?? trimmedEmail,
          isPublic: true,
          preferences: [],
        });
      } else {
        await updateUserProfile({
          id: user.$id,
          name: user.name || existingProfile.name,
          email: user.email ?? existingProfile.email,
          isPublic: existingProfile.isPublic,
          preferences: existingProfile.preferences,
        });
      }

      router.replace("/Home");
    } catch (err: any) {
      console.error("Auth error:", err);
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
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </Text>

          {mode === "signup" && (
            <>
              <TextInput
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                className="border border-gray-300 rounded-lg px-4 py-3 mb-4 font-rubik text-black-300"
                placeholderTextColor="#aaa"
                autoCapitalize="words"
              />
            </>
          )}

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

          {mode === "signup" && (
            <TextInput
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              className="border border-gray-300 rounded-lg px-4 py-3 mb-4 font-rubik text-black-300"
              secureTextEntry
              placeholderTextColor="#aaa"
            />
          )}

          <TouchableOpacity
            onPress={handleAuth}
            disabled={loading}
            className={`rounded-full py-4 mt-2 ${
              loading ? "bg-gray-300" : "bg-primary-300"
            }`}
          >
            <Text className="text-white text-lg font-rubik-medium text-center">
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Login"
                : "Sign Up"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              setMode((prev) => (prev === "login" ? "signup" : "login"))
            }
            className="mt-4"
          >
            <Text className="text-center text-black-200 font-rubik">
              {mode === "login"
                ? "Don't have an account? Sign Up"
                : "Already have an account? Log In"}
            </Text>
          </TouchableOpacity>

          {mode === "login" && (
            <TouchableOpacity
              onPress={handleForgotPassword}
              className="mt-2 self-center"
            >
              <Text className="text-primary-300 font-rubik-medium">
                Forgot Password?
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignIn;
