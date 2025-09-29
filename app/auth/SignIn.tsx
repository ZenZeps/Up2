import images from "@/constants/images";
import {
  account,
  loginWithEmail,
} from "@/lib/appwrite/appwrite";
import { EmailVerificationHandler } from "@/lib/auth/emailVerification";
import { PasswordResetHandler } from "@/lib/auth/passwordReset";
import { authDebug } from "@/lib/debug/authDebug";
import { useGlobalContext } from "@/lib/global-provider";
import { MaterialIcons } from '@expo/vector-icons';
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

        EmailVerificationHandler.handleUnverifiedEmail(
          trimmedEmail,
          password,
          () => {
            // On resend success, just show success message
          },
          () => {
            // On navigation to sign in (already on sign in page, so just stay)
          }
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

      // Navigate to index to let it handle proper routing based on profile status
      router.replace("/");

    } catch (err: any) {
      authDebug.error("Authentication failed", err);

      // More specific error handling
      let errorMessage = "Authentication failed";
      let errorTitle = "Error";

      if (err?.message) {
        if (err.message.includes("Invalid credentials") ||
          err.message.includes("Invalid email or password") ||
          err.message.includes("wrong password") ||
          err.message.includes("incorrect password")) {
          errorTitle = "Incorrect Password";
          errorMessage = "The password you entered is incorrect. Please try again or use 'Forgot Password' to reset it.";
        } else if (err.message.includes("User (role: guests) missing scope")) {
          errorTitle = "Account Not Found";
          errorMessage = "No account found with this email address. Please check your email or sign up for a new account.";
        } else if (err.message.includes("Too many requests")) {
          errorTitle = "Too Many Attempts";
          errorMessage = "Too many login attempts. Please wait a few minutes before trying again.";
        } else if (err.message.includes("network") || err.message.includes("connection")) {
          errorTitle = "Connection Error";
          errorMessage = "Please check your internet connection and try again.";
        } else {
          errorMessage = err.message;
        }
      }

      Alert.alert(errorTitle, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      // Show dialog to get email if not entered
      PasswordResetHandler.showForgotPasswordDialog(
        "",
        (emailAddress) => {
          // Success callback - email sent
        }
      );
      return;
    }

    try {
      await PasswordResetHandler.sendResetEmail(trimmedEmail);
      Alert.alert(
        "Reset Link Sent",
        `A password reset link has been sent to ${trimmedEmail}. Please check your inbox and spam folder.`
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
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
                style={styles.logoLarge}
                resizeMode="contain"
              />
            </View>

            {/* Sign In Card */}
            <View style={styles.cardTransparent}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="person" size={24} color="#333333" />
                <Text style={styles.cardTitle}>Sign In to Your Account</Text>
              </View>

              <View style={styles.inputContainerTransparent}>
                <MaterialIcons name="email" size={20} color="#666666" style={styles.inputIcon} />
                <TextInput
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.textInput}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholderTextColor="#999999"
                />
              </View>

              <View style={styles.inputContainerTransparent}>
                <MaterialIcons name="lock" size={20} color="#666666" style={styles.inputIcon} />
                <TextInput
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  style={styles.textInput}
                  secureTextEntry
                  placeholderTextColor="#999999"
                />
              </View>

              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                style={[styles.loginButtonBlack, loading && styles.loginButtonDisabled]}
              >
                <MaterialIcons name="login" size={20} color="#fff" />
                <Text style={styles.loginButtonText}>
                  {loading ? "Signing In..." : "Sign In"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleForgotPassword}
                style={styles.forgotPasswordButton}
              >
                <MaterialIcons name="help-outline" size={16} color="#666666" />
                <Text style={styles.forgotPasswordTextBlack}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sign Up Section */}
            <View style={styles.signUpSection}>
              <Text style={styles.signUpText}>Don't have an account?</Text>
              <TouchableOpacity
                onPress={() => router.push('/auth/SignUp')}
                style={styles.signUpButton}
              >
                <MaterialIcons name="person-add" size={18} color="#007AFF" />
                <Text style={styles.signUpButtonTextBlack}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    marginVertical: 40,
    backgroundColor: 'transparent',
  },
  logoLarge: {
    width: 160,
    height: 160,
  },
  cardTransparent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginLeft: 12,
  },
  inputContainerTransparent: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    backgroundColor: '#F8F8F8',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    paddingVertical: 12,
  },
  loginButtonBlack: {
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
    backgroundColor: '#CCCCCC',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  forgotPasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  forgotPasswordTextBlack: {
    fontSize: 14,
    color: '#666666',
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
    color: '#666666',
    marginRight: 8,
  },
  signUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  signUpButtonTextBlack: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 4,
  },
});

export default SignIn;
