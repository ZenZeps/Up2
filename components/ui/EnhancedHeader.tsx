import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import icons from '@/constants/icons';

interface EnhancedHeaderProps {
  title: string;
  showBack?: boolean;
  showSettings?: boolean;
  rightAction?: {
    icon?: any;
    onPress: () => void;
    title?: string;
  };
  onBack?: () => void;
}

const EnhancedHeader: React.FC<EnhancedHeaderProps> = ({
  title,
  showBack = false,
  showSettings = false,
  rightAction,
  onBack
}) => {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleSettings = () => {
    router.push('/(root)/Settings');
  };

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      paddingTop: insets.top + spacing.sm,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      {/* Left Side */}
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            style={{ 
              marginRight: spacing.sm,
              padding: spacing.xs,
            }}
          >
            <Image
              source={icons.backArrow}
              style={{ 
                width: 24, 
                height: 24, 
                tintColor: colors.text 
              }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
        
        <Text style={{
          fontSize: 20,
          fontWeight: '600',
          color: colors.text,
          flex: 1,
        }}>
          {title}
        </Text>
      </View>

      {/* Right Side */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {showSettings && (
          <TouchableOpacity
            onPress={handleSettings}
            style={{ 
              padding: spacing.xs,
              marginLeft: spacing.sm,
            }}
          >
            <Image
              source={icons.person}
              style={{ 
                width: 24, 
                height: 24, 
                tintColor: colors.text 
              }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}

        {rightAction && (
          <TouchableOpacity
            onPress={rightAction.onPress}
            style={{ 
              padding: spacing.xs,
              marginLeft: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            {rightAction.icon && (
              <Image
                source={rightAction.icon}
                style={{ 
                  width: 24, 
                  height: 24, 
                  tintColor: colors.primary 
                }}
                resizeMode="contain"
              />
            )}
            {rightAction.title && (
              <Text style={{
                color: colors.primary,
                fontSize: 16,
                fontWeight: '500',
                marginLeft: rightAction.icon ? spacing.xs : 0,
              }}>
                {rightAction.title}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default EnhancedHeader;
