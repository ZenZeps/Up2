import React, { useState, useRef } from 'react';
import {
  TextInput,
  View,
  Text,
  Animated,
  ViewStyle,
  TextStyle,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { useTheme } from '@/lib/context/ThemeContext';
import { shadowPresets } from '@/lib/utils/uiEnhancements';

interface EnhancedInputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  variant?: 'default' | 'outlined' | 'filled' | 'underlined';
  size?: 'small' | 'medium' | 'large';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  showCharacterCount?: boolean;
  maxLength?: number;
  required?: boolean;
}

const EnhancedInput: React.FC<EnhancedInputProps> = ({
  label,
  error,
  hint,
  variant = 'outlined',
  size = 'medium',
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  showCharacterCount = false,
  maxLength,
  required = false,
  value,
  onFocus,
  onBlur,
  ...props
}) => {
  const { colors, spacing, borderRadius } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(!!value);
  const borderAnim = useRef(new Animated.Value(0)).current;
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  const sizes = {
    small: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      fontSize: 14,
      labelFontSize: 12,
    },
    medium: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      fontSize: 16,
      labelFontSize: 14,
    },
    large: {
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      fontSize: 18,
      labelFontSize: 16,
    },
  };

  const sizeStyle = sizes[size];

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.parallel([
      Animated.timing(borderAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(labelAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();

    if (!hasValue) {
      Animated.timing(labelAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
    onBlur?.(e);
  };

  const handleChangeText = (text: string) => {
    setHasValue(!!text);
    if (text && !hasValue) {
      Animated.timing(labelAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else if (!text && hasValue) {
      Animated.timing(labelAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
    props.onChangeText?.(text);
  };

  const getContainerStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      position: 'relative',
    };

    switch (variant) {
      case 'outlined':
        return {
          ...baseStyle,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: error ? colors.error : isFocused ? colors.primary : colors.border,
          borderRadius: borderRadius.md,
          ...(isFocused && !error ? shadowPresets.subtle : {}),
        };
      case 'filled':
        return {
          ...baseStyle,
          backgroundColor: colors.surface,
          borderBottomWidth: 2,
          borderBottomColor: error ? colors.error : isFocused ? colors.primary : colors.border,
          borderRadius: borderRadius.md,
        };
      case 'underlined':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderBottomWidth: 2,
          borderBottomColor: error ? colors.error : isFocused ? colors.primary : colors.border,
        };
      default:
        return baseStyle;
    }
  };

  const getInputStyle = (): TextStyle => {
    return {
      fontSize: sizeStyle.fontSize,
      color: colors.text,
      paddingVertical: sizeStyle.paddingVertical,
      paddingHorizontal: sizeStyle.paddingHorizontal,
      paddingLeft: leftIcon ? sizeStyle.paddingHorizontal + 32 : sizeStyle.paddingHorizontal,
      paddingRight: rightIcon ? sizeStyle.paddingHorizontal + 32 : sizeStyle.paddingHorizontal,
      paddingTop: label ? sizeStyle.paddingVertical + 8 : sizeStyle.paddingVertical,
      ...inputStyle,
    };
  };

  const animatedBorderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  const animatedLabelTop = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [sizeStyle.paddingVertical + 4, 8],
  });

  const animatedLabelFontSize = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [sizeStyle.fontSize, sizeStyle.labelFontSize],
  });

  const characterCount = value?.length || 0;

  return (
    <View style={[containerStyle]}>
      <Animated.View
        style={[
          getContainerStyle(),
          variant === 'outlined' && { borderColor: error ? colors.error : animatedBorderColor },
        ]}
      >
        {/* Floating Label */}
        {label && (
          <Animated.Text
            style={[
              styles.label,
              {
                top: animatedLabelTop,
                left: leftIcon ? sizeStyle.paddingHorizontal + 32 : sizeStyle.paddingHorizontal,
                fontSize: animatedLabelFontSize,
                color: error ? colors.error : isFocused ? colors.primary : colors.textSecondary,
                backgroundColor: variant === 'outlined' ? colors.surface : 'transparent',
                paddingHorizontal: variant === 'outlined' ? 4 : 0,
              },
            ]}
          >
            {label}{required && ' *'}
          </Animated.Text>
        )}

        {/* Left Icon */}
        {leftIcon && (
          <View style={[styles.leftIcon, { left: sizeStyle.paddingHorizontal }]}>
            {leftIcon}
          </View>
        )}

        {/* Text Input */}
        <TextInput
          {...props}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChangeText={handleChangeText}
          style={getInputStyle()}
          placeholderTextColor={colors.textMuted}
          maxLength={maxLength}
        />

        {/* Right Icon */}
        {rightIcon && (
          <View style={[styles.rightIcon, { right: sizeStyle.paddingHorizontal }]}>
            {rightIcon}
          </View>
        )}
      </Animated.View>

      {/* Helper Text */}
      <View style={styles.helperContainer}>
        <View style={styles.helperLeft}>
          {error && (
            <Text style={[styles.helperText, { color: colors.error }]}>
              {error}
            </Text>
          )}
          {!error && hint && (
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              {hint}
            </Text>
          )}
        </View>
        
        {/* Character Count */}
        {showCharacterCount && maxLength && (
          <Text
            style={[
              styles.characterCount,
              {
                color: characterCount > maxLength * 0.8 ? colors.warning : colors.textMuted,
              },
            ]}
          >
            {characterCount}/{maxLength}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    zIndex: 1,
    fontWeight: '500',
  },
  leftIcon: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -12 }],
    zIndex: 1,
  },
  rightIcon: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -12 }],
    zIndex: 1,
  },
  helperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  helperLeft: {
    flex: 1,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
  },
  characterCount: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default EnhancedInput;
