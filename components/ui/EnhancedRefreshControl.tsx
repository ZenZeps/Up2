import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '@/lib/context/ThemeContext';

interface EnhancedRefreshControlProps {
  refreshing: boolean;
  message?: string;
}

const EnhancedRefreshControl: React.FC<EnhancedRefreshControlProps> = ({
  refreshing,
  message = "Refreshing..."
}) => {
  const { colors, spacing } = useTheme();

  if (!refreshing) return null;

  return (
    <View style={{
      paddingVertical: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <ActivityIndicator 
        size="large" 
        color={colors.primary} 
        style={{ marginBottom: spacing.sm }}
      />
      <Text style={{
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
      }}>
        {message}
      </Text>
    </View>
  );
};

export default EnhancedRefreshControl;
