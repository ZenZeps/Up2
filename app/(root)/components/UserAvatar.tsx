import { userDisplayUtils } from '@/lib/utils/userDisplay';
import React from 'react';
import { Image, Text, View } from 'react-native';

interface UserAvatarProps {
    photoUrl?: string | null;
    firstName?: string;
    lastName?: string;
    name?: string; // Fallback for when firstName/lastName not available
    size?: number;
    textSize?: number;
    backgroundColor?: string;
    textColor?: string;
    className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
    photoUrl,
    firstName,
    lastName,
    name,
    size = 40,
    textSize,
    backgroundColor = '#e5e7eb', // gray-200
    textColor = '#9ca3af', // gray-400
    className = '',
}) => {
    // Calculate text size based on avatar size if not provided
    const calculatedTextSize = textSize || Math.floor(size * 0.4);

    // Get initials from firstName/lastName or fallback to name
    const initials = firstName && lastName
        ? userDisplayUtils.getInitials({ firstName, lastName })
        : userDisplayUtils.getInitials({ firstName: name || 'U', lastName: '' });

    const avatarStyle = {
        width: size,
        height: size,
    };

    const initialsContainerStyle = {
        width: size,
        height: size,
        backgroundColor,
        borderRadius: size / 2,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    };

    const textStyle = {
        fontSize: calculatedTextSize,
        color: textColor,
        fontWeight: '500' as const,
    };

    if (photoUrl) {
        return (
            <Image
                source={{ uri: photoUrl }}
                style={[avatarStyle, { borderRadius: size / 2 }]}
                className={className}
            />
        );
    }

    return (
        <View style={initialsContainerStyle} className={className}>
            <Text style={textStyle}>
                {initials}
            </Text>
        </View>
    );
};

export default UserAvatar;
