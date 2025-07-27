import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/lib/context/ThemeContext';
import { statusColors } from '@/lib/utils/uiEnhancements';

interface StatusIndicatorProps {
  status: 'online' | 'away' | 'busy' | 'offline';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  style?: ViewStyle;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'medium',
  showLabel = false,
  style,
}) => {
  const { colors } = useTheme();

  const sizes = {
    small: 8,
    medium: 12,
    large: 16,
  };

  const dotSize = sizes[size];
  const statusColor = statusColors[status];

  const statusLabels = {
    online: 'Online',
    away: 'Away',
    busy: 'Busy',
    offline: 'Offline',
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <View
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: statusColor,
          borderWidth: 2,
          borderColor: colors.background,
        }}
      />
      {showLabel && (
        <Text
          style={{
            marginLeft: 6,
            fontSize: size === 'small' ? 12 : size === 'medium' ? 14 : 16,
            color: colors.textSecondary,
          }}
        >
          {statusLabels[status]}
        </Text>
      )}
    </View>
  );
};

export default StatusIndicator;
