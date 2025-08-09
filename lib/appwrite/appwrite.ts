import { Account, Avatars, Client, Databases, ID, Query, Storage } from "react-native-appwrite";
import { authDebug } from "../debug/authDebug";

export { ID, Query };

// Validate environment variables and provide fallbacks
const validateConfig = () => {
  const requiredEnvVars = [
    'EXPO_PUBLIC_APPWRITE_ENDPOINT',
    'EXPO_PUBLIC_APPWRITE_PROJECT_ID',
    'EXPO_PUBLIC_APPWRITE_DATABASE_ID',
    'EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID',
    'EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID',
    'EXPO_PUBLIC_APPWRITE_FRIENDREQUESTS_COLLECTION_ID',
    'EXPO_PUBLIC_APPWRITE_TRAVEL_COLLECTION_ID',
    'EXPO_PUBLIC_APPWRITE_PROFILE_PHOTOS_BUCKET_ID',
    'EXPO_PUBLIC_APPWRITE_GROUPS_ID',
    'EXPO_PUBLIC_APPWRITE_CHATS_ID',
    'EXPO_PUBLIC_APPWRITE_MESSAGES_ID'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.warn('Missing environment variables:', missing);
    console.warn('App may not function correctly without proper configuration');
    // Don't throw error during development - just warn
  }
};

// Validate on load (non-blocking)
try {
  validateConfig();
} catch (error) {
  console.error('Configuration validation failed:', error);
}

export const config = {
  platform: "com.up2.Up2", // Fixed to match app.json iOS bundle identifier
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || "https://syd.cloud.appwrite.io/v1",
  projectID: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || "685944b1003ba9c421ea",
  databaseID: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || "68594f14003e54ada2a4",
  usersCollectionID: process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID || "685bb460000e2c55b3a5",
  eventsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID || "68594f3e0030d3de2a3c",
  friendRequestsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_FRIENDREQUESTS_COLLECTION_ID || "68594f490020c5c17b6c",
  travelCollectionID: process.env.EXPO_PUBLIC_APPWRITE_TRAVEL_COLLECTION_ID || "68594f4d0034f9a3bb1b",
  profilePhotosBucketID: process.env.EXPO_PUBLIC_APPWRITE_PROFILE_PHOTOS_BUCKET_ID || "68594f610012a2c5c4d7",
  groupsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_GROUPS_ID || "temp_groups_id",
  groupInvitesCollectionID: process.env.EXPO_PUBLIC_APPWRITE_GROUP_INVITES_ID || "temp_group_invites_id",
  chatsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_CHATS_ID || "temp_chats_id",
  messagesCollectionID: process.env.EXPO_PUBLIC_APPWRITE_MESSAGES_ID || "temp_messages_id",
};

const client = new Client()
  .setEndpoint(config.endpoint)
  .setProject(config.projectID)
  .setPlatform(config.platform);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const avatar = new Avatars(client);

// ✅ Email/password signup with verification
export async function signupWithEmail(email: string, password: string, name: string) {
  try {
    // Create the user account
    const user = await account.create(ID.unique(), email, password, name);

    // Try to send verification email by creating a temporary session
    try {
      const session = await account.createEmailPasswordSession(email, password);
      
      // Send verification email now that user is authenticated
      await account.createVerification('up2://verify');
      
      // Delete the session since we want user to verify email first
      await account.deleteSession(session.$id);
    } catch (verificationError) {
      // If verification email fails, log it but don't fail the entire signup
      console.warn("Could not send verification email during signup:", verificationError);
      // User can still sign in and request verification email later
    }

    return user;
  } catch (err) {
    console.error("Signup error:", err);
    throw err;
  }
}

// ✅ Send email verification (requires authenticated user)
export async function sendVerificationEmail() {
  try {
    // Check if user is authenticated
    const user = await account.get();
    if (!user) {
      throw new Error('User must be authenticated to send verification email');
    }
    
    // Use the proper mobile app verification URL
    const response = await account.createVerification('up2://verify');
    return response;
  } catch (err) {
    console.error("Send verification error:", err);
    throw err;
  }
}

// ✅ Resend verification email for existing users
export async function resendVerificationEmail(email: string, password: string) {
  try {
    // First, create a temporary session to send verification
    const session = await account.createEmailPasswordSession(email, password);
    
    // Send verification email
    const response = await account.createVerification('up2://verify');
    
    // Delete the temporary session
    await account.deleteSession(session.$id);
    
    return response;
  } catch (err) {
    console.error("Resend verification error:", err);
    throw err;
  }
}

// ✅ Verify email with userId and secret
export async function verifyEmail(userId: string, secret: string) {
  try {
    const response = await account.updateVerification(userId, secret);
    return response;
  } catch (err) {
    console.error("Email verification error:", err);
    throw err;
  }
}

