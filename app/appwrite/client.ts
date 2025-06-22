import { Client, Account, Databases } from 'react-native-appwrite';

export const appwriteConfig = {
  endpointURL: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!,
  projectID: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!,
  apiKey: process.env.EXPO_PUBLIC_API_KEY!,
  databaseID: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!,
  usersCollectionID: process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID!,
  eventsCollectionID: process.env.EXPO_PUBLIC_APPWRITE_EVENTS_COLLECTION_ID!,
};

const client = new Client()
  .setEndpoint(appwriteConfig.endpointURL)
  .setProject(appwriteConfig.projectID);

const account = new Account(client);
const databases = new Databases(client);

export { client, account, databases };
