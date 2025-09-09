/**
 * Quick TopPicks Cache Debugging
 * Run this in React Developer Tools console to debug cache issues
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOP_PICKS_CACHE_KEY = 'top_picks_cache';

// Quick cache inspection
export const inspectTopPicksCache = async () => {
  console.log('🔍 Inspecting TopPicks Cache...');

  try {
    const cached = await AsyncStorage.getItem(TOP_PICKS_CACHE_KEY);

    if (!cached) {
      console.log('❌ No cache found');
      return { exists: false };
    }

    const data = JSON.parse(cached);
    const age = Date.now() - data.timestamp;

    console.log('✅ Cache found:', {
      age: Math.round(age / 1000) + ' seconds',
      expired: age > 600000, // 10 minutes
      dataCount: data.data?.length || 0,
      eventsHash: data.allEventsHash,
      friendsHash: data.userFriendsHash
    });

    return data;
  } catch (error) {
    console.error('❌ Cache inspection failed:', error);
    return { error };
  }
};

// Clear cache for testing
export const clearTopPicksCache = async () => {
  console.log('🗑️ Clearing TopPicks Cache...');

  try {
    await AsyncStorage.removeItem(TOP_PICKS_CACHE_KEY);
    console.log('✅ Cache cleared successfully');
  } catch (error) {
    console.error('❌ Failed to clear cache:', error);
  }
};

// Make functions available globally for easy debugging
if (typeof window !== 'undefined') {
  (window as any).inspectTopPicksCache = inspectTopPicksCache;
  (window as any).clearTopPicksCache = clearTopPicksCache;
}

export default { inspectTopPicksCache, clearTopPicksCache };
