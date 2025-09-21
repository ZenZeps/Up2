// Test script to create a sample travel announcement and verify the collection works
import { createTravelAnnouncement } from '@/lib/api/travel';

export const testTravelCollection = async (currentUserId: string) => {
    console.log('🧪 Testing travel collection with user ID:', currentUserId);

    try {
        // Create a test travel announcement
        const testTravel = {
            userId: currentUserId,
            destination: "Test City",
            startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
            description: "Test travel announcement to verify collection is working",
            isPublic: true,
            destinationLat: -33.8688,
            destinationLng: 151.2093,
            locationName: "Test Location"
        };

        console.log('🧪 Creating test travel announcement...');
        const result = await createTravelAnnouncement(testTravel, []);
        console.log('✅ Test travel announcement created successfully:', result.$id);

        return result;
    } catch (error) {
        console.error('❌ Failed to create test travel announcement:', error);
        throw error;
    }
};

export { };

