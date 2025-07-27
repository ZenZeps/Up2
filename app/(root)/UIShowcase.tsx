import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/context/ThemeContext';
import EnhancedFAB from '@/components/ui/EnhancedFAB';
import EnhancedCard from '@/components/ui/EnhancedCard';
import EnhancedButton from '@/components/ui/EnhancedButton';
import EnhancedInput from '@/components/ui/EnhancedInput';
import EnhancedAvatar from '@/components/ui/EnhancedAvatar';
import StatsCard from '@/components/ui/StatsCard';
import StatusIndicator from '@/components/ui/StatusIndicator';
import LoadingIndicator from '@/components/ui/LoadingIndicator';
import Toast from '@/components/ui/Toast';
import icons from '@/constants/icons';

const UIShowcase = () => {
  const { colors, spacing } = useTheme();
  const [inputValue, setInputValue] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('success');
  const [loading, setLoading] = useState(false);

  const handleShowToast = (type: 'success' | 'error' | 'warning' | 'info') => {
    setToastType(type);
    setShowToast(true);
  };

  const handleLoadingTest = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  const stats = [
    { label: 'Friends', value: 42, onPress: () => Alert.alert('Friends', 'Navigate to friends list') },
    { label: 'Events', value: 18, onPress: () => Alert.alert('Events', 'Navigate to events') },
    { label: 'Groups', value: 7, onPress: () => Alert.alert('Groups', 'Navigate to groups') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 32,
              fontWeight: '700',
              color: colors.text,
              marginBottom: spacing.sm,
            }}
          >
            UI Showcase
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: colors.textSecondary,
              lineHeight: 22,
            }}
          >
            Demonstrating enhanced UI components with improved design and interactions
          </Text>
        </View>

        {/* Enhanced Cards */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '600',
              color: colors.text,
              marginBottom: spacing.md,
            }}
          >
            Enhanced Cards
          </Text>
          
          <EnhancedCard
            variant="default"
            style={{ marginBottom: spacing.md }}
            onPress={() => Alert.alert('Default Card', 'This is a default card with press interaction')}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
              Default Interactive Card
            </Text>
            <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
              Tap me to see the interaction animation
            </Text>
          </EnhancedCard>

          <EnhancedCard variant="elevated" style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
              Elevated Card
            </Text>
            <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
              This card has enhanced shadow and elevation
            </Text>
          </EnhancedCard>

          <EnhancedCard variant="flat">
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
              Flat Card
            </Text>
            <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
              Minimal styling for subtle content sections
            </Text>
          </EnhancedCard>
        </View>

        {/* Enhanced Buttons */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '600',
              color: colors.text,
              marginBottom: spacing.md,
            }}
          >
            Enhanced Buttons
          </Text>

          <View style={{ gap: spacing.sm }}>
            <EnhancedButton
              title="Primary Button"
              onPress={() => handleShowToast('success')}
              variant="primary"
              fullWidth
            />
            
            <EnhancedButton
              title="Secondary Button"
              onPress={() => handleShowToast('info')}
              variant="secondary"
              fullWidth
            />
            
            <EnhancedButton
              title="Outline Button"
              onPress={() => handleShowToast('warning')}
              variant="outline"
              fullWidth
            />
            
            <EnhancedButton
              title="Ghost Button"
              onPress={() => handleShowToast('error')}
              variant="ghost"
              fullWidth
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <EnhancedButton
                title="Small"
                onPress={() => Alert.alert('Size', 'Small button pressed')}
                variant="primary"
                size="small"
                style={{ flex: 1 }}
              />
              <EnhancedButton
                title="Medium"
                onPress={() => Alert.alert('Size', 'Medium button pressed')}
                variant="primary"
                size="medium"
                style={{ flex: 1 }}
              />
              <EnhancedButton
                title="Large"
                onPress={() => Alert.alert('Size', 'Large button pressed')}
                variant="primary"
                size="large"
                style={{ flex: 1 }}
              />
            </View>

            <EnhancedButton
              title="Loading Button"
              onPress={handleLoadingTest}
              variant="primary"
              loading={loading}
              fullWidth
            />
          </View>
        </View>

        {/* Enhanced Inputs */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '600',
              color: colors.text,
              marginBottom: spacing.md,
            }}
          >
            Enhanced Inputs
          </Text>

          <EnhancedInput
            label="Floating Label Input"
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Type something..."
            leftIcon={
              <Image
                source={icons.search}
                style={{ width: 20, height: 20, tintColor: colors.textSecondary }}
              />
            }
            containerStyle={{ marginBottom: spacing.md }}
            showCharacterCount
            maxLength={100}
          />

          <EnhancedInput
            label="Filled Variant"
            variant="filled"
            placeholder="Filled input style"
            containerStyle={{ marginBottom: spacing.md }}
          />

          <EnhancedInput
            label="Underlined Input"
            variant="underlined"
            placeholder="Underlined style"
            hint="This is a hint message"
          />
        </View>

        {/* Enhanced Avatars */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '600',
              color: colors.text,
              marginBottom: spacing.md,
            }}
          >
            Enhanced Avatars
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
            <EnhancedAvatar
              firstName="John"
              lastName="Doe"
              size={64}
              status="online"
              onPress={() => Alert.alert('Avatar', 'Avatar pressed')}
            />
            
            <EnhancedAvatar
              firstName="Jane"
              lastName="Smith"
              size={64}
              status="away"
              showEditIcon
              onPress={() => Alert.alert('Avatar', 'Edit avatar')}
            />
            
            <EnhancedAvatar
              firstName="Bob"
              lastName="Wilson"
              size={64}
              status="busy"
            />
            
            <EnhancedAvatar
              firstName="Alice"
              lastName="Brown"
              size={64}
              status="offline"
              loading={loading}
            />
          </View>
        </View>

        {/* Stats Card */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '600',
              color: colors.text,
              marginBottom: spacing.md,
            }}
          >
            Stats Card
          </Text>

          <StatsCard stats={stats} />
        </View>

        {/* Status Indicators */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '600',
              color: colors.text,
              marginBottom: spacing.md,
            }}
          >
            Status Indicators
          </Text>

          <EnhancedCard>
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text }}>Online</Text>
                <StatusIndicator status="online" showLabel />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text }}>Away</Text>
                <StatusIndicator status="away" showLabel />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text }}>Busy</Text>
                <StatusIndicator status="busy" showLabel />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text }}>Offline</Text>
                <StatusIndicator status="offline" showLabel />
              </View>
            </View>
          </EnhancedCard>
        </View>

        {/* Loading States */}
        {loading && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '600',
                color: colors.text,
                marginBottom: spacing.md,
              }}
            >
              Loading Indicator
            </Text>
            <EnhancedCard>
              <LoadingIndicator message="Loading enhanced content..." />
            </EnhancedCard>
          </View>
        )}
      </ScrollView>

      {/* Enhanced FAB */}
      <EnhancedFAB
        onPress={() => Alert.alert('FAB', 'Floating Action Button pressed!')}
        icon="+"
        size="large"
        position={{ bottom: 100, right: 24 }}
      />

      {/* Toast Notifications */}
      <Toast
        visible={showToast}
        message={`This is a ${toastType} toast notification!`}
        type={toastType}
        onHide={() => setShowToast(false)}
        position="top"
      />
    </SafeAreaView>
  );
};

export default UIShowcase;
