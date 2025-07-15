import { UserProfile } from '@/lib/types/Users';

/**
 * Utility functions for displaying user names using the new firstName/lastName schema
 * The database now only has firstName and lastName fields (no 'name' field)
 */

export const userDisplayUtils = {
  /**
   * Get the full display name for a user
   * Combines firstName and lastName from the new schema
   */
  getFullName: (user: Partial<UserProfile>, fallback = 'Unknown User'): string => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    
    if (user?.firstName) {
      return user.firstName;
    }
    
    if (user?.lastName) {
      return user.lastName;
    }
    
    return fallback;
  },

  /**
   * Get the first name for display
   */
  getFirstName: (user: Partial<UserProfile>, fallback = 'User'): string => {
    return user?.firstName || fallback;
  },

  /**
   * Get the last name for display
   */
  getLastName: (user: Partial<UserProfile>, fallback = ''): string => {
    return user?.lastName || fallback;
  },

  /**
   * Get initials for avatar display
   */
  getInitials: (user: Partial<UserProfile>): string => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName.charAt(0).toUpperCase()}${user.lastName.charAt(0).toUpperCase()}`;
    }
    
    if (user?.firstName) {
      return user.firstName.charAt(0).toUpperCase();
    }
    
    return 'U';
  },

  /**
   * Format name for search/filtering
   * Returns lowercase full name for case-insensitive matching
   */
  getSearchableText: (user: Partial<UserProfile>): string => {
    const fullName = userDisplayUtils.getFullName(user);
    return fullName.toLowerCase();
  },

  /**
   * Check if user has valid name data
   */
  hasValidName: (user: Partial<UserProfile>): boolean => {
    return !!(user?.firstName || user?.lastName);
  }
};

export default userDisplayUtils;
