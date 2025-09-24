import { config, ID, storage } from './appwrite';

export interface EventPhoto {
    $id: string;
    url: string;
    eventId: string;
    uploadedBy: string;
    createdAt: Date;
}

/**
 * Upload a photo for an event
 * @param eventId - The ID of the event
 * @param photoUri - The local URI of the photo to upload
 * @param userId - The ID of the user uploading the photo
 * @returns Promise<EventPhoto>
 */
export async function uploadEventPhoto(
    eventId: string,
    photoUri: string,
    userId: string
): Promise<EventPhoto> {
    try {
        // Convert photo URI to a file format compatible with React Native Appwrite
        const response = await fetch(photoUri);
        const blob = await response.blob();

        // Create a file object compatible with React Native Appwrite SDK
        const file = {
            name: `event_${eventId}_${Date.now()}.jpg`,
            type: 'image/jpeg',
            size: blob.size,
            uri: photoUri,
        };

        // Upload to Appwrite Storage
        const uploadedFile = await storage.createFile(
            config.eventPhotosBucketID,
            ID.unique(),
            file,
            [
                // Permissions: Allow creator to read/update/delete, others to read
                `read("any")`,
                `update("user:${userId}")`,
                `delete("user:${userId}")`,
            ]
        );

        // Get the public URL for the uploaded file
        const photoUrl = storage.getFileView(config.eventPhotosBucketID, uploadedFile.$id);

        return {
            $id: uploadedFile.$id,
            url: photoUrl.toString(),
            eventId,
            uploadedBy: userId,
            createdAt: new Date(uploadedFile.$createdAt),
        };
    } catch (error) {
        console.error('Error uploading event photo:', error);
        throw new Error('Failed to upload event photo');
    }
}

/**
 * Get the public URL for an event photo
 * @param photoId - The ID of the photo file
 * @returns string - The public URL
 */
export function getEventPhotoUrl(photoId: string): string {
    return storage.getFileView(config.eventPhotosBucketID, photoId).toString();
}

/**
 * Delete an event photo
 * @param photoId - The ID of the photo file to delete
 * @returns Promise<void>
 */
export async function deleteEventPhoto(photoId: string): Promise<void> {
    try {
        await storage.deleteFile(config.eventPhotosBucketID, photoId);
    } catch (error) {
        console.error('Error deleting event photo:', error);
        throw new Error('Failed to delete event photo');
    }
}

/**
 * Get a thumbnail/preview URL for an event photo
 * @param photoId - The ID of the photo file
 * @param width - Thumbnail width (default: 300)
 * @param height - Thumbnail height (default: 300)
 * @returns string - The thumbnail URL
 */
export function getEventPhotoThumbnail(
    photoId: string,
    width: number = 300,
    height: number = 300
): string {
    return storage.getFilePreview(
        config.eventPhotosBucketID,
        photoId,
        width,
        height
    ).toString();
}
