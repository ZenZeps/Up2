import { createTravelAnnouncement, getUserTravelAnnouncements } from '@/lib/api/travel';
import { config } from '@/lib/appwrite/appwrite';
import { useGlobalContext } from '@/lib/global-provider';
import React from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

export default function TravelDebugComponent() {
    const { user } = useGlobalContext();

    const testCreateTravel = async () => {
        if (!user) {
            Alert.alert('Error', 'No user logged in');
            return;
        }

        try {
            console.log('🧪 Testing travel creation...');
            console.log('🧪 Using collection ID:', config.travelCollectionID);

            const testTravel = {
                userId: user.$id,
                destination: "Test Destination",
                startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                description: "Test travel to verify collection is working",
                isPublic: true,
                destinationLat: -33.8688,
                destinationLng: 151.2093,
                locationName: "Test Location"
            };

            const result = await createTravelAnnouncement(testTravel, []);
            console.log('✅ Travel created successfully:', result);
            Alert.alert('Success', `Travel announcement created: ${result.destination}`);

            // Try to fetch it back
            setTimeout(async () => {
                const userTravel = await getUserTravelAnnouncements(user.$id);
                console.log('🔍 User travel after creation:', userTravel);
                Alert.alert('Fetch Result', `Found ${userTravel.length} travel announcements for user`);
            }, 1000);

        } catch (error) {
            console.error('❌ Error creating travel:', error);
            Alert.alert('Error', `Failed to create travel: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const testFetchTravel = async () => {
        if (!user) {
            Alert.alert('Error', 'No user logged in');
            return;
        }

        try {
            console.log('🔍 Testing travel fetch...');
            const userTravel = await getUserTravelAnnouncements(user.$id);
            console.log('🔍 User travel:', userTravel);
            Alert.alert('Fetch Result', `Found ${userTravel.length} travel announcements`);
        } catch (error) {
            console.error('❌ Error fetching travel:', error);
            Alert.alert('Error', `Failed to fetch travel: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    if (!user) {
        return (
            <View style={{ padding: 20, backgroundColor: '#f0f0f0', margin: 10, borderRadius: 8 }}>
                <Text style={{ color: 'red' }}>No user logged in</Text>
            </View>
        );
    }

    return (
        <View style={{ padding: 20, backgroundColor: '#f0f0f0', margin: 10, borderRadius: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
                Travel Debug Controls
            </Text>
            <Text style={{ fontSize: 12, marginBottom: 10 }}>
                Collection ID: {config.travelCollectionID}
            </Text>
            <Text style={{ fontSize: 12, marginBottom: 15 }}>
                User: {user.name || user.email}
            </Text>

            <TouchableOpacity
                onPress={testCreateTravel}
                style={{
                    backgroundColor: '#007AFF',
                    padding: 12,
                    borderRadius: 6,
                    marginBottom: 10
                }}
            >
                <Text style={{ color: 'white', textAlign: 'center' }}>
                    Create Test Travel
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={testFetchTravel}
                style={{
                    backgroundColor: '#34C759',
                    padding: 12,
                    borderRadius: 6
                }}
            >
                <Text style={{ color: 'white', textAlign: 'center' }}>
                    Fetch My Travel
                </Text>
            </TouchableOpacity>
        </View>
    );
}
