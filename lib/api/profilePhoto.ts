import { config, databases, storage } from '@/lib/appwrite/appwrite';
import { validateInput } from '@/lib/utils/validation';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { ID } from 'react-native-appwrite';

export async function pickProfilePhoto() {
    // Request permission
    if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            throw new Error('Permission to access media library was denied');
        }
    }

    // Pick the image
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        maxWidth: 1000,
        maxHeight: 1000,
    });

    if (result.canceled) {
        throw new Error('Image selection was cancelled');
    }

    return result.assets[0];
}

export async function uploadProfilePhoto(userId: string, imageUri: string) {
    try {
        // Convert image URI to Blob
        const response = await fetch(imageUri);
        const blob = await response.blob();

        // Validate file
        if (!validateInput.imageFile(blob as File)) {
            throw new Error('Invalid image file. Please upload a JPEG, PNG, or GIF under 5MB.');
        }

        // Upload to Appwrite Storage
        const file = await storage.createFile(
            config.profilePhotosBucketID,
            ID.unique(),
            blob
        );

        // Update user profile with new photo ID
        await databases.updateDocument(
            config.databaseID,
            config.usersCollectionID,
            userId,
            {
                photoId: file.$id
            }
        );

        return file.$id;
    } catch (error) {
        console.error('Error uploading profile photo:', error);
        throw error;
    }
}

export async function getProfilePhotoUrl(photoId: string) {
    try {
        const result = await storage.getFileView(config.profilePhotosBucketID, photoId);
        return result.href;
    } catch (error) {
        console.error('Error getting profile photo URL:', error);
        return null;
    }
}

export async function deleteProfilePhoto(userId: string, photoId: string) {
    try {
        // Delete from storage
        await storage.deleteFile(config.profilePhotosBucketID, photoId);

        // Update user profile
        await databases.updateDocument(
            config.databaseID,
            config.usersCollectionID,
            userId,
            {
                photoId: null
            }
        );
    } catch (error) {
        console.error('Error deleting profile photo:', error);
        throw error;
    }
} 