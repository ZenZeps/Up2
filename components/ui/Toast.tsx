import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  ViewStyle,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/lib/context/ThemeContext';
import { shadowPresets } from '@/lib/utils/uiEnhancements';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  visible: boolean;
  onHide: () => void;
  duration?: number;
  position?: 'top' | 'bottom';
}

const { width } = Dimensions.get('window');

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  visible,
  onHide,
  duration = 3000,
  position = 'top',
}) => {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'error':
        return colors.error;
      case 'warning':
        return colors.warning;
      case 'info':
      default:
        return colors.primary;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: position === 'top' ? -100 : 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!visible) return null;

  const containerStyle: ViewStyle = {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    ...(position === 'top' ? { top: 60 } : { bottom: 100 }),
  };

  return (
    <Animated.View
      style={[
        containerStyle,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        onPress={hideToast}
        style={{
          backgroundColor: getBackgroundColor(),
          borderRadius: 12,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          ...shadowPresets.medium,
        }}
        activeOpacity={0.9}
      >
        <Text
          style={{
            fontSize: 18,
            marginRight: 12,
            color: 'white',
          }}
        >
          {getIcon()}
        </Text>
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: '600',
            color: 'white',
            lineHeight: 22,
          }}
        >
          {message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default Toast;
