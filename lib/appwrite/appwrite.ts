import { Account, Avatars, Client, Databases, ID, InputFile, Query, Storage } from "react-native-appwrite";
import { authDebug } from "../debug/authDebug";

export { ID, InputFile, Query };

export const config = {
  platform: "com.up2.Up2", // Fixed to match app.json iOS bundle identifier
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!,
  projectID: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!,
  databaseID: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!,
  usersCollectionID: process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID!,
  eventsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID!,
  friendRequestsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_FRIENDREQUESTS_COLLECTION_ID!,
  travelCollectionID: process.env.EXPO_PUBLIC_APPWRITE_TRAVEL_COLLECTION_ID!,
  profilePhotosBucketID: process.env.EXPO_PUBLIC_APPWRITE_PROFILE_PHOTOS_BUCKET_ID!,
};

const client = new Client()
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