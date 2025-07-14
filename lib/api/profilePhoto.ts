import { account, ID, storage } from '@/lib/appwrite/appwrite';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { getUserProfile, updateUserProfile } from './user';

// Get the URL of a profile photo
export const getProfilePhotoUrl = (fileId: string) => {
  try {
    return storage.getFileView(process.env.EXPO_PUBLIC_APPWRITE_PROFILE_PHOTOS_BUCKET_ID!, fileId).href;
  } catch (error) {
    console.error('Error getting profile photo URL:', error);
    return null;
  }
};

// Pick a profile photo from the device's library
export const pickProfilePhoto = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled) {
    throw new Error('Image selection was cancelled');
  }

  return result.assets[0];
};

// Upload a profile photo and return the file ID
export const uploadProfilePhoto = async (userId: string, uri: string) => {
  try {
    // Get file size
    const response = await fetch(uri);
    const blob = await response.blob();

    // For React Native, create file object with required properties
    const file = {
      name: 'profile_photo.jpg',
      type: 'image/jpeg',
      size: blob.size,
      uri: uri,
    };

    const uploadedFile = await storage.createFile(
      process.env.EXPO_PUBLIC_APPWRITE_PROFILE_PHOTOS_BUCKET_ID!,
      ID.unique(),
      file
    );

    // Get current user profile
    const currentProfile = await getUserProfile(userId);
    
    if (!currentProfile) {
      throw new Error('User profile not found');
    }
    
    // Update user profile with the new photo ID in the database
    await updateUserProfile({
      ...currentProfile,
      photoId: uploadedFile.$id,
    });

    // Also update user preferences as a backup
    await account.updatePrefs({ ...await account.getPrefs(), photoId: uploadedFile.$id });

    return uploadedFile.$id;
  } catch (err) {
    console.error('Error uploading profile photo:', err);
    throw err;
  }
};

// Get profile photo URL for a user (from their profile)
export const getUserProfilePhotoUrl = async (userId: string) => {
  try {
    const userProfile = await getUserProfile(userId);
    if (userProfile?.photoId) {
      return getProfilePhotoUrl(userProfile.photoId);
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile photo URL:', error);
    return null;
  }
};