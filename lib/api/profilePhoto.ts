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
    let fileInfo: any = null;

    try {
      console.log('Attempting to fetch file info...');
      // Try to get file info using React Native FileSystem if available
      const response = await fetch(uri, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        fileSize = parseInt(contentLength, 10);
        console.log('File size determined from headers:', fileSize);
      } else {
        // Fallback to blob method
        const fullResponse = await fetch(uri);
        const blob = await fullResponse.blob();
        fileSize = blob.size;
        console.log('File size determined from blob:', fileSize);
      }
    } catch (fetchError) {
      console.warn('Could not determine file size, using default:', fetchError);
      fileSize = 100000; // Smaller default size (100KB)
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

    let uploadedFile;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        uploadedFile = await storage.createFile(
          config.profilePhotosBucketID!,
          ID.unique(),
          file
        );
        console.log('File uploaded successfully:', uploadedFile.$id);
        break; // Success, exit retry loop
      } catch (uploadError: any) {
        retryCount++;
        console.warn(`Upload attempt ${retryCount} failed:`, uploadError.message);

        if (retryCount >= maxRetries) {
          throw uploadError; // Max retries reached, throw the error
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (!uploadedFile) {
      throw new Error('File upload failed after all retry attempts');
    }

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