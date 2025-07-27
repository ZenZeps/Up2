import React, { useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  Animated,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@/lib/context/ThemeContext';
import { shadowPresets } from '@/lib/utils/uiEnhancements';

interface EnhancedFABProps {
  onPress: () => void;
  icon?: string;
  label?: string;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  position?: {
    bottom?: number;
    right?: number;
    left?: number;
    top?: number;
  };
  extended?: boolean;
  disabled?: boolean;
}

const EnhancedFAB: React.FC<EnhancedFABProps> = ({
  onPress,
  icon = '+',
  label,
  size = 'medium',
  style,
  position,
  extended = false,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shadowAnim = useRef(new Animated.Value(0)).current;

  const sizes = {
    small: { width: 48, height: 48, borderRadius: 24 },
    medium: { width: 56, height: 56, borderRadius: 28 },
    large: { width: 64, height: 64, borderRadius: 32 },
  };

  const iconSizes = {
    small: 20,
    medium: 24,
    large: 28,
  };

  const handlePressIn = () => {
    if (!disabled) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.95,
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
    if (!disabled) {
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
    outputRange: [8, 16],
  });

  const fabStyle: ViewStyle = {
    backgroundColor: disabled ? colors.textMuted : colors.primary,
    ...sizes[size],
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowPresets.floating,
    ...(position && position),
    ...style,
  };

  const extendedStyle: ViewStyle = extended ? {
    width: 'auto',
    paddingHorizontal: 16,
    minWidth: sizes[size].width,
    flexDirection: 'row',
  } : {};

  return (
    <Animated.View
      style={[
        fabStyle,
        extendedStyle,
        {
          transform: [{ scale: scaleAnim }],
          shadowRadius: animatedShadow,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={styles.touchable}
        activeOpacity={0.8}
      >
        <View style={[styles.content, extended && styles.extendedContent]}>
          <Text
            style={[
              styles.icon,
              {
                fontSize: iconSizes[size],
                color: colors.background,
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            {icon}
          </Text>
          {extended && label && (
            <Text
              style={[
                styles.label,
                {
                  color: colors.background,
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
            >
              {label}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  extendedContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontWeight: '600',
  },
  label: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EnhancedFAB;
