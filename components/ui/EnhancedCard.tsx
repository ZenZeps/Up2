import React, { useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Animated,
  ViewStyle,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@/lib/context/ThemeContext';
import { shadowPresets, cardPresets } from '@/lib/utils/uiEnhancements';

interface EnhancedCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'interactive' | 'flat';
  padding?: 'none' | 'small' | 'medium' | 'large';
  disabled?: boolean;
  pressable?: boolean;
}

const EnhancedCard: React.FC<EnhancedCardProps> = ({
  children,
  onPress,
  style,
  variant = 'default',
  padding = 'medium',
  disabled = false,
  pressable = true,
}) => {
  const { colors, spacing, borderRadius } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shadowAnim = useRef(new Animated.Value(0)).current;

  const paddingValues = {
    none: 0,
    small: spacing.sm,
    medium: spacing.md,
    large: spacing.lg,
  };

  const getCardStyle = (): ViewStyle => {
    const baseStyle = {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: paddingValues[padding],
    };

    switch (variant) {
      case 'elevated':
        return {
          ...baseStyle,
          backgroundColor: colors.cardElevated,
          ...shadowPresets.medium,
        };
      case 'interactive':
        return {
          ...baseStyle,
          ...shadowPresets.soft,
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'flat':
        return {
          ...baseStyle,
          backgroundColor: colors.surface,
        };
      default:
        return {
          ...baseStyle,
          ...shadowPresets.subtle,
        };
    }
  };

  const handlePressIn = () => {
    if (!disabled && pressable && onPress) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.98,
          useNativeDriver: true,
        }),
        Animated.timing(shadowAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start();
    }
  };

  const handlePressOut = () => {
    if (!disabled && pressable && onPress) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(shadowAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start();
    }
  };

  const animatedShadow = shadowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 8],
  });

  const cardStyle = {
    ...getCardStyle(),
    opacity: disabled ? 0.6 : 1,
    ...style,
  };

  if (onPress && pressable && !disabled) {
    return (
      <Animated.View
        style={[
          cardStyle,
          {
            transform: [{ scale: scaleAnim }],
            shadowRadius: variant === 'interactive' ? animatedShadow : cardStyle.shadowRadius,
          },
        ]}
      >
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.touchable}
          activeOpacity={0.95}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <View style={cardStyle}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
  },
});

export default EnhancedCard;
