import { Alert } from "react-native";
import { account, forgotPassword as sendPasswordRecovery, resetPassword as updatePasswordWithSecret } from "../appwrite/appwrite";
import { authDebug } from "../debug/authDebug";

/**
 * Handles password reset workflow
 */
export class PasswordResetHandler {
  /**
   * Send password reset email to user
   */
  static async sendResetEmail(email: string): Promise<boolean> {
    try {
      await sendPasswordRecovery(email);
      authDebug.info("Password reset email sent successfully", { email: email.substring(0, 3) + "****" });
      return true;
    } catch (error: any) {
      authDebug.error("Failed to send password reset email", error);
      
      // Handle specific error cases
      if (error.message?.includes('user_not_found') || error.message?.includes('not found')) {
        throw new Error("No account found with this email address.");
      } else if (error.message?.includes('rate limit')) {
        throw new Error("Too many reset requests. Please wait before requesting another.");
      } else {
        throw new Error(error.message || "Failed to send password reset email. Please try again.");
      }
    }
  }

  /**
   * Reset password with userId, secret, and new password
   */
  static async resetPassword(userId: string, secret: string, newPassword: string): Promise<boolean> {
    try {
      await updatePasswordWithSecret(userId, secret, newPassword);
      authDebug.info("Password reset successfully", { userId });
      return true;
    } catch (error: any) {
      authDebug.error("Failed to reset password", error);
      
      // Handle specific error cases
      if (error.code === 401 || error.message?.includes('Invalid recovery')) {
        throw new Error("The password reset link is invalid or has expired. Please request a new one.");
      } else if (error.message?.includes('Password must be')) {
        throw new Error("Password does not meet the requirements. Please choose a stronger password.");
      } else {
        throw new Error(error.message || "Could not reset password. Please try again or request a new reset link.");
      }
    }
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string, confirmPassword: string): { isValid: boolean; error?: string } {
    if (!password || !confirmPassword) {
      return { isValid: false, error: "Please fill in all password fields." };
    }

    if (password.length < 8) {
      return { isValid: false, error: "Password must be at least 8 characters long." };
    }

    if (password !== confirmPassword) {
      return { isValid: false, error: "Passwords do not match." };
    }

    // Check for basic password complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return { 
        isValid: false, 
        error: "Password must contain at least one uppercase letter, one lowercase letter, and one number." 
      };
    }

    return { isValid: true };
  }

  /**
   * Show forgot password dialog with email input
   */
  static showForgotPasswordDialog(
    currentEmail: string = "",
    onSuccess?: (email: string) => void,
    onCancel?: () => void
  ) {
    Alert.prompt(
      "Reset Password",
      "Enter your email address and we'll send you a link to reset your password:",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: onCancel
        },
        {
          text: "Send Reset Link",
          onPress: async (email?: string) => {
            if (!email?.trim()) {
              Alert.alert("Error", "Please enter a valid email address.");
              return;
            }

            try {
              await PasswordResetHandler.sendResetEmail(email.trim().toLowerCase());
              Alert.alert(
                "Reset Link Sent",
                `A password reset link has been sent to ${email}. Please check your inbox and spam folder.`,
                [{ text: "OK", onPress: () => onSuccess?.(email) }]
              );
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          }
        }
      ],
      "plain-text",
      currentEmail,
      "email-address"
    );
  }

  /**
   * Show success message after password reset
   */
  static showResetSuccess(onContinue?: () => void) {
    Alert.alert(
      "Password Reset Complete",
      "Your password has been successfully reset. You can now sign in with your new password.",
      [
        {
          text: "Sign In",
          onPress: onContinue
        }
      ]
    );
  }

  /**
   * Validate reset link parameters
   */
  static validateResetLink(
    userId?: string | string[], 
    secret?: string | string[],
    expire?: string | string[]
  ): { isValid: boolean; error?: string } {
    if (!userId || !secret) {
      return { 
        isValid: false, 
        error: "This password reset link is invalid or missing required information." 
      };
    }

    // Handle array parameters from router
    const userIdStr = Array.isArray(userId) ? userId[0] : userId;
    const secretStr = Array.isArray(secret) ? secret[0] : secret;
    const expireStr = Array.isArray(expire) ? expire[0] : expire;

    if (!userIdStr || !secretStr) {
      return { 
        isValid: false, 
        error: "This password reset link is invalid or missing required information." 
      };
    }

    // Check if link has expired (if expire parameter is present)
    if (expireStr) {
      const expireTime = parseInt(expireStr) * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      
      if (currentTime > expireTime) {
        return {
          isValid: false,
          error: "This password reset link has expired. Please request a new password reset."
        };
      }
    }

    return { isValid: true };
  }
}
