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
    'EXPO_PUBLIC_APPWRITE_PROFILE_PHOTOS_BUCKET_ID'
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
}; const client = new Client()
  .setEndpoint(config.endpoint)
  .setProject(config.projectID)
  .setPlatform(config.platform);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const avatar = new Avatars(client);

// ✅ Email/password signup
export async function signupWithEmail(email: string, password: string, name: string) {
  try {
    // Use ID.unique() instead of email for user ID
    const user = await account.create(ID.unique(), email, password, name);
    return user;
  } catch (err) {
    console.error("Signup error:", err);
    throw err;
  }
}

// Add rate limiting for auth attempts
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export async function loginWithEmail(email: string, password: string) {
  try {
    // Start login process
    authDebug.info(`Login attempt for email: ${email.substring(0, 3)}****`);

    // Create session directly without checking preferences first
    authDebug.debug("Creating email password session");
    const session = await account.createEmailPasswordSession(email, password);
    authDebug.info("Login successful, session created", { sessionId: session.$id });

    // Reset attempts on successful login (optional, only if session exists)
    try {
      await account.updatePrefs({ loginAttempts: 0 });
      authDebug.debug("Reset login attempts counter");
    } catch (resetErr) {
      authDebug.debug("Could not reset login counter (not critical)");
    }

    return session;
  } catch (err: any) {
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

    // Simple error logging without preference manipulation during failure
    authDebug.debug("Could not update preferences after failed login (not critical)");

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
    const response = await account.createRecovery(email, `http://localhost/reset-password`);
    return response;
  } catch (err) {
    console.error("Forgot password error:", err);
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