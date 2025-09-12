import { useTheme } from '@/lib/context/ThemeContext';
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
    backgroundColor,
    textColor,
    className = '',
}) => {
    const { colors } = useTheme();

    // Calculate text size based on avatar size if not provided
    const calculatedTextSize = textSize || Math.floor(size * 0.4);

    // Use theme-aware defaults if not provided
    const finalBackgroundColor = backgroundColor || colors.primary;
    const finalTextColor = textColor || colors.buttonText;

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
        backgroundColor: finalBackgroundColor,
        borderRadius: size / 2,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    };

    const textStyle = {
        fontSize: calculatedTextSize,
        color: finalTextColor,
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
