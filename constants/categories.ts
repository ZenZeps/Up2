/**
 * Shared categories/tags for events and user interests
 */

export interface CategoryOption {
    label: string;
    value: string;
    emoji: string;
    color: string; // Calendar event color
}

export const CATEGORIES: CategoryOption[] = [
    { label: 'Sports', value: 'sports', emoji: '⚽', color: '#FF0000' }, // Red
    { label: 'Music', value: 'music', emoji: '🎵', color: '#800080' }, // Purple
    { label: 'Art', value: 'art', emoji: '🎨', color: '#FFC0CB' }, // Pink
    { label: 'Family', value: 'family', emoji: '👨‍👩‍👧‍👦', color: '#FFC0CB' }, // Pink
    { label: 'Nature', value: 'nature', emoji: '🌿', color: '#008000' }, // Green
    { label: 'Outdoors', value: 'outdoors', emoji: '🏔️', color: '#006400' }, // Dark Green
    { label: 'Party', value: 'party', emoji: '🎉', color: '#FF1493' }, // Deep Pink
    { label: 'Festival', value: 'festival', emoji: '🎪', color: '#8B0000' }, // Dark Red
    { label: 'Food', value: 'food', emoji: '🍽️', color: '#FFFF00' }, // Yellow
    { label: 'Study', value: 'study', emoji: '📚', color: '#FFA500' }, // Orange
];

// Default color for events without tags
export const DEFAULT_EVENT_COLOR = '#007AFF'; // Default blue

// Helper function to get category by value
export const getCategoryByValue = (value: string): CategoryOption | undefined => {
    return CATEGORIES.find(category => category.value === value);
};

// Helper function to get multiple categories by values
export const getCategoriesByValues = (values: string[]): CategoryOption[] => {
    return values.map(value => getCategoryByValue(value)).filter(Boolean) as CategoryOption[];
};

// Helper function to get category emoji
export const getCategoryEmoji = (value: string): string => {
    return getCategoryByValue(value)?.emoji || '📅';
};

// Helper function to get category label
export const getCategoryLabel = (value: string): string => {
    return getCategoryByValue(value)?.label || value;
};

// Helper function to get event color based on first tag
export const getEventColor = (tags: string[]): string => {
    if (!tags || tags.length === 0) {
        return DEFAULT_EVENT_COLOR;
    }

    // Use the first tag to determine color
    const firstTag = tags[0];
    const category = getCategoryByValue(firstTag);
    return category?.color || DEFAULT_EVENT_COLOR;
};
