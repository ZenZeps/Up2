import { QUICK_SEARCH_CITIES, getLocationCoordinates } from '@/constants/locations';
import {
    createTravelAnnouncementWithFriendNotifications,
    findFriendsInSameLocation,
    getFriendsCurrentlyTraveling
} from '@/lib/api/travelFriendNotifications';
import { TravelAnnouncement } from '@/lib/types/Travel';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface TravelFriendNotificationsProps {
    currentUser: any;
    userFriends: string[];
}



const TravelFriendNotifications: React.FC<TravelFriendNotificationsProps> = ({
    currentUser,
    userFriends
}) => {
    // Form state
    const [destination, setDestination] = useState('');
    const [destinationLat, setDestinationLat] = useState<number | undefined>();
    const [destinationLng, setDestinationLng] = useState<number | undefined>();
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Friends travel state
    const [friendsCurrentlyTraveling, setFriendsCurrentlyTraveling] = useState<TravelAnnouncement[]>([]);
    const [loadingFriends, setLoadingFriends] = useState(false);

    useEffect(() => {
        loadFriendsTravel();
    }, [userFriends]);

    const loadFriendsTravel = useCallback(async () => {
        if (!userFriends?.length) return;

        setLoadingFriends(true);
        try {
            const currentlyTraveling = await getFriendsCurrentlyTraveling(userFriends);
            setFriendsCurrentlyTraveling(currentlyTraveling);
        } catch (error) {
            console.error('Error loading friends travel:', error);
        } finally {
            setLoadingFriends(false);
        }
    }, [userFriends]);

    const handleCreateTravel = useCallback(async () => {
        if (!destination.trim()) {
            Alert.alert('Error', 'Please enter a destination');
            return;
        }

        setIsLoading(true);
        try {
            await createTravelAnnouncementWithFriendNotifications(
                {
                    userId: currentUser.$id,
                    destination: destination.trim(),
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    description: description.trim(),
                    isPublic: true,
                    destinationLat,
                    destinationLng,
                    locationName: destination.trim(),
                },
                userFriends
            );

            Alert.alert(
                'Travel Created! 🌍',
                `Your travel to ${destination} has been posted and friends have been notified!`,
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            // Reset form
                            setDestination('');
                            setDestinationLat(undefined);
                            setDestinationLng(undefined);
                            setStartDate(new Date());
                            setEndDate(new Date());
                            setDescription('');
                            // Reload friends travel
                            loadFriendsTravel();
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Error creating travel:', error);
            Alert.alert('Error', 'Failed to create travel announcement');
        } finally {
            setIsLoading(false);
        }
    }, [destination, startDate, endDate, description, destinationLat, destinationLng, currentUser.$id, userFriends, loadFriendsTravel]);

    const checkLocationOverlap = async (friendTravel: TravelAnnouncement) => {
        if (!friendTravel.destinationLat || !friendTravel.destinationLng) {
            Alert.alert('Info', 'Location coordinates not available for this travel');
            return;
        }

        try {
            const overlappingFriends = await findFriendsInSameLocation(
                friendTravel.destinationLat,
                friendTravel.destinationLng,
                friendTravel.startDate,
                friendTravel.endDate,
                [currentUser.$id], // Check if current user will be there
                50 // 50km radius
            );

            if (overlappingFriends.length > 0) {
                Alert.alert(
                    '🎉 Location Match!',
                    `You'll both be in ${friendTravel.destination} at the same time! Consider planning a meetup.`,
                    [
                        { text: 'Cool!', style: 'default' },
                        { text: 'Message Friend', style: 'default' } // TODO: Implement messaging
                    ]
                );
            } else {
                Alert.alert(
                    'No Overlap',
                    `You won't be in ${friendTravel.destination} at the same time as this friend.`
                );
            }
        } catch (error) {
            console.error('Error checking location overlap:', error);
            Alert.alert('Error', 'Could not check location overlap');
        }
    };

    // Optimized location search using centralized location data
    const searchLocation = useCallback((query: string) => {
        const location = getLocationCoordinates(query);

        setDestination(query);
        setDestinationLat(location?.lat);
        setDestinationLng(location?.lng);
    }, []);

    return (
        <ScrollView className="flex-1 bg-gray-50">
            {/* Create Travel Form */}
            <View className="bg-white p-6 m-4 rounded-xl shadow-sm">
                <Text className="text-2xl font-bold text-gray-800 mb-6">
                    ✈️ Create Travel Announcement
                </Text>

                {/* Destination */}
                <View className="mb-4">
                    <Text className="text-gray-700 font-medium mb-2">Where are you traveling?</Text>
                    <TextInput
                        className="border border-gray-300 rounded-lg p-3 text-gray-800"
                        placeholder="e.g., Sydney, New York, Tokyo"
                        value={destination}
                        onChangeText={searchLocation}
                    />
                    {destinationLat && destinationLng && (
                        <Text className="text-green-600 text-sm mt-1">
                            📍 Location found: {destinationLat.toFixed(4)}, {destinationLng.toFixed(4)}
                        </Text>
                    )}
                </View>

                {/* Dates */}
                <View className="flex-row mb-4">
                    <View className="flex-1 mr-2">
                        <Text className="text-gray-700 font-medium mb-2">Start Date</Text>
                        <TouchableOpacity
                            className="border border-gray-300 rounded-lg p-3"
                            onPress={() => {
                                // TODO: Implement date picker
                                Alert.alert('Date Picker', 'Implement date picker here');
                            }}
                        >
                            <Text className="text-gray-800">
                                {dayjs(startDate).format('MMM D, YYYY')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View className="flex-1 ml-2">
                        <Text className="text-gray-700 font-medium mb-2">End Date</Text>
                        <TouchableOpacity
                            className="border border-gray-300 rounded-lg p-3"
                            onPress={() => {
                                // TODO: Implement date picker
                                Alert.alert('Date Picker', 'Implement date picker here');
                            }}
                        >
                            <Text className="text-gray-800">
                                {dayjs(endDate).format('MMM D, YYYY')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Description */}
                <View className="mb-6">
                    <Text className="text-gray-700 font-medium mb-2">What are you doing there?</Text>
                    <TextInput
                        className="border border-gray-300 rounded-lg p-3 text-gray-800"
                        placeholder="Business trip, vacation, visiting friends..."
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Create Button */}
                <TouchableOpacity
                    className={`rounded-lg p-4 ${isLoading || !destination.trim() ? 'bg-gray-400' : 'bg-blue-500'}`}
                    onPress={handleCreateTravel}
                    disabled={isLoading || !destination.trim()}
                >
                    {isLoading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white text-center font-bold text-lg">
                            Create Travel & Notify Friends 🌍
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Friends Currently Traveling */}
            <View className="bg-white p-6 m-4 rounded-xl shadow-sm">
                <Text className="text-xl font-bold text-gray-800 mb-4">
                    🌍 Friends Traveling Now
                </Text>

                {loadingFriends ? (
                    <View className="py-8">
                        <ActivityIndicator size="large" color="#3B82F6" />
                        <Text className="text-center text-gray-600 mt-2">Loading friends' travel...</Text>
                    </View>
                ) : friendsCurrentlyTraveling.length > 0 ? (
                    friendsCurrentlyTraveling.map((travel) => (
                        <View key={travel.$id} className="bg-gray-50 rounded-lg p-4 mb-3">
                            <View className="flex-row items-center justify-between mb-2">
                                <Text className="text-lg font-bold text-gray-800">
                                    📍 {travel.destination}
                                </Text>
                                <View className="bg-green-500 px-3 py-1 rounded-full">
                                    <Text className="text-white text-xs font-bold">LIVE</Text>
                                </View>
                            </View>

                            <Text className="text-gray-600 mb-2">
                                {dayjs(travel.startDate).format('MMM D')} - {dayjs(travel.endDate).format('MMM D, YYYY')}
                            </Text>

                            {travel.description && (
                                <Text className="text-gray-700 mb-3">{travel.description}</Text>
                            )}

                            <TouchableOpacity
                                className="bg-blue-500 px-4 py-2 rounded-lg"
                                onPress={() => checkLocationOverlap(travel)}
                            >
                                <Text className="text-white text-center font-medium">
                                    Check if we'll be there together
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ))
                ) : (
                    <Text className="text-gray-500 text-center py-8">
                        None of your friends are currently traveling
                    </Text>
                )}
            </View>

            {/* Quick Location Search Helper */}
            <View className="bg-blue-50 p-4 m-4 rounded-xl">
                <Text className="text-blue-800 font-medium mb-2">💡 Quick Location Search</Text>
                <Text className="text-blue-700 text-sm mb-3">
                    Try typing: Sydney, Melbourne, Brisbane, Perth, Adelaide, New York, London, Tokyo, Paris, Bali
                </Text>
                <View className="flex-row flex-wrap">
                    {QUICK_SEARCH_CITIES.map((city) => (
                        <TouchableOpacity
                            key={city}
                            className="bg-blue-500 px-3 py-1 rounded-full mr-2 mb-2"
                            onPress={() => searchLocation(city)}
                        >
                            <Text className="text-white text-sm">{city}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
};

export default TravelFriendNotifications;