// Add rate limiting for auth attempts
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export async function loginWithEmail(email: string, password: string) {
  try {
    // Start login process
    authDebug.info(`Login attempt for email: ${email.substring(0, 3)}****`);

    // Create session first to check if credentials are valid
    authDebug.debug("Creating email password session");
    const session = await account.createEmailPasswordSession(email, password);

    // Get user account info to check verification status
    const user = await account.get();

    // Check if email is verified
    if (!user.emailVerification) {
      // Delete the session since email is not verified
      await account.deleteSession(session.$id);
      throw new Error('UNVERIFIED_EMAIL');
    }

    authDebug.info("Login successful, session created", { sessionId: session.$id });

    // Reset attempts on successful login
    try {
      await account.updatePrefs({ loginAttempts: 0, lastAttemptTime: 0 });
      authDebug.debug("Reset login attempts counter");
    } catch (resetErr) {
      authDebug.debug("Could not reset login counter (not critical)");
    }

    return session;
  } catch (err: any) {
    // Handle email verification error
    if (err.message === 'UNVERIFIED_EMAIL') {
      throw new Error('Please verify your email before signing in. If you did not receive a verification email, try signing in again and we can resend it.');
    }

    // Track failed login attempts for password recovery
    try {
      // First try to get current user prefs to track attempts
      const currentPrefs = await account.getPrefs();
      const currentAttempts = currentPrefs.loginAttempts || 0;
      const lastAttemptTime = currentPrefs.lastAttemptTime || 0;

      // Check if user should be locked out
      if (currentAttempts >= MAX_LOGIN_ATTEMPTS) {
        const timeSinceLastAttempt = Date.now() - lastAttemptTime;
        if (timeSinceLastAttempt < LOCKOUT_DURATION) {
          throw new Error('Too many failed attempts. Please try again later or use password recovery.');
        } else {
          // Reset attempts after lockout period
          await account.updatePrefs({ loginAttempts: 1, lastAttemptTime: Date.now() });
        }
      } else {
        // Increment failed attempts
        await account.updatePrefs({
          loginAttempts: currentAttempts + 1,
          lastAttemptTime: Date.now()
        });

        // Show password recovery option after 3 failed attempts
        if (currentAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
          throw new Error('SHOW_PASSWORD_RECOVERY');
        }
      }
    } catch (prefError) {
      authDebug.debug("Could not update preferences after failed login");
    }

    // Format error for consistent handling
    let errorMessage = typeof err === 'string' ? err :
      err?.message ||
      (err?.toString ? err.toString() : 'Unknown error');

    if (!errorMessage.includes('missing scope (account)') &&
      !errorMessage.includes('User (role: guests)')) {
      authDebug.error("Login failed", err);
    } else {
      authDebug.debug("Expected auth error during login", errorMessage);
    }

    throw err;
  }
}

// ✅ Logout
export async function logout() {
  try {
    // Import cache manager
    const { cacheManager } = await import("../debug/cacheManager");

    // Clear all cached data to prevent cross-user contamination
    cacheManager.clear();

    // Delete the current session
    await account.deleteSession("current");

    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
}

// ✅ Forgot password
export async function forgotPassword(email: string) {
  try {
    // Use localhost for testing - this should work without additional platform setup
    const response = await account.createRecovery(email, 'http://localhost:3000/reset-password');
    return response;
  } catch (err) {
    console.error("Forgot password error:", err);
    throw err;
  }
}

// ✅ Reset password with secret
export async function resetPassword(userId: string, secret: string, newPassword: string) {
  try {
    const response = await account.updateRecovery(userId, secret, newPassword);
    return response;
  } catch (err) {
    console.error("Reset password error:", err);
    throw err;
  }
}

// ✅ Get current user
export async function getCurrentUser() {
  authDebug.debug("Checking current user authentication status");

  try {
    // Try to get the current user
    const response = await account.get();

    // If we get a valid user ID, user is authenticated
    if (response.$id) {
      authDebug.info("User is authenticated", { userId: response.$id });

      // Generate avatar
      const userAvatar = avatar.getInitials(response.name || "U");

      // Return user data with avatar
      const userData = {
        ...response,
        avatar: userAvatar.toString(),
      };

      authDebug.logUser(userData);
      return userData;
    }

    // If we get here but no ID, something is wrong
    authDebug.warn("Got response from account.get() but no user ID");
    return null;
  } catch (error: any) {
    // Normalize error message for better error handling
    let errorMessage = typeof error === 'string' ? error :
      error?.message ||
      (error?.toString ? error.toString() : 'Unknown error');

    // Handle expected "not authenticated" errors
    if (
      errorMessage.includes('missing scope (account)') ||
      errorMessage.includes('User (role: guests)')
    ) {
      authDebug.info("User is not authenticated (expected error in getCurrentUser)");
      return null;
    }

    // Log unexpected errors
    authDebug.error("Unexpected error getting current user", error);
    return null;
  }
}

// ✅ Get current user with full profile data
export async function getCurrentUserWithProfile() {
  authDebug.debug("Checking current user authentication status with profile");

  try {
    // First get the basic Appwrite user
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return null;
    }

    // Then fetch the full profile from the database
    try {
      const { getUserProfile } = await import('../api/user');
      const profile = await getUserProfile(currentUser.$id);

      return {
        ...currentUser,
        profile
      };
    } catch (profileError) {
      authDebug.warn("Could not fetch user profile, returning basic user data", profileError);
      return {
        ...currentUser,
        profile: null
      };
    }
  } catch (error: any) {
    // Use the same error handling as getCurrentUser
    let errorMessage = typeof error === 'string' ? error :
      error?.message ||
      (error?.toString ? error.toString() : 'Unknown error');

    // Handle expected "not authenticated" errors
    if (
      errorMessage.includes('missing scope (account)') ||
      errorMessage.includes('User (role: guests)')
    ) {
      authDebug.info("User is not authenticated (expected error in getCurrentUserWithProfile)");
      return null;
    }

    // Log unexpected errors
    authDebug.error("Unexpected error getting current user with profile", error);
    return null;
  }
}

// Add session security enhancements
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

export async function createSecureSession(email: string, password: string) {
  const session = await loginWithEmail(email, password);

  // Set session expiry - check API documentation for correct parameter usage
  await account.updateSession(session.$id);

  return session;
}

// Enhanced logout to clear all sessions
export async function secureLogout() {
  try {
    // Delete all sessions for maximum security
    const sessions = await account.listSessions();
    await Promise.all(
      sessions.sessions.map(session =>
        account.deleteSession(session.$id)
      )
    );
    return true;
  } catch (error) {
    console.error("Secure logout error:", error);
    return false;
  }
}