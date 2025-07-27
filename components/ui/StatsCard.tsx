import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '@/lib/context/ThemeContext';
import EnhancedCard from './EnhancedCard';

interface StatItem {
  label: string;
  value: number | string;
  onPress?: () => void;
  color?: string;
}

interface StatsCardProps {
  stats: StatItem[];
  style?: ViewStyle;
  horizontal?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  stats, 
  style, 
  horizontal = true 
}) => {
  const { colors, spacing } = useTheme();

  const renderStat = (stat: StatItem, index: number) => {
    const content = (
      <View
        style={{
          alignItems: 'center',
          flex: horizontal ? 1 : 0,
          paddingVertical: horizontal ? 0 : spacing.sm,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: stat.color || colors.primary,
            marginBottom: 4,
          }}
        >
          {stat.value}
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            color: colors.textSecondary,
            textAlign: 'center',
          }}
        >
          {stat.label}
        </Text>
      </View>
    );

    if (stat.onPress) {
      return (
        <TouchableOpacity
          key={index}
          onPress={stat.onPress}
          style={{
            flex: horizontal ? 1 : 0,
            alignItems: 'center',
          }}
        >
          {content}
        </TouchableOpacity>
      );
    }

    return (
      <View key={index} style={{ flex: horizontal ? 1 : 0 }}>
        {content}
      </View>
    );
  };

  return (
    <EnhancedCard variant="default" style={style}>
      <View
        style={{
          flexDirection: horizontal ? 'row' : 'column',
          justifyContent: 'space-around',
          alignItems: 'center',
        }}
      >
        {stats.map((stat, index) => (
          <React.Fragment key={index}>
            {renderStat(stat, index)}
            {horizontal && index < stats.length - 1 && (
              <View
                style={{
                  width: 1,
                  height: 40,
                  backgroundColor: colors.border,
                  marginHorizontal: spacing.md,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    </EnhancedCard>
  );
};

export default StatsCard;
