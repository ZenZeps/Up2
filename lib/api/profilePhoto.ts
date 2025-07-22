import { config, ID, storage } from '@/lib/appwrite/appwrite';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { getUserProfile, updateUserProfile } from './user';

// Get the URL of a profile photo
export const getProfilePhotoUrl = (fileId: string) => {
  try {
    return storage.getFileView(config.profilePhotosBucketID!, fileId).href;
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
    console.log('=== Photo Upload Debug Info ===');
    console.log('User ID:', userId);
    console.log('Image URI:', uri);
    console.log('Bucket ID:', config.profilePhotosBucketID);

    // For React Native, we need to get file info first
    let fileSize = 0;
    try {
      console.log('Attempting to fetch file info...');
      const response = await fetch(uri);
      const blob = await response.blob();
      fileSize = blob.size;
      console.log('File size determined:', fileSize);
    } catch (fetchError) {
      console.warn('Could not determine file size, using default:', fetchError);
      fileSize = 1000000; // Default to 1MB if we can't determine size
    }

    // For React Native, create the file object with required properties
    const file = {
      name: `profile_${userId}_${Date.now()}.jpg`,
      type: 'image/jpeg',
      size: fileSize,
      uri: uri,
    };

    console.log('File object created:', file);
    console.log('Attempting to upload to Appwrite...');

    const uploadedFile = await storage.createFile(
      config.profilePhotosBucketID!,
      ID.unique(),
      file
    );

    console.log('File uploaded successfully:', uploadedFile.$id);

    // Get current user profile
    console.log('Fetching current user profile...');
    const currentProfile = await getUserProfile(userId);

    if (!currentProfile) {
      throw new Error('User profile not found');
    }

    console.log('Updating user profile with photo ID...');
    // Update user profile with the new photo ID in the database
    await updateUserProfile({
      ...currentProfile,
      photoId: uploadedFile.$id,
    });

    console.log('Profile updated successfully with photo ID:', uploadedFile.$id);

    return uploadedFile.$id;
  } catch (err: any) {
    console.error('=== Photo Upload Error ===');
    console.error('Error type:', err.constructor.name);
    console.error('Error message:', err.message);
    console.error('Full error:', err);
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