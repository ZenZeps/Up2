import { Alert } from "react-native";
import { account, resendVerificationEmail, sendVerificationEmail } from "../appwrite/appwrite";
import { authDebug } from "../debug/authDebug";

/**
 * Handles email verification workflow for authenticated users
 */
export class EmailVerificationHandler {
  /**
   * Check if current user's email is verified
   */
  static async isEmailVerified(): Promise<boolean> {
    try {
      const user = await account.get();
      return user.emailVerification;
    } catch (error) {
      authDebug.error("Failed to check email verification status", error);
      return false;
    }
  }

  /**
   * Send verification email to current authenticated user
   */
  static async sendVerification(): Promise<boolean> {
    try {
      await sendVerificationEmail();
      authDebug.info("Verification email sent successfully");
      return true;
    } catch (error: any) {
      authDebug.error("Failed to send verification email", error);
      throw new Error(error.message || "Failed to send verification email");
    }
  }

  /**
   * Resend verification email with user credentials
   */
  static async resendVerification(email: string, password: string): Promise<boolean> {
    try {
      await resendVerificationEmail(email, password);
      authDebug.info("Verification email resent successfully");
      return true;
    } catch (error: any) {
      authDebug.error("Failed to resend verification email", error);
      throw new Error(error.message || "Failed to resend verification email");
    }
  }

  /**
   * Handle unverified email scenario with user-friendly options
   */
  static handleUnverifiedEmail(
    email?: string,
    password?: string,
    onResendSuccess?: () => void,
    onNavigateToSignIn?: () => void
  ) {
    const buttons: Array<{
      text: string;
      style?: "default" | "cancel" | "destructive";
      onPress?: () => void;
    }> = [
      {
        text: "OK",
        style: "cancel",
        onPress: onNavigateToSignIn
      }
    ];

    // Add resend option if credentials are provided
    if (email && password) {
      buttons.unshift({
        text: "Resend Email",
        onPress: async () => {
          try {
            await EmailVerificationHandler.resendVerification(email, password);
            Alert.alert(
              "Email Sent", 
              "A new verification email has been sent to your inbox. Please check your email and spam folder.",
              [{ text: "OK", onPress: onResendSuccess }]
            );
          } catch (error: any) {
            Alert.alert(
              "Error", 
              error.message || "Failed to resend verification email. Please try again later."
            );
          }
        }
      });
    }

    Alert.alert(
      "Email Verification Required",
      "Please verify your email address before continuing. Check your inbox and spam folder for the verification email.",
      buttons
    );
  }

  /**
   * Show success message after email verification
   */
  static showVerificationSuccess(onContinue?: () => void) {
    Alert.alert(
      "Email Verified!",
      "Your email has been successfully verified. You can now access all features of the app.",
      [
        {
          text: "Continue",
          onPress: onContinue
        }
      ]
    );
  }
}
