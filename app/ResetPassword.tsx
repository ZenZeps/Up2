import images from "@/constants/images";
import { PasswordResetHandler } from "@/lib/auth/passwordReset";
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
    const { userId, secret, expire } = useLocalSearchParams();
    const router = useRouter();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [validating, setValidating] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Validate the reset link parameters
        const validation = PasswordResetHandler.validateResetLink(userId, secret, expire);
        if (!validation.isValid) {
            setError(validation.error || "Invalid reset link");
            Alert.alert("Invalid Link", validation.error || "This password reset link is invalid or expired.", [
                { text: "OK", onPress: () => router.replace("/SignIn") }
            ]);
            return;
        }
        setValidating(false);
    }, [userId, secret, expire, router]);

    const handleResetPassword = async () => {
        // Validate passwords
        const validation = PasswordResetHandler.validatePassword(newPassword, confirmPassword);
        if (!validation.isValid) {
            Alert.alert("Invalid Password", validation.error);
            return;
        }

        try {
            setLoading(true);
            await PasswordResetHandler.resetPassword(
                String(userId), 
                String(secret), 
                newPassword
            );

            PasswordResetHandler.showResetSuccess(() => {
                router.replace("/SignIn");
            });

        } catch (error: any) {
            Alert.alert("Reset Failed", error.message);
        } finally {
            setLoading(false);
        }
    };

    if (validating) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={{ fontSize: 18, color: '#666', marginTop: 16 }}>
                    Validating reset link...
                </Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 40 }}>
                <View style={{ backgroundColor: '#F44336', width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{ color: 'white', fontSize: 40 }}>✗</Text>
                </View>
                <Text style={{ fontSize: 20, color: '#F44336', fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
                    Invalid Reset Link
                </Text>
                <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30 }}>
                    {error}
                </Text>
                <TouchableOpacity
                    onPress={() => router.replace("/SignIn")}
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
