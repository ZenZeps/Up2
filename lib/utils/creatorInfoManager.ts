/**
 * Unified Creator Information Management
 * 
 * This utility provides consistent creator name and photo handling across
 * Home and Feed components to eliminate display inconsistencies.
 */

import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getUsersByIds } from '@/lib/api/user';
import { userDisplayUtils } from '@/lib/utils/userDisplay';

export interface CreatorInfo {
  name: string;
  photoUrl: string | null;
}

class CreatorInfoManager {
  private static instance: CreatorInfoManager;
  private nameCache = new Map<string, string>();
  private photoCache = new Map<string, string | null>();
  private pendingNameFetches = new Set<string>();
  private pendingPhotoFetches = new Set<string>();

  private constructor() { }

  static getInstance(): CreatorInfoManager {
    if (!CreatorInfoManager.instance) {
      CreatorInfoManager.instance = new CreatorInfoManager();
    }
    return CreatorInfoManager.instance;
  }

  /**
   * Get creator name from cache or return fallback
   */
  getCreatorName(creatorId: string): string {
    if (!creatorId) return 'Unknown Creator';
    return this.nameCache.get(creatorId) || 'Unknown Creator';
  }

  /**
   * Get creator photo URL from cache or return null
   */
  getCreatorPhotoUrl(creatorId: string): string | null {
    if (!creatorId) return null;
    return this.photoCache.get(creatorId) || null;
  }

  /**
   * Get creator info (name + photo) from cache
   */
  getCreatorInfo(creatorId: string): CreatorInfo {
    return {
      name: this.getCreatorName(creatorId),
      photoUrl: this.getCreatorPhotoUrl(creatorId)
    };
  }

  /**
   * Check if we have creator name in cache
   */
  hasCreatorName(creatorId: string): boolean {
    return this.nameCache.has(creatorId);
  }

  /**
   * Check if we have creator photo in cache
   */
  hasCreatorPhoto(creatorId: string): boolean {
    return this.photoCache.has(creatorId);
  }

  /**
   * Batch fetch creator names for multiple IDs
   * Returns Map of creatorId -> name for immediate use
   */
  async fetchCreatorNames(creatorIds: string[]): Promise<Map<string, string>> {
    const uncachedIds = creatorIds
      .filter(id => id && !this.nameCache.has(id) && !this.pendingNameFetches.has(id));

    if (uncachedIds.length === 0) {
      // Return existing cache entries
      const resultMap = new Map<string, string>();
      creatorIds.forEach(id => {
        if (id && this.nameCache.has(id)) {
          resultMap.set(id, this.nameCache.get(id)!);
        }
      });
      return resultMap;
    }

    // Mark as pending to prevent duplicate requests
    uncachedIds.forEach(id => this.pendingNameFetches.add(id));

    try {
      const profiles = await getUsersByIds(uncachedIds);
      const resultMap = new Map<string, string>();

      // Process fetched profiles
      profiles.forEach(profile => {
        if (profile.$id && userDisplayUtils.hasValidName(profile)) {
          const fullName = userDisplayUtils.getFullName(profile);
          this.nameCache.set(profile.$id, fullName);
          resultMap.set(profile.$id, fullName);
        }
      });

      // Add fallback names for IDs that didn't return profiles
      uncachedIds.forEach(id => {
        if (!resultMap.has(id)) {
          const fallbackName = 'Unknown Creator';
          this.nameCache.set(id, fallbackName);
          resultMap.set(id, fallbackName);
        }
      });

      // Also include already cached names in result
      creatorIds.forEach(id => {
        if (id && this.nameCache.has(id) && !resultMap.has(id)) {
          resultMap.set(id, this.nameCache.get(id)!);
        }
      });

      return resultMap;
    } catch (error) {
      console.warn('CreatorInfoManager: Failed to fetch creator names:', error);

      // Set fallback names for failed fetches
      const resultMap = new Map<string, string>();
      uncachedIds.forEach(id => {
        const fallbackName = 'Unknown Creator';
        this.nameCache.set(id, fallbackName);
        resultMap.set(id, fallbackName);
      });

      return resultMap;
    } finally {
      // Clear pending status
      uncachedIds.forEach(id => this.pendingNameFetches.delete(id));
    }
  }

