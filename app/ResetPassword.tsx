import images from "@/constants/images";
import { resetPassword } from "@/lib/appwrite/appwrite";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
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

export default function ResetPassword() {
    const { userId, secret } = useLocalSearchParams();
    const router = useRouter();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [validating, setValidating] = useState(true);

    useEffect(() => {
        // Validate the reset link parameters
        if (!userId || !secret) {
            Alert.alert("Invalid Link", "This password reset link is invalid or expired.");
            router.replace("/SignIn");
            return;
        }
        setValidating(false);
    }, [userId, secret]);

    const handleResetPassword = async () => {
        // Validation
        if (!newPassword || !confirmPassword) {
            Alert.alert("Error", "Please fill in all fields.");
            return;
        }

        if (newPassword.length < 8) {
            Alert.alert("Weak Password", "Password must be at least 8 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert("Password Mismatch", "Passwords do not match.");
            return;
        }

        try {
            setLoading(true);
            await resetPassword(String(userId), String(secret), newPassword);

            Alert.alert(
                "Password Reset Successful",
                "Your password has been reset successfully. You can now sign in with your new password.",
                [
                    {
                        text: "OK",
                        onPress: () => router.replace("/SignIn")
                    }
                ]
            );
        } catch (error: any) {
            console.error("Password reset error:", error);
            Alert.alert(
                "Reset Failed",
                error.message || "Could not reset password. The link may be expired."
            );
        } finally {
            setLoading(false);
        }
    };

    if (validating) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#0061FF" />
                <Text className="text-lg text-gray-500 mt-4">Validating reset link...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView className="bg-white h-full">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <ScrollView contentContainerClassName="h-full justify-center">
                    <Image
                        source={images.logo}
                        className="w-full h-2/5"
                        resizeMode="contain"
                    />
                    <View className="px-10 mt-6">
                        <Text className="text-3xl font-rubik-semibold text-black-300 text-center mb-4">
                            Reset Password
                        </Text>
                        <Text className="text-center text-gray-500 font-rubik mb-6">
                            Enter your new password below
                        </Text>

                        <TextInput
                            placeholder="New Password"
                            value={newPassword}
                            onChangeText={setNewPassword}
                            className="border border-gray-300 rounded-lg px-4 py-3 mb-4 font-rubik text-black-300"
                            secureTextEntry
                            placeholderTextColor="#aaa"
                        />

                        <TextInput
                            placeholder="Confirm New Password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            className="border border-gray-300 rounded-lg px-4 py-3 mb-4 font-rubik text-black-300"
                            secureTextEntry
                            placeholderTextColor="#aaa"
                        />

                        <TouchableOpacity
                            onPress={handleResetPassword}
                            disabled={loading}
                            className={`rounded-full py-4 mt-2 ${loading ? "bg-gray-300" : "bg-primary-300"
                                }`}
                        >
                            <Text className="text-white text-lg font-rubik-medium text-center">
                                {loading ? "Resetting..." : "Reset Password"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => router.replace("/SignIn")}
                            className="mt-4"
                        >
                            <Text className="text-center text-black-200 font-rubik">
                                Back to Sign In
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
