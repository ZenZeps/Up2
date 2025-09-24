import {
    getEventInviteData,
    shareEventInvite,
    shareToInstagram,
    shareToMessenger,
    shareToWhatsApp
} from '@/lib/utils/invites';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';

interface QuickShareButtonProps {
    eventId: string;
    platform: 'whatsapp' | 'instagram' | 'messenger' | 'general';
    size?: 'small' | 'medium' | 'large';
    style?: 'filled' | 'outline' | 'minimal';
    onShareComplete?: () => void;
}

const platformConfigs = {
    whatsapp: {
        name: 'WhatsApp',
        icon: 'message',
        color: '#25D366',
        action: shareToWhatsApp
    },
    instagram: {
        name: 'Instagram',
        icon: 'photo-camera',
        color: '#E4405F',
        action: shareToInstagram
    },
    messenger: {
        name: 'Messenger',
        icon: 'chat-bubble',
        color: '#0084FF',
        action: shareToMessenger
    },
    general: {
        name: 'Share',
        icon: 'share',
        color: '#666666',
        action: shareEventInvite
    }
};

export default function QuickShareButton({
    eventId,
    platform,
    size = 'medium',
    style = 'filled',
    onShareComplete
}: QuickShareButtonProps) {
    const config = platformConfigs[platform];

    const handleShare = async () => {
        try {
            const inviteData = await getEventInviteData(eventId);
            if (!inviteData) {
                Alert.alert('Error', 'Unable to load event data for sharing.');
                return;
            }

            const success = await config.action(inviteData);
            if (success && onShareComplete) {
                onShareComplete();
            }
        } catch (error) {
            console.error('Error sharing:', error);
            Alert.alert('Error', `Failed to share via ${config.name}`);
        }
    };

    const getSize = () => {
        switch (size) {
            case 'small': return { padding: 8, iconSize: 16 };
            case 'large': return { padding: 16, iconSize: 32 };
            default: return { padding: 12, iconSize: 24 };
        }
    };

    const getButtonStyle = () => {
        const { padding } = getSize();
        const baseStyle = {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            borderRadius: 8,
            padding
        };

        switch (style) {
            case 'outline':
                return {
                    ...baseStyle,
                    borderWidth: 2,
                    borderColor: config.color,
                    backgroundColor: 'transparent'
                };
            case 'minimal':
                return {
                    ...baseStyle,
                    backgroundColor: 'transparent'
                };
            default: // filled
                return {
                    ...baseStyle,
                    backgroundColor: config.color
                };
        }
    };

    const getTextColor = () => {
        return style === 'filled' ? 'white' : config.color;
    };

    const { iconSize } = getSize();

    return (
        <TouchableOpacity
            onPress={handleShare}
            style={getButtonStyle()}
            activeOpacity={0.7}
        >
            <MaterialIcons
                name={config.icon as any}
                size={iconSize}
                color={getTextColor()}
            />
            {size !== 'small' && (
                <Text
                    style={{
                        marginLeft: 8,
                        color: getTextColor(),
                        fontWeight: '600'
                    }}
                >
                    {config.name}
                </Text>
            )}
        </TouchableOpacity>
    );
}
