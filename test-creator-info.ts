/**
 * Test Creator Info System
 * 
 * This script tests the unified creator info management system to ensure
 * creator names and photos are displayed consistently across components.
 */

import { creatorInfoManager } from './lib/utils/creatorInfoManager';

async function testCreatorInfoSystem() {
  console.log('🧪 Testing Creator Info Management System');
  
  // Test 1: Basic functionality
  console.log('\n--- Test 1: Basic functionality ---');
  const testCreatorIds = ['user1', 'user2', 'user3'];
  
  // Check initial cache state
  console.log('Initial cache stats:', creatorInfoManager.getCacheStats());
  
  // Test fallback values for unknown creators
  console.log('Unknown creator name:', creatorInfoManager.getCreatorName('unknown'));
  console.log('Unknown creator photo:', creatorInfoManager.getCreatorPhotoUrl('unknown'));
  
  // Test 2: Cache management
  console.log('\n--- Test 2: Cache management ---');
  
  // Test preventing duplicate fetches
  const pendingPromise1 = creatorInfoManager.fetchCreatorNames(['user1', 'user2']);
  const pendingPromise2 = creatorInfoManager.fetchCreatorNames(['user1', 'user3']); // Should not duplicate user1
  
  const [result1, result2] = await Promise.all([pendingPromise1, pendingPromise2]);
  
  console.log('First fetch results:', Object.fromEntries(result1));
  console.log('Second fetch results:', Object.fromEntries(result2));
  
  // Check cache stats after fetch
  console.log('Cache stats after fetch:', creatorInfoManager.getCacheStats());
  
  // Test 3: Photo limit handling
  console.log('\n--- Test 3: Photo limit handling ---');
  
  const manyCreatorIds = Array.from({ length: 25 }, (_, i) => `creator_${i}`);
  const photoResults = await creatorInfoManager.fetchCreatorPhotos(manyCreatorIds, 5);
  
  console.log(`Photo fetch with limit 5 for ${manyCreatorIds.length} creators:`);
  console.log(`Received ${photoResults.size} photo URLs`);
  console.log('Sample photo results:', Array.from(photoResults.entries()).slice(0, 10));
  
  // Test 4: Combined name + photo fetch
  console.log('\n--- Test 4: Combined fetch ---');
  
  const combinedResults = await creatorInfoManager.fetchCreatorInfo(['creator_1', 'creator_2', 'creator_3'], 3);
  console.log('Combined names:', Object.fromEntries(combinedResults.names));
  console.log('Combined photos:', Object.fromEntries(combinedResults.photos));
  
  // Test 5: Cache persistence
  console.log('\n--- Test 5: Cache persistence ---');
  
  // These should return cached values
  console.log('Cached creator name:', creatorInfoManager.getCreatorName('creator_1'));
  console.log('Cached creator photo:', creatorInfoManager.getCreatorPhotoUrl('creator_1'));
  
  // Final stats
  console.log('\nFinal cache stats:', creatorInfoManager.getCacheStats());
  
  console.log('\n✅ Creator Info System test completed');
}

// Mock the API functions for testing
async function mockGetUsersByIds(ids: string[]) {
  console.log(`📡 Mock API: Fetching user profiles for ${ids.length} users:`, ids);
  return ids.map(id => ({
    $id: id,
    firstName: `FirstName_${id}`,
    lastName: `LastName_${id}`,
    name: `FirstName_${id} LastName_${id}`
  }));
}

async function mockGetUserProfilePhotoUrl(userId: string) {
  console.log(`📷 Mock API: Fetching photo for user ${userId}`);
  // Simulate some users having photos and others not
  const hasPhoto = userId.includes('1') || userId.includes('2');
  return hasPhoto ? `https://example.com/photo/${userId}.jpg` : null;
}

// Export test for use in components
export { testCreatorInfoSystem };

// Run test if this file is executed directly
if (require.main === module) {
  // Mock the API imports for testing
  jest.mock('@/lib/api/user', () => ({
    getUsersByIds: mockGetUsersByIds
  }));
  
  jest.mock('@/lib/api/profilePhoto', () => ({
    getUserProfilePhotoUrl: mockGetUserProfilePhotoUrl
  }));
  
  jest.mock('@/lib/utils/userDisplay', () => ({
    userDisplayUtils: {
      hasValidName: (profile: any) => Boolean(profile.firstName && profile.lastName),
      getFullName: (profile: any) => `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown User'
    }
  }));
  
  testCreatorInfoSystem().catch(console.error);
}
