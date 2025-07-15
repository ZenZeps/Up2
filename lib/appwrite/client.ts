import { Account, Avatars, Client, Databases, Storage } from "react-native-appwrite";
import { authDebug } from "../debug/authDebug";

// Exported configuration 
export const config = {
  platform: "com.up2.Up2", // Fixed to match app.json iOS bundle identifier
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!,
  projectID: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!,
  databaseID: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!,
  usersCollectionID: process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID!,
  eventsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID!,
};

// Initialize Appwrite client
const client = new Client();

// Configure client with debug logs
authDebug.info("Initializing Appwrite client", {
  endpoint: config.endpoint,
  projectID: config.projectID,
  platform: config.platform
});

client
  .setEndpoint(config.endpoint)
  .setProject(config.projectID)
  .setPlatform(config.platform);

// Export client services
export const account = new Account(client);
export const databases = new Databases(client);
export const avatar = new Avatars(client);
export const storage = new Storage(client);

// NOTE: All auth functions have been moved to appwrite.ts
// This file only exports the client configuration