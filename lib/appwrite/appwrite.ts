import { Account, Avatars, Client, Databases, ID, Query } from "react-native-appwrite";

export { ID, Query };

export const config = {
  platform: "com.Up2.Up2",
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!,
  projectID: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!,
  databaseID: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!,
  usersCollectionID: process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID!,
  eventsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID!,
  friendRequestsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_FRIENDREQUESTS_COLLECTION_ID!,
};

export const client = new Client();

client
  .setEndpoint(config.endpoint)
  .setProject(config.projectID)
  .setPlatform(config.platform);

export const avatar = new Avatars(client);
export const account = new Account(client);
export const databases = new Databases(client);

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

// ✅ Email/password login
export async function loginWithEmail(email: string, password: string) {
  try {
    const session = await account.createEmailPasswordSession(email, password);
    return session;
  } catch (err) {
    console.error("Login error:", err);
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