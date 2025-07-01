import { databases, config } from '@/lib/appwrite/appwrite';
import { Query, ID, Permission, Role } from 'react-native-appwrite';
import { UserProfile } from '@/lib/types/Users';

/**
 * Creates a user profile in the database. Must use the actual Appwrite user ID.
 */
export async function createUserProfile(profile: UserProfile) {
  if (!profile?.$id) {
    console.error("❌ Cannot create profile: Missing '$id' in profile", profile);
    throw new Error("User ID is required to create a profile");
  }

  try {
    const res = await databases.createDocument(
      config.databaseID!,
      config.usersCollectionID!,
      profile.$id,
      {
        id: profile.$id,
        name: profile.name,
        email: profile.email,
        isPublic: profile.isPublic,
        preferences: profile.preferences,
        friends: profile.friends ?? [],
      },
      [
        Permission.read(Role.any()), // or Role.user(profile.$id) for private
        Permission.update(Role.user(profile.$id)),
      ]
    );
    console.log("✅ Created user profile:", res);
  } catch (err: any) {
    if (!err.message?.includes("already exists")) {
      console.error("❌ Error creating user profile:", err);
    }
  }
}

/**
 * Fetch a single user profile by document ID.
 */
export async function getUserProfile(id: string): Promise<UserProfile | null> {
  try {
    const doc = await databases.getDocument(
      config.databaseID!,
      config.usersCollectionID!,
      id
    );
    return {
      $id: doc.$id,
      name: doc.name,
      email: doc.email,
      isPublic: doc.isPublic,
      preferences: doc.preferences,
      friends: doc.friends ?? [], // <-- add this line
    };
  } catch (err) {
    return null;
  }
}

/**
 * Update a user profile.
 */
export const updateUserProfile = async ({
  $id,
  name,
  email,
  isPublic,
  preferences,
  friends,
}: UserProfile): Promise<void> => {
  await databases.updateDocument(
    config.databaseID!,
    config.usersCollectionID,
    $id,
    {
      name,
      email,
      isPublic,
      preferences,
      friends,
    }
  );
};

/**
 * Fetch all user profiles. Optionally filter by isPublic=true.
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const res = await databases.listDocuments(
      config.databaseID!,
      config.usersCollectionID!,
      [
        Query.limit(100),
        // You can add this back if you're filtering public users only:
        // Query.equal("isPublic", true),
      ]
    );

    console.log("🔍 getAllUsers:", res.documents);

    return res.documents.map((doc: any) => ({
      $id: doc.$id,
      name: doc.name,
      email: doc.email,
      isPublic: doc.isPublic,
      preferences: doc.preferences,
      friends: doc.friends ?? [],
      
    }));
  } catch (err) {
    console.error("❌ Error fetching all users:", err);
    return [];
  }
}

/**
 * Fetch user's friends.
 */
export const getFriends = async (userId: string): Promise<UserProfile[]> => {
  try {
    const userProfile = await getUserProfile(userId);
    if (!userProfile || !userProfile.friends || userProfile.friends.length === 0) {
      return [];
    }

    const friendProfiles = await Promise.all(
      userProfile.friends.map((friendId) => getUserProfile(friendId))
    );
    return friendProfiles.filter((profile): profile is UserProfile => profile !== null);
  } catch (error) {
    console.error("Error getting friends:", error);
    return [];
  }
};