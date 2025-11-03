import { getEventEmoji } from '@/constants/categories';
import { getEventPhotoThumbnail } from '@/lib/appwrite/eventPhotos';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, Text } from 'react-native';

interface EventImageProps {
    photoId?: string;
    tags?: string[];
    size: number;
    style?: any;
    gradientColors?: [string, string, ...string[]];
}

const EventImage: React.FC<EventImageProps> = ({
    photoId,
    tags = [],
    size,
    style,
    gradientColors = ["#667eea", "#764ba2"] as [string, string, ...string[]],
}) => {
    // Debug logging only for size 120 (event details/form)
    if (size === 120) {
        console.log('🖼️ EventImage render (size 120):', { photoId, hasPhotoId: !!photoId, size, tags });
    }

    if (photoId) {
        // Show uploaded photo
        const photoUrl = getEventPhotoThumbnail(photoId, size, size);
        if (size === 120) {
            console.log('📸 Using event photo (size 120):', { photoId, photoUrl });
        }

        return (
            <Image
                source={{ uri: photoUrl }}
                style={[
                    {
                        width: size,
                        height: size,
                        borderRadius: size * 0.167, // Roughly equivalent to borderRadius: 12 for size 72
                    },
                    style,
                ]}
                resizeMode="cover"
                onError={(error) => {
                    if (size === 120) {
                        console.error('❌ EventImage failed to load (size 120):', error.nativeEvent);
                    }
                }}
                onLoad={() => {
                    if (size === 120) {
                        console.log('✅ EventImage loaded successfully (size 120):', photoUrl);
                    }
                }}
            />
        );
    }

    // Fallback to emoji with gradient background
    if (size === 120) {
        console.log('🎨 Using emoji fallback (size 120):', { tags, emoji: getEventEmoji(tags) });
    }

    return (
        <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius: size * 0.167,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                style,
            ]}
        >
            <Text style={{ fontSize: size * 0.389 }}>
                {getEventEmoji(tags)}
            </Text>
        </LinearGradient>
    );
};

EventImage.displayName = 'EventImage';

export default EventImage;
