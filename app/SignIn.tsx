import images from "@/constants/images";
import {
  account,
  forgotPassword,
  loginWithEmail,
  resendVerificationEmail,
} from "@/lib/appwrite/appwrite";
import { authDebug } from "@/lib/debug/authDebug";
import { useGlobalContext } from "@/lib/global-provider";
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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
        await account.deleteSession("current");
        
        Alert.alert(
          "Email Not Verified", 
          "Please verify your email first. Would you like us to resend the verification email?",
          [
            {
              text: "Resend Email",
              onPress: async () => {
                try {
                  await resendVerificationEmail(trimmedEmail, password);
                  Alert.alert("Email Sent", "Verification email has been resent. Please check your inbox and spam folder.");
                } catch (resendError: any) {
                  Alert.alert("Error", "Failed to resend verification email. Please try again later.");
                }
              }
            },
            {
              text: "OK",
              style: "cancel"
            }
          ]
        );
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
    <SafeAreaView style={styles.container}>
      {/* Modern Black Gradient Header */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#000000', '#1a1a1a', '#2d2d2d']}
          start={[0, 0]}
          end={[1, 1]}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <MaterialIcons name="login" size={28} color="white" />
            <Text style={styles.headerTitle}>Welcome Back</Text>
            <View style={styles.headerSpacer} />
          </View>
        </LinearGradient>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <Image
              source={images.logo}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Sign In Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="person" size={24} color="#007AFF" />
              <Text style={styles.cardTitle}>Sign In to Your Account</Text>
            </View>

            <View style={styles.inputContainer}>
              <MaterialIcons name="email" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                style={styles.textInput}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#aaa"
              />
            </View>

            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                style={styles.textInput}
                secureTextEntry
                placeholderTextColor="#aaa"
              />
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            >
              <MaterialIcons name="login" size={20} color="white" />
              <Text style={styles.loginButtonText}>
                {loading ? "Signing In..." : "Sign In"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPasswordButton}
            >
              <MaterialIcons name="help-outline" size={16} color="#007AFF" />
              <Text style={styles.forgotPasswordText}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sign Up Section */}
          <View style={styles.signUpSection}>
            <Text style={styles.signUpText}>Don't have an account?</Text>
            <TouchableOpacity
              onPress={() => router.push('/SignUp')}
              style={styles.signUpButton}
            >
              <MaterialIcons name="person-add" size={18} color="#007AFF" />
              <Text style={styles.signUpButtonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerContainer: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 28,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  logo: {
    width: 120,
    height: 120,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    backgroundColor: '#ffffff',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  forgotPasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
  },
  signUpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  signUpText: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
  },
  signUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  signUpButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 4,
  },
});

export default SignIn;
