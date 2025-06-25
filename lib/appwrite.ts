import { Account, Avatars, Client, Databases, OAuthProvider } from "react-native-appwrite";
import * as Linking from "expo-linking";
import { openAuthSessionAsync } from "expo-web-browser";
import { createUserProfile, getUserProfile } from "@/lib/api/user";

export const config = {
  platform: 'com.Up2.Up2', // Also make sure this matches your Appwrite Platform settings
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!,
  projectID: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!,
  databaseID: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!,
  usersCollectionID: process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID!,
  eventsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID!,
};

export const client = new Client();

client
  .setEndpoint(config.endpoint)
  .setProject(config.projectID)
  .setPlatform(config.platform);

export const avatar = new Avatars(client);
export const account = new Account(client);
export const databases = new Databases(client);

export async function login() {
  try {
    const redirectUri = Linking.createURL('/');
    console.log("Redirect URI:", redirectUri);

    // Manually build the OAuth URL
    const authURL = `${config.endpoint}/account/sessions/oauth2/${OAuthProvider.Google}?project=${config.projectID}&success=${encodeURIComponent(redirectUri)}&failure=${encodeURIComponent(redirectUri)}`;

    // Open in browser
    const browserResult = await openAuthSessionAsync(authURL, redirectUri);
    if (browserResult.type !== 'success') throw new Error('Login was not successful');

    const url = new URL(browserResult.url);
    const secret = url.searchParams.get('secret')?.toString();
    const userId = url.searchParams.get('userId')?.toString();

    if (!secret || !userId) {
      throw new Error('Missing secret or userId in redirect URL');
    }

    await account.createSession(userId, secret);
    const user = await account.get();

    const existingProfile = await getUserProfile(user.$id);
    if (!existingProfile) {
      await createUserProfile({
        id: user.$id,
        name: user.name || "Unnamed",
        isPublic: true,
        preferences: [],
      });
    }

    return true;
  } catch (err) {
    console.error("Login error:", err);
    return false;
  }
}

export async function logout() {
  try {
    await account.deleteSession('current');
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
}

export async function getCurrentUser() {
  try {
    const response = await account.get();
    if (response.$id) {
      const userAvatar = avatar.getInitials(response.name);
      return {
        ...response,
        avatar: userAvatar.toString(),
      };
    }
    return null;
  } catch (error) {
    console.error("Get current user error:", error);
    return null;
  }
}