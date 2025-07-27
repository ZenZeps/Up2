import React from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/lib/context/ThemeContext';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import StatusIndicator from './StatusIndicator';

interface EnhancedAvatarProps {
  photoUrl?: string | null;
  firstName?: string;
  lastName?: string;
  name?: string;
  size?: number;
  onPress?: () => void;
  showEditIcon?: boolean;
  loading?: boolean;
  status?: 'online' | 'away' | 'busy' | 'offline';
  style?: ViewStyle;
  disabled?: boolean;
}

const EnhancedAvatar: React.FC<EnhancedAvatarProps> = ({
  photoUrl,
  firstName,
  lastName,
  name,
  size = 64,
  onPress,
  showEditIcon = false,
  loading = false,
  status,
  style,
  disabled = false,
}) => {
  const { colors, borderRadius } = useTheme();

  const displayName = name || userDisplayUtils.getFullName({ firstName, lastName });
  const initials = userDisplayUtils.getInitials({ firstName, lastName });

  const avatarStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...style,
  };

  const renderAvatar = () => {
    if (loading) {
      return (
        <View style={avatarStyle}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }

    if (photoUrl) {
      return (
        <Image
          source={{ uri: photoUrl }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.surface,
          }}
          resizeMode="cover"
        />
      );
    }

    return (
      <View
        style={[
          avatarStyle,
          {
            backgroundColor: colors.primary,
          },
        ]}
      >
        <Text
          style={{
            color: colors.background,
            fontSize: size * 0.4,
            fontWeight: '600',
          }}
        >
          {initials}
        </Text>
      </View>
    );
  };

  const content = (
    <View style={{ position: 'relative' }}>
      {renderAvatar()}
      
      {/* Status Indicator */}
      {status && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            backgroundColor: colors.background,
            borderRadius: (size * 0.15) / 2,
            padding: 2,
          }}
        >
          <StatusIndicator status={status} size="small" />
        </View>
      )}

      {/* Edit Icon */}
      {showEditIcon && (
        <View
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: size * 0.25,
            height: size * 0.25,
            backgroundColor: colors.primary,
            borderRadius: (size * 0.25) / 2,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.background,
          }}
        >
          <Text
            style={{
              color: colors.background,
              fontSize: size * 0.12,
              fontWeight: 'bold',
            }}
          >
            {loading ? '...' : '✎'}
          </Text>
        </View>
      )}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <TouchableOpacity onPress={onPress} disabled={loading}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export default EnhancedAvatar;
