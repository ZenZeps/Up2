import { config, databases } from '@/lib/appwrite/appwrite';
import { UserProfile } from '@/lib/types/Users';
import { Permission, Query, Role } from 'react-native-appwrite';
import { authDebug } from '../debug/authDebug';
import { cacheManager } from '../debug/cacheManager';

// Cache constants
const USER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const USERS_COLLECTION_CACHE_KEY = 'all-users';

/**
 * Creates a user profile in the database. Must use the actual Appwrite user ID.
 */
export async function createUserProfile(profile: UserProfile) {
  if (!profile?.$id) {
    authDebug.error("Cannot create profile: Missing '$id' in profile", profile);
    throw new Error("User ID is required to create a profile");
  }

  try {
    authDebug.info(`Creating user profile for: ${profile.$id}`);

    const res = await databases.createDocument(
      config.databaseID!,
      config.usersCollectionID!,
      profile.$id,
      {
        id: profile.$id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        isPublic: profile.isPublic,
        preferences: profile.preferences,
        friends: profile.friends ?? [],
        photoId: profile.photoId,
      },
      [
        Permission.read(Role.any()), // or Role.user(profile.$id) for private
        Permission.update(Role.user(profile.$id)),
      ]
    );

    // Cache the new profile
    cacheManager.set<UserProfile>(`user-${profile.$id}`, profile, USER_CACHE_TTL);

    // Invalidate users collection cache
    cacheManager.remove(USERS_COLLECTION_CACHE_KEY);

    authDebug.info("Created user profile successfully:", { id: profile.$id });
    return res;
  } catch (err: any) {
    if (!err.message?.includes("already exists")) {
      authDebug.error("Error creating user profile:", err);
      throw err;
    } else {
      authDebug.warn("User profile already exists:", { id: profile.$id });
    }
  }
}

/**
 * Fetch a single user profile by document ID with caching.
 */
export async function getUserProfile(id: string): Promise<UserProfile | null> {
  // Check cache first
  const cacheKey = `user-${id}`;
  const cachedProfile = cacheManager.get<UserProfile>(cacheKey);

  if (cachedProfile) {
    authDebug.debug(`Returning cached user profile: ${id}`);
    return cachedProfile;
  }

  try {
    authDebug.debug(`Fetching user profile: ${id}`);

    const response = await databases.listDocuments(
      config.databaseID!,
      config.usersCollectionID!,
      [
        Query.equal('$id', id),
      ]
    );

    if (response.documents.length === 0) {
      authDebug.warn(`User profile not found: ${id}`);
      return null;
    }

    const profile = response.documents[0] as unknown as UserProfile;

    // Cache the profile
    cacheManager.set<UserProfile>(cacheKey, profile, USER_CACHE_TTL);

    return profile;
  } catch (err) {
    authDebug.error(`Error fetching user profile: ${id}`, err);
    return null;
  }
}

/**
 * Update a user profile with caching support
 */
export async function updateUserProfile(profile: UserProfile) {
  try {
    authDebug.info(`Updating user profile: ${profile.$id}`);

    const res = await databases.updateDocument(
      config.databaseID!,
      config.usersCollectionID!,
      profile.$id,
      {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        isPublic: profile.isPublic,
        preferences: profile.preferences,
        friends: profile.friends,
        photoId: profile.photoId,
      }
    );

    // Update cache
    cacheManager.set<UserProfile>(`user-${profile.$id}`, profile, USER_CACHE_TTL);

    // Invalidate users collection cache
    cacheManager.remove(USERS_COLLECTION_CACHE_KEY);

    authDebug.info(`Updated user profile successfully: ${profile.$id}`);
    return res;
  } catch (err) {
    authDebug.error(`Error updating user profile: ${profile.$id}`, err);
    throw err;
  }
}

/**
 * Get all users with caching support
 */
export async function getAllUsers(useCache = true): Promise<UserProfile[]> {
  // Check cache first if enabled
  if (useCache) {
    const cachedUsers = cacheManager.get<UserProfile[]>(USERS_COLLECTION_CACHE_KEY);
    if (cachedUsers) {
      authDebug.debug('Returning cached users list', { count: cachedUsers.length });
      return cachedUsers;
    }
  }

  try {
    authDebug.info('Fetching all users from database');

    const response = await databases.listDocuments(
      config.databaseID!,
      config.usersCollectionID!
    );

    const users = response.documents as unknown as UserProfile[];

    // Cache the collection and individual users
    cacheManager.set<UserProfile[]>(USERS_COLLECTION_CACHE_KEY, users, USER_CACHE_TTL);

    users.forEach(user => {
      cacheManager.set<UserProfile>(`user-${user.$id}`, user, USER_CACHE_TTL);
    });

    return users;
  } catch (err) {
    authDebug.error('Error fetching all users:', err);
    return [];
  }
}

/**
 * Get users by IDs with optimized batching and caching
 */
export async function getUsersByIds(ids: string[]): Promise<UserProfile[]> {
  if (!ids.length) return [];

  // Generate cache key for this specific batch
  const cacheKey = `users-batch-${ids.sort().join('-')}`;
  const cachedBatch = cacheManager.get<UserProfile[]>(cacheKey);

  if (cachedBatch) {
    authDebug.debug('Returning cached user batch', { count: cachedBatch.length });
    return cachedBatch;
  }

  // Check individual caches first
  const cachedUsers: UserProfile[] = [];
  const uncachedIds: string[] = [];

  for (const id of ids) {
    const cachedUser = cacheManager.get<UserProfile>(`user-${id}`);
    if (cachedUser) {
      cachedUsers.push(cachedUser);
    } else {
      uncachedIds.push(id);
    }
  }

  // If all users were cached, return them
  if (uncachedIds.length === 0) {
    authDebug.debug('All users found in cache', { count: cachedUsers.length });
    return cachedUsers;
  }

  // Fetch missing users
  try {
    authDebug.info('Fetching users batch from database', { count: uncachedIds.length });

    // Using $id in array queries
    const response = await databases.listDocuments(
      config.databaseID!,
      config.usersCollectionID!,
      [Query.equal('$id', uncachedIds)]
    );

    const fetchedUsers = response.documents as unknown as UserProfile[];

    // Cache individual users
    fetchedUsers.forEach(user => {
      cacheManager.set<UserProfile>(`user-${user.$id}`, user, USER_CACHE_TTL);
    });

    // Combine cached and fetched users
    const result = [...cachedUsers, ...fetchedUsers];

    // Cache the batch result
    cacheManager.set<UserProfile[]>(cacheKey, result, USER_CACHE_TTL);

    return result;
  } catch (err) {
    authDebug.error('Error fetching users by IDs:', err);
    // Return whatever we got from cache
    return cachedUsers;
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

    // Fetch all friend profiles in a single query
    const friendProfiles = await getUsersByIds(userProfile.friends);

    return friendProfiles;
  } catch (error) {
    console.error("Error getting friends:", error);
    return [];
  }
};