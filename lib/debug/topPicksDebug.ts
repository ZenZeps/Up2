/**
 * TopPicks Cache Debug Utility
 * 
 * Helper functions to debug TopPicks caching issues
 */

import { clearTopPicksCache, getTopPicksCacheInfo } from '@/components/TopPicks';

export const debugTopPicksCache = async () => {
  console.log('🔍 TopPicks Cache Debug:');

  const cacheInfo = await getTopPicksCacheInfo();
  console.log('Cache Info:', cacheInfo);

  return cacheInfo;
};

export const clearAndDebugTopPicksCache = async () => {
  console.log('🧹 Clearing TopPicks Cache...');

  const beforeInfo = await getTopPicksCacheInfo();
  console.log('Before clear:', beforeInfo);

  await clearTopPicksCache();

  const afterInfo = await getTopPicksCacheInfo();
  console.log('After clear:', afterInfo);

  return { before: beforeInfo, after: afterInfo };
};

// Add this to your dev menu or call it from console for testing
export const testTopPicksCache = async () => {
  console.log('🧪 Testing TopPicks Cache...');

  // Get current cache state
  await debugTopPicksCache();

  // Instructions for testing
  console.log(`
  🧪 TopPicks Cache Test Instructions:
  
  1. Navigate to Feed page - this should generate and cache TopPicks
  2. Navigate away from Feed page  
  3. Navigate back to Feed page - this should load from cache
  4. Check console logs for cache hit/miss messages
  5. Use clearAndDebugTopPicksCache() to clear cache and test fresh generation
  
  Expected logs:
  - Fresh generation: "🔄 TopPicks: Generating fresh recommendations..."
  - Cache hit: "✅ TopPicks: Using cached data"
  - Cache details: Look for cache validation logs
  `);
};

// Global function for easy debugging (can be called from React Developer Tools console)
if (typeof global !== 'undefined') {
  (global as any).debugTopPicks = debugTopPicksCache;
  (global as any).clearTopPicksCache = clearAndDebugTopPicksCache;
  (global as any).testTopPicksCache = testTopPicksCache;
}