  /**
   * Batch fetch creator photos for multiple IDs with priority limit
   * Returns Map of creatorId -> photoUrl for immediate use
   */
  async fetchCreatorPhotos(creatorIds: string[], limit: number = 20): Promise<Map<string, string | null>> {
    const uncachedIds = creatorIds
      .filter(id => id && !this.photoCache.has(id) && !this.pendingPhotoFetches.has(id))
      .slice(0, limit);

    if (uncachedIds.length === 0) {
      // Return existing cache entries
      const resultMap = new Map<string, string | null>();
      creatorIds.forEach(id => {
        if (id && this.photoCache.has(id)) {
          resultMap.set(id, this.photoCache.get(id)!);
        }
      });
      return resultMap;
    }

    // Mark as pending to prevent duplicate requests
    uncachedIds.forEach(id => this.pendingPhotoFetches.add(id));

    try {
      const resultMap = new Map<string, string | null>();

      // Fetch photos in parallel
      await Promise.all(uncachedIds.map(async (creatorId) => {
        try {
          const photoUrl = await getUserProfilePhotoUrl(creatorId);
          this.photoCache.set(creatorId, photoUrl);
          resultMap.set(creatorId, photoUrl);
        } catch {
          this.photoCache.set(creatorId, null);
          resultMap.set(creatorId, null);
        }
      }));

      // Set null for remaining IDs that exceeded limit
      const remainingIds = creatorIds
        .filter(id => id && !this.photoCache.has(id))
        .slice(limit);

      remainingIds.forEach(id => {
        this.photoCache.set(id, null);
        resultMap.set(id, null);
      });

      // Include already cached photos in result
      creatorIds.forEach(id => {
        if (id && this.photoCache.has(id) && !resultMap.has(id)) {
          resultMap.set(id, this.photoCache.get(id)!);
        }
      });

      return resultMap;
    } catch (error) {
      console.warn('CreatorInfoManager: Failed to fetch creator photos:', error);

      // Set null for failed fetches
      const resultMap = new Map<string, string | null>();
      uncachedIds.forEach(id => {
        this.photoCache.set(id, null);
        resultMap.set(id, null);
      });

      return resultMap;
    } finally {
      // Clear pending status
      uncachedIds.forEach(id => this.pendingPhotoFetches.delete(id));
    }
  }

  /**
   * Batch fetch both names and photos for creator IDs
   * Returns object with separate Maps for names and photos
   */
  async fetchCreatorInfo(creatorIds: string[], photoLimit: number = 20): Promise<{
    names: Map<string, string>;
    photos: Map<string, string | null>;
  }> {
    const [names, photos] = await Promise.all([
      this.fetchCreatorNames(creatorIds),
      this.fetchCreatorPhotos(creatorIds, photoLimit)
    ]);

    return { names, photos };
  }

  /**
   * Clear all caches (useful for testing or memory management)
   */
  clearCache(): void {
    this.nameCache.clear();
    this.photoCache.clear();
    this.pendingNameFetches.clear();
    this.pendingPhotoFetches.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): {
    nameCount: number;
    photoCount: number;
    pendingNames: number;
    pendingPhotos: number;
  } {
    return {
      nameCount: this.nameCache.size,
      photoCount: this.photoCache.size,
      pendingNames: this.pendingNameFetches.size,
      pendingPhotos: this.pendingPhotoFetches.size,
    };
  }
}

// Export singleton instance
export const creatorInfoManager = CreatorInfoManager.getInstance();

/**
 * React hook for managing creator information in components
 */
import { useCallback, useEffect, useState } from 'react';

export interface UseCreatorInfoResult {
  getCreatorName: (creatorId: string) => string;
  getCreatorPhotoUrl: (creatorId: string) => string | null;
  creatorNames: Record<string, string>;
  creatorPhotos: Record<string, string | null>;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useCreatorInfo(creatorIds: string[], photoLimit: number = 20): UseCreatorInfoResult {
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [creatorPhotos, setCreatorPhotos] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Create a stable string representation of creator IDs to avoid infinite loops
  const creatorIdsKey = creatorIds.sort().join(',');

  const fetchInfo = useCallback(async () => {
    if (!creatorIds.length) {
      setCreatorNames({});
      setCreatorPhotos({});
      return;
    }

    setIsLoading(true);
    try {
      const { names, photos } = await creatorInfoManager.fetchCreatorInfo(creatorIds, photoLimit);

      const nameRecord: Record<string, string> = {};
      const photoRecord: Record<string, string | null> = {};

      names.forEach((name, id) => {
        nameRecord[id] = name;
      });

      photos.forEach((photo, id) => {
        photoRecord[id] = photo;
      });

      setCreatorNames(nameRecord);
      setCreatorPhotos(photoRecord);
    } catch (error) {
      console.warn('useCreatorInfo: Failed to fetch creator info:', error);
    } finally {
      setIsLoading(false);
    }
  }, [creatorIdsKey, photoLimit]); // Use stable string key instead of array

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  const getCreatorName = useCallback((creatorId: string) => {
    return creatorInfoManager.getCreatorName(creatorId);
  }, []);

  const getCreatorPhotoUrl = useCallback((creatorId: string) => {
    return creatorInfoManager.getCreatorPhotoUrl(creatorId);
  }, []);

  return {
    getCreatorName,
    getCreatorPhotoUrl,
    creatorNames,
    creatorPhotos,
    isLoading,
    refresh: fetchInfo
  };
}
