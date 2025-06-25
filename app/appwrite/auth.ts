import { Account, Avatars, Client, Databases, ID } from "react-native-appwrite";

export const config = {
  platform: "com.Up2.Up2",
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!,
  projectID: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!,
  databaseID: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!,
  usersCollectionID: process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID!,
  eventsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID!,
};

const client = new Client();

client
  .setEndpoint(config.endpoint)
  .setProject(config.projectID)
  .setPlatform(config.platform);

export const account = new Account(client);
export const databases = new Databases(client);
export const avatar = new Avatars(client);

// ✅ Email/password signup
export async function signupWithEmail(email: string, password: string, name: string) {
  try {
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

// ✅ Get current user with avatar
export async function getCurrentUser() {
  try {
    const user = await account.get();
    if (!user?.$id) return null;

    const userAvatar = avatar.getInitials(user.name || "U");
    return {
      ...user,
      avatar: userAvatar.toString(),
    };
  } catch (error) {
    console.error("Get current user error:", error);
    return null;
  }
}
