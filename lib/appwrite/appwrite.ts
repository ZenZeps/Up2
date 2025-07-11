import { Account, Avatars, Client, Databases, ID, Query, Storage } from "react-native-appwrite";

export { ID, Query };

export const config = {
  platform: "com.Up2.Up2",
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!,
  projectID: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!,
  databaseID: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!,
  usersCollectionID: process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID!,
  eventsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID!,
  friendRequestsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_FRIENDREQUESTS_COLLECTION_ID!,
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
    const preferences = await account.getPrefs();
    const loginAttempts = preferences.loginAttempts || 0;
    const lastAttemptTime = preferences.lastLoginAttempt || 0;

    // Check if user is locked out
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      const timeElapsed = Date.now() - lastAttemptTime;
      if (timeElapsed < LOCKOUT_DURATION) {
        throw new Error(`Too many login attempts. Please try again in ${Math.ceil((LOCKOUT_DURATION - timeElapsed) / 60000)} minutes.`);
      }
      // Reset attempts after lockout period
      await account.updatePrefs({ loginAttempts: 0 });
    }

    const session = await account.createEmailPasswordSession(email, password);

    // Reset attempts on successful login
    await account.updatePrefs({ loginAttempts: 0 });

    return session;
  } catch (err) {
    console.error("Login error:", err);

    // Increment login attempts on failure
    const preferences = await account.getPrefs();
    const loginAttempts = (preferences.loginAttempts || 0) + 1;
    await account.updatePrefs({
      loginAttempts,
      lastLoginAttempt: Date.now()
    });

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
  try {
    const response = await account.get();
    if (response.$id) {
      const userAvatar = avatar.getInitials(response.name); //Get avatar
      return {
        ...response,
        avatar: userAvatar.toString(), // Adds avatar to response string
      };
    }
    return null;
  } catch (error: any) {
    // Suppress "missing scope (account)" error
    if (
      error?.message?.includes('missing scope (account)') ||
      error?.message?.includes('User (role: guests)')
    ) {
      return null;
    }
    console.error("Get current user error:", error);
    return null;
  }
}

// Add session security enhancements
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

export async function createSecureSession(email: string, password: string) {
  const session = await loginWithEmail(email, password);

  // Set session expiry
  await account.updateSession(
    session.$id,
    SESSION_DURATION
  );

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