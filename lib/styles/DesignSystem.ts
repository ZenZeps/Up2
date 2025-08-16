import { StyleSheet } from 'react-native';

// Design System Colors
export const Colors = {
    // Primary colors
    primary: '#1a1a1a',
    secondary: '#6b7280',

    // Background colors
    background: '#f8f9fb',
    surface: '#ffffff',
    surfaceSecondary: '#f8fafc',

    // Text colors
    textPrimary: '#1a1a1a',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',

    // Border colors
    border: '#e5e7eb',
    borderLight: '#f3f4f6',

    // Status colors
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',

    // Accent colors
    accent: '#8b5cf6',
    accentLight: '#c4b5fd',
};

// Typography
export const Typography = {
    // Font weights - Fixed for React Native compatibility
    fontWeight: {
        regular: '400' as '400',
        medium: '500' as '500',
        semibold: '600' as '600',
        bold: '700' as '700',
    },

    // Font sizes
    fontSize: {
        xs: 12,
        sm: 14,
        base: 16,
        lg: 18,
        xl: 20,
        '2xl': 24,
        '3xl': 28,
        '4xl': 32,
    },

    // Line heights
    lineHeight: {
        tight: 18,
        normal: 20,
        relaxed: 22,
        loose: 24,
    },

    // Letter spacing
    letterSpacing: {
        tight: -0.5,
        normal: 0,
        wide: 0.2,
        wider: 0.3,
    },
};

// Spacing
export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
};

// Border radius
export const BorderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    full: 9999,
};

// Shadows
export const Shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 3,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 8,
    },
    xl: {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 12,
    },
};

// Common component styles
export const CommonStyles = StyleSheet.create({
    // Containers
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    surface: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xl,
        ...Shadows.md,
    },

    card: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xl,
        marginBottom: Spacing.lg,
        ...Shadows.md,
    },

    // Headers
    headerContainer: {
        backgroundColor: Colors.surface,
        padding: Spacing['2xl'],
        paddingTop: Spacing['4xl'],
        borderBottomLeftRadius: BorderRadius['2xl'],
        borderBottomRightRadius: BorderRadius['2xl'],
        ...Shadows.lg,
    },

    headerTitle: {
        fontSize: Typography.fontSize['3xl'],
        fontWeight: Typography.fontWeight.bold,
        color: Colors.textPrimary,
        letterSpacing: Typography.letterSpacing.tight,
        marginBottom: Spacing.sm,
    },

    headerSubtitle: {
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
        fontWeight: Typography.fontWeight.regular,
    },

    // Typography
    sectionTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: Typography.fontWeight.semibold,
        color: Colors.textPrimary,
        letterSpacing: Typography.letterSpacing.tight,
        marginBottom: Spacing.xl,
    },

    bodyText: {
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
        lineHeight: Typography.lineHeight.relaxed,
        fontWeight: Typography.fontWeight.regular,
    },

    label: {
        fontSize: Typography.fontSize.sm,
        fontWeight: Typography.fontWeight.medium,
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
        letterSpacing: Typography.letterSpacing.normal,
    },

    // Buttons
    primaryButton: {
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.lg + 2,
        paddingHorizontal: Spacing['2xl'],
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        ...Shadows.md,
    },

    primaryButtonText: {
        color: Colors.surface,
        fontSize: Typography.fontSize.base,
        fontWeight: Typography.fontWeight.semibold,
        letterSpacing: Typography.letterSpacing.wide,
    },

    secondaryButton: {
        backgroundColor: Colors.surface,
        paddingVertical: Spacing.lg + 2,
        paddingHorizontal: Spacing['2xl'],
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: Colors.primary,
    },

    secondaryButtonText: {
        color: Colors.primary,
        fontSize: Typography.fontSize.base,
        fontWeight: Typography.fontWeight.semibold,
        letterSpacing: Typography.letterSpacing.wide,
    },

    // Form elements
    input: {
        borderWidth: 1.5,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        fontSize: Typography.fontSize.base,
        backgroundColor: Colors.surface,
        color: Colors.textPrimary,
        fontWeight: Typography.fontWeight.regular,
    },

    inputFocused: {
        borderColor: Colors.primary,
    },

    textArea: {
        height: 100,
        textAlignVertical: 'top',
        paddingTop: Spacing.lg,
    },

    // Status indicators
    statusBadge: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.md,
    },

    statusText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: Typography.fontWeight.semibold,
        letterSpacing: Typography.letterSpacing.wider,
    },

    // List items
    listItem: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xl,
        marginBottom: Spacing.lg,
        ...Shadows.md,
    },

    // Loading states
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    },

    loadingText: {
        marginTop: Spacing.lg,
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
        fontWeight: Typography.fontWeight.regular,
    },

    // Empty states
    emptyState: {
        alignItems: 'center',
        paddingHorizontal: Spacing['4xl'],
        paddingTop: Spacing['5xl'],
    },

    emptyStateTitle: {
        fontSize: Typography.fontSize['2xl'] + 2,
        fontWeight: Typography.fontWeight.bold,
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
        letterSpacing: Typography.letterSpacing.tight,
    },

    emptyStateText: {
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing['3xl'],
        lineHeight: Typography.lineHeight.loose,
        fontWeight: Typography.fontWeight.regular,
    },

    // Dividers
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: Spacing.lg,
    },

    // Utility classes
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    spaceBetween: {
        justifyContent: 'space-between',
    },

    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },

    flex1: {
        flex: 1,
    },

    // Margins and padding utilities
    mb16: {
        marginBottom: Spacing.lg,
    },

    mb20: {
        marginBottom: Spacing.xl,
    },

    mt16: {
        marginTop: Spacing.lg,
    },

    mt20: {
        marginTop: Spacing.xl,
    },

    px20: {
        paddingHorizontal: Spacing.xl,
    },

    py20: {
        paddingVertical: Spacing.xl,
    },
});

// Animation presets
export const AnimationPresets = {
    springConfig: {
        damping: 15,
        stiffness: 150,
        mass: 1,
    },

    fadeIn: {
        from: { opacity: 0 },
        to: { opacity: 1 },
    },

    slideUp: {
        from: { translateY: 20, opacity: 0 },
        to: { translateY: 0, opacity: 1 },
    },
};

export default {
    Colors,
    Typography,
    Spacing,
    BorderRadius,
    Shadows,
    CommonStyles,
    AnimationPresets,
};
