import { deleteEventPhoto, getEventPhotoThumbnail, uploadEventPhoto } from '@/lib/appwrite/eventPhotos';
import { useTheme } from '@/lib/context/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface EventPhotoUploadProps {
    eventId: string;
    currentUserId: string;
    currentPhotoId?: string;
    onPhotoUploaded: (photoId: string) => void;
    onPhotoDeleted: () => void;
    size?: number;
}

export const EventPhotoUpload: React.FC<EventPhotoUploadProps> = ({
    eventId,
    currentUserId,
    currentPhotoId,
    onPhotoUploaded,
    onPhotoDeleted,
    size = 200,
}) => {
    const { colors } = useTheme();
    const [uploading, setUploading] = useState(false);

    const handlePickImage = async () => {
        try {
            // Request permission
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert(
                    'Permission Required',
                    'Please allow access to your photo library to upload event images.'
                );
                return;
            }

            // Launch image picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1], // Square aspect ratio
                quality: 0.8,
                exif: false,
            });

            if (!result.canceled && result.assets[0]) {
                await handleUpload(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    };

    const handleTakePhoto = async () => {
        try {
            // Request permission
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert(
                    'Permission Required',
                    'Please allow camera access to take event photos.'
                );
                return;
            }

            // Launch camera
            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1], // Square aspect ratio
                quality: 0.8,
                exif: false,
            });

            if (!result.canceled && result.assets[0]) {
                await handleUpload(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take photo. Please try again.');
        }
    };

    const handleUpload = async (photoUri: string) => {
        setUploading(true);
        try {
            // If there's an existing photo, delete it first
            if (currentPhotoId) {
                await deleteEventPhoto(currentPhotoId);
            }

            // Upload the new photo
            const uploadedPhoto = await uploadEventPhoto(eventId, photoUri, currentUserId);
            onPhotoUploaded(uploadedPhoto.$id);

            Alert.alert('Success', 'Photo uploaded successfully!');
        } catch (error) {
            console.error('Error uploading photo:', error);
            Alert.alert('Error', 'Failed to upload photo. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleDeletePhoto = async () => {
        if (!currentPhotoId) return;

        Alert.alert(
            'Delete Photo',
            'Are you sure you want to delete this photo?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteEventPhoto(currentPhotoId);
                            onPhotoDeleted();
                            Alert.alert('Success', 'Photo deleted successfully!');
                        } catch (error) {
                            console.error('Error deleting photo:', error);
                            Alert.alert('Error', 'Failed to delete photo. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const showImageOptions = () => {
        Alert.alert(
            'Add Photo',
            'Choose how you want to add a photo for this event:',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Take Photo', onPress: handleTakePhoto },
                { text: 'Choose from Library', onPress: handlePickImage },
            ]
        );
    };

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            {currentPhotoId ? (
                // Show existing photo
                <View style={styles.photoContainer}>
                    <Image
                        source={{ uri: getEventPhotoThumbnail(currentPhotoId, size, size) }}
                        style={[styles.photo, { width: size, height: size }]}
                        resizeMode="cover"
                    />
                    <TouchableOpacity
                        style={[styles.deleteButton, { backgroundColor: colors.error }]}
                        onPress={handleDeletePhoto}
                    >
                        <MaterialIcons name="delete" size={16} color="white" />
                    </TouchableOpacity>
                </View>
            ) : (
                // Show upload button
                <TouchableOpacity
                    style={[
                        styles.uploadButton,
                        {
                            width: size,
                            height: size,
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                        }
                    ]}
                    onPress={showImageOptions}
                    disabled={uploading}
                >
                    <MaterialIcons
                        name={uploading ? "hourglass-empty" : "add-a-photo"}
                        size={size * 0.25}
                        color={colors.textSecondary}
                    />
                    <Text style={[styles.uploadText, { color: colors.textSecondary }]}>
                        {uploading ? 'Uploading...' : 'Add Photo'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    photoContainer: {
        position: 'relative',
        width: '100%',
        height: '100%',
    },
    photo: {
        borderRadius: 12,
    },
    deleteButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    uploadButton: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadText: {
        fontSize: 14,
        fontWeight: '500',
        marginTop: 8,
        textAlign: 'center',
    },
});
