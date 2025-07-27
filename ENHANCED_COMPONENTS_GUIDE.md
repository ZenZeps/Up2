# Enhanced UI Components Usage Guide

## Quick Start

Import any enhanced component in your React Native screens:

```tsx
import EnhancedButton from '@/components/ui/EnhancedButton';
import EnhancedCard from '@/components/ui/EnhancedCard';
import EnhancedFAB from '@/components/ui/EnhancedFAB';
// ... other components
```

## Component Examples

### 1. EnhancedButton
```tsx
<EnhancedButton
  title="Primary Action"
  onPress={() => console.log('Pressed!')}
  variant="primary"  // primary | secondary | outline | ghost
  size="large"       // small | medium | large
  loading={false}
  fullWidth={true}
/>
```

### 2. EnhancedCard
```tsx
<EnhancedCard 
  variant="elevated"  // default | elevated | flat
  onPress={() => {}}  // Optional, makes card pressable
  style={{ marginBottom: 16 }}
>
  <Text>Your content here</Text>
</EnhancedCard>
```

### 3. EnhancedFAB
```tsx
<EnhancedFAB
  onPress={() => {}}
  icon="+"
  size="large"       // small | medium | large
  position={{ bottom: 100, right: 24 }}
/>
```

### 4. EnhancedInput
```tsx
<EnhancedInput
  label="Email Address"
  value={email}
  onChangeText={setEmail}
  variant="outlined"  // default | outlined | filled | underlined
  leftIcon={<Icon name="email" />}
  showCharacterCount
  maxLength={100}
  required
/>
```

### 5. EnhancedAvatar
```tsx
<EnhancedAvatar
  firstName="John"
  lastName="Doe"
  size={64}
  photoUrl="https://..."
  status="online"     // online | away | busy | offline
  showEditIcon
  onPress={() => {}}
  loading={false}
/>
```

### 6. StatsCard
```tsx
<StatsCard 
  stats={[
    { label: 'Friends', value: 42, onPress: () => {} },
    { label: 'Events', value: 18, onPress: () => {} },
    { label: 'Groups', value: 7, onPress: () => {} }
  ]}
/>
```

### 7. StatusIndicator
```tsx
<StatusIndicator 
  status="online"  // online | away | busy | offline
  showLabel={true}
/>
```

### 8. LoadingIndicator
```tsx
<LoadingIndicator 
  message="Loading your content..."
  size="large"
/>
```

### 9. Toast
```tsx
<Toast
  visible={showToast}
  message="Success! Action completed."
  type="success"     // success | error | warning | info
  onHide={() => setShowToast(false)}
  position="top"     // top | bottom
  autoHide={true}
  duration={3000}
/>
```

### 10. EnhancedHeader
```tsx
<EnhancedHeader
  title="Page Title"
  showBack={true}
  showSettings={false}
  rightAction={{
    icon: icons.edit,
    title: "Edit",
    onPress: () => {}
  }}
  onBack={() => router.back()}
/>
```

## Theme Integration

All components automatically use the enhanced theme system:

```tsx
import { useTheme } from '@/lib/context/ThemeContext';

const MyComponent = () => {
  const { colors, spacing, borderRadius, typography } = useTheme();
  
  return (
    <View style={{ 
      backgroundColor: colors.background,
      padding: spacing.md,
      borderRadius: borderRadius.lg 
    }}>
      <Text style={{ 
        color: colors.text,
        fontSize: typography.size.lg 
      }}>
        Themed content
      </Text>
    </View>
  );
};
```

## Design Tokens

Access consistent spacing, colors, and typography:

```tsx
const { colors, spacing, borderRadius, typography } = useTheme();

// Spacing: xs=4, sm=8, md=16, lg=24, xl=32, xxl=48
// BorderRadius: sm=4, md=8, lg=12, xl=16, full=9999
// Typography sizes: xs=12, sm=14, base=16, lg=18, xl=20, xxl=24
// Typography weights: light=300, regular=400, medium=500, semibold=600, bold=700
```

## Best Practices

### 1. Consistent Spacing
```tsx
// Use design tokens for consistent spacing
<View style={{ 
  padding: spacing.md,      // Instead of padding: 16
  margin: spacing.lg,       // Instead of margin: 24
  gap: spacing.sm           // Instead of gap: 8
}} />
```

### 2. Proper Color Usage
```tsx
// Use semantic colors
<Text style={{ color: colors.text }}>        // Primary text
<Text style={{ color: colors.textSecondary }}> // Secondary text
<Text style={{ color: colors.error }}>       // Error states
<Text style={{ color: colors.success }}>     // Success states
```

### 3. Component Composition
```tsx
// Compose components for complex layouts
<EnhancedCard variant="elevated">
  <EnhancedAvatar {...avatarProps} />
  <View style={{ marginLeft: spacing.md }}>
    <Text style={{ color: colors.text }}>John Doe</Text>
    <StatusIndicator status="online" showLabel />
  </View>
  <EnhancedButton 
    title="Follow" 
    variant="outline" 
    size="small" 
  />
</EnhancedCard>
```

### 4. Responsive Design
```tsx
// Use flexible layouts and relative sizing
<EnhancedButton
  title="Action"
  fullWidth={Platform.OS === 'ios'} // Conditional styling
  size={screenWidth < 400 ? 'small' : 'medium'}
/>
```

## Animation Guidelines

All enhanced components include smooth animations:
- Buttons have press animations
- Cards have hover/press effects
- FABs include scale animations
- Toast notifications slide in/out
- Loading indicators are smooth

## Accessibility Features

Enhanced components include:
- Proper touch targets (minimum 44px)
- Screen reader support
- High contrast color options
- Keyboard navigation support
- Focus indicators

## Migration Tips

### From Standard Components
```tsx
// Before
<TouchableOpacity onPress={onPress} style={styles.button}>
  <Text style={styles.buttonText}>Press Me</Text>
</TouchableOpacity>

// After
<EnhancedButton
  title="Press Me"
  onPress={onPress}
  variant="primary"
/>
```

### From Custom Cards
```tsx
// Before
<View style={[styles.card, { backgroundColor: colors.card }]}>
  {content}
</View>

// After
<EnhancedCard variant="elevated">
  {content}
</EnhancedCard>
```

This guide covers the essential usage patterns for all enhanced UI components. Each component is designed to be flexible, accessible, and consistent with the overall design system.
