import { Account, Avatars, Client, Databases, Storage } from "react-native-appwrite";
import { authDebug } from "../debug/authDebug";

// Exported configuration with fallbacks
export const config = {
  platform: "com.up2.Up2", // Fixed to match app.json iOS bundle identifier
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || "https://syd.cloud.appwrite.io/v1",
  projectID: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || "685944b1003ba9c421ea",
  databaseID: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || "68594f14003e54ada2a4",
  usersCollectionID: process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID || "685bb460000e2c55b3a5",
  eventsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID || "68594f3e0030d3de2a3c",
};

// Initialize Appwrite client
const client = new Client();

// Configure client with debug logs
authDebug.info("Initializing Appwrite client", {
  endpoint: config.endpoint,
  projectID: config.projectID,
  platform: config.platform
});

try {
  client
    .setEndpoint(config.endpoint)
    .setProject(config.projectID)
    .setPlatform(config.platform);
} catch (error) {
  console.error("Failed to initialize Appwrite client:", error);
  authDebug.error("Client initialization failed", { error });
}

// Export client services
export const account = new Account(client);
export const databases = new Databases(client);
export const avatar = new Avatars(client);
export const storage = new Storage(client);

// NOTE: All auth functions have been moved to appwrite.ts
// This file only exports the client configuration