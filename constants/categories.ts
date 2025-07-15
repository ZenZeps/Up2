/**
 * Shared categories/tags for events and user interests
 */

export interface CategoryOption {
  label: string;
  value: string;
  emoji: string;
}

export const CATEGORIES: CategoryOption[] = [
  { label: 'Sports', value: 'sports', emoji: '⚽' },
  { label: 'Music', value: 'music', emoji: '🎵' },
  { label: 'Art', value: 'art', emoji: '🎨' },
  { label: 'Family', value: 'family', emoji: '👨‍👩‍👧‍👦' },
  { label: 'Nature', value: 'nature', emoji: '🌿' },
  { label: 'Outdoors', value: 'outdoors', emoji: '🏔️' },
  { label: 'Party', value: 'party', emoji: '🎉' },
  { label: 'Festival', value: 'festival', emoji: '🎪' },
  { label: 'Food', value: 'food', emoji: '🍽️' },
  { label: 'Study', value: 'study', emoji: '📚' },
];

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
