import { databases } from '@/lib/appwrite';
import { ID } from 'react-native-appwrite';
import { config } from '@/lib/appwrite';
import { UserProfile } from '@/app/(root)/types/Users';

export async function createUserProfile(profile: UserProfile) {
  try {
    await databases.createDocument(
      config.databaseID!,
      config.usersCollectionID!,
      profile.id || ID.unique(),
      {
        name: profile.name,
        isPublic: profile.isPublic,
        preferences: profile.preferences,
      }
    );
  } catch (err: any) {
    if (!err.message.includes("already exists")) {
      console.error("Error creating user profile:", err);
    }
  }
}

export async function getUserProfile(id: string): Promise<UserProfile | null> {
  try {
    const doc = await databases.getDocument(
      config.databaseID!,
      config.usersCollectionID!,
      id
    );
    return {
      id: doc.$id,
      name: doc.name,
      isPublic: doc.isPublic,
      preferences: doc.preferences,
    };
  } catch (err) {
    return null;
  }
}
export async function updateUserProfile(profile: UserProfile) {
  try {
    await databases.updateDocument(
      config.databaseID!,
      config.usersCollectionID!,
      profile.id,
      {
        name: profile.name,
        isPublic: profile.isPublic,
        preferences: profile.preferences,
      }
    );
  } catch (err) {
    console.error("Error updating user profile:", err);
  }
}

