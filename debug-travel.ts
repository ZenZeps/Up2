/**
 * Quick test script to create a test travel announcement
 * This will help us verify the calendar integration is working
 */

import { createSimpleTravelAnnouncement } from './lib/api/travel';

// Create a test travel announcement for the next few days
export async function createTestTravelAnnouncement(userId: string) {
  try {
    console.log('🧪 Creating test travel announcement...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);

    const testTravel = {
      userId: userId,
      destination: 'Test City, Test Country',
      startDate: tomorrow.toISOString(),
      endDate: nextWeek.toISOString(),
      description: 'Test travel announcement for calendar integration',
      isPublic: true
    };

    console.log('🧪 Test travel data:', testTravel);

    const result = await createSimpleTravelAnnouncement(testTravel);

    console.log('✅ Test travel announcement created:', result.$id);
    console.log('📅 Travel should now appear on calendar from', testTravel.startDate, 'to', testTravel.endDate);

    return result;
  } catch (error) {
    console.error('❌ Failed to create test travel announcement:', error);
    throw error;
  }
}

// Function to help debug by listing all travel for a user
export async function debugUserTravel(userId: string) {
  try {
    const { getUserTravelAnnouncements } = await import('./lib/api/travel');

    console.log('🔍 Fetching all travel for user:', userId.substring(0, 8) + '...');

    const allTravel = await getUserTravelAnnouncements(userId, 100);

    console.log('🔍 All user travel:', {
      count: allTravel.length,
      travel: allTravel.map(t => ({
        id: t.$id,
        destination: t.destination,
        startDate: t.startDate,
        endDate: t.endDate,
        isActive: new Date(t.endDate) >= new Date()
      }))
    });

    return allTravel;
  } catch (error) {
    console.error('❌ Failed to debug user travel:', error);
    return [];
  }
}