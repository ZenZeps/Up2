import { Platform } from 'react-native';

/**
 * UI Enhancement utilities for consistent styling and animations
 */

// Shadow presets for different elevation levels
export const shadowPresets = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 24,
  },
};

// Button style presets
export const buttonPresets = {
  primary: (colors: any) => ({
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowPresets.soft,
  }),
  secondary: (colors: any) => ({
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  }),
  ghost: (colors: any) => ({
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  }),
  floating: (colors: any) => ({
    backgroundColor: colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    ...shadowPresets.floating,
  }),
};

// Card style presets
export const cardPresets = {
  default: (colors: any) => ({
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    ...shadowPresets.subtle,
  }),
  elevated: (colors: any) => ({
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    padding: 16,
    ...shadowPresets.medium,
  }),
  interactive: (colors: any) => ({
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    ...shadowPresets.soft,
    borderWidth: 1,
    borderColor: colors.border,
  }),
};

// Input style presets
export const inputPresets = {
  default: (colors: any) => ({
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  }),
  focused: (colors: any) => ({
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    ...shadowPresets.subtle,
  }),
  search: (colors: any) => ({
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  }),
};

// Animation presets
export const animationPresets = {
  fadeIn: {
    opacity: 0,
    transform: [{ scale: 0.95 }],
  },
  slideUp: {
    opacity: 0,
    transform: [{ translateY: 20 }],
  },
  slideDown: {
    opacity: 0,
    transform: [{ translateY: -20 }],
  },
  scaleIn: {
    opacity: 0,
    transform: [{ scale: 0.8 }],
  },
};

// Utility functions
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

// Generate alpha variations of colors
export const withOpacity = (color: string, opacity: number): string => {
  if (color.startsWith('rgba')) {
    return color.replace(/[\d\.]+\)$/g, `${opacity})`);
  }
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
};

// Haptic feedback utility
export const hapticFeedback = {
  light: () => {
    if (isIOS) {
      // Implement iOS haptic feedback
    } else {
      // Implement Android haptic feedback
    }
  },
  medium: () => {
    if (isIOS) {
      // Implement iOS haptic feedback
    } else {
      // Implement Android haptic feedback
    }
  },
  heavy: () => {
    if (isIOS) {
      // Implement iOS haptic feedback
    } else {
      // Implement Android haptic feedback
    }
  },
};

// Layout utilities
export const layoutUtils = {
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flexFull: {
    flex: 1,
  },
} as const;

// Typography utilities
export const textPresets = {
  h1: (colors: any) => ({
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 40,
  }),
  h2: (colors: any) => ({
    fontSize: 28,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 36,
  }),
  h3: (colors: any) => ({
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 32,
  }),
  body: (colors: any) => ({
    fontSize: 16,
    fontWeight: '400',
    color: colors.text,
    lineHeight: 24,
  }),
  caption: (colors: any) => ({
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 20,
  }),
  small: (colors: any) => ({
    fontSize: 12,
    fontWeight: '400',
    color: colors.textMuted,
    lineHeight: 16,
  }),
};

// Status indicators
export const statusColors = {
  online: '#30d158',
  away: '#ff9f0a',
  busy: '#ff453a',
  offline: '#8e8e93',
};

// Event type colors for better visual categorization
export const eventTypeColors = {
  social: '#0a84ff',
  work: '#5856d6',
  personal: '#af52de',
  fitness: '#30d158',
  food: '#ff9f0a',
  travel: '#5ac8fa',
  entertainment: '#ff2d92',
  education: '#007aff',
  default: '#8e8e93',
};
