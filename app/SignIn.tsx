import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  loginWithEmail,
  signupWithEmail,
  account,
} from "@/lib/appwrite";
import { getUserProfile, createUserProfile } from "@/lib/api/user";
import images from "@/constants/images";

const SignIn = () => {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(""); // only used for signup
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password || (mode === "signup" && !name)) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    try {
      setLoading(true);

      if (mode === "signup") {
        await signupWithEmail(email.trim(), password, name.trim());
        await loginWithEmail(email.trim(), password);
      } else {
        await loginWithEmail(email.trim(), password);
      }

      const user = await account.get();
      const profile = await getUserProfile(user.$id);

      if (!profile && mode === "signup") {
        await createUserProfile({
          id: user.$id,
          name: user.name || "Unnamed",
          email: user.email ?? email, // fallback to typed-in email
          isPublic: true,
          preferences: [],
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

  return (
    <SafeAreaView className="bg-white h-full">
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
            <TextInput
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              className="border border-gray-300 rounded-lg px-4 py-3 mb-4 font-rubik text-black-300"
              placeholderTextColor="#aaa"
              autoCapitalize="words"
            />
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignIn;
