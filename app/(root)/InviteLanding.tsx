import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import images from '../../constants/images';
import { getUserProfile } from '../../lib/api/user';
import { config, databases, getCurrentUser } from '../../lib/appwrite/appwrite';
import { userDisplayUtils } from '../../lib/utils/userDisplay';

interface EventDetails {
    $id: string;
    title: string;
    description: string;
    location: string;
    startTime: string;
    endTime: string;
    creatorId: string;
    attendees?: string[];
    inviteeIds?: string[];
}

interface InviterDetails {
    firstName: string;
    lastName: string;
    email: string;
}

export default function InviteLanding() {
    const { eventId, inviter } = useLocalSearchParams<{
        eventId: string;
        inviter: string;
    }>();

    const [loading, setLoading] = useState(true);
    const [event, setEvent] = useState<EventDetails | null>(null);
    const [inviterDetails, setInviterDetails] = useState<InviterDetails | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isAlreadyInvited, setIsAlreadyInvited] = useState(false);

    useEffect(() => {
        loadInviteData();
    }, [eventId, inviter]);

    const loadInviteData = async () => {
        try {
            setLoading(true);

            if (!eventId) {
                Alert.alert('Invalid Invite', 'This invite link appears to be invalid.');
                return;
            }

            // Get current user to check if they're logged in
            const user = await getCurrentUser();
            setCurrentUser(user);

            // Fetch event details
            const eventData = await databases.getDocument(
                config.databaseID!,
                config.eventsCollectionID!,
                eventId
            );
            setEvent(eventData as unknown as EventDetails);

            // Fetch inviter details
            if (inviter) {
                const inviterData = await getUserProfile(inviter);
                setInviterDetails(inviterData);
            }

            // Check if user is already invited or attending
            if (user) {
                const alreadyInvited = eventData.inviteeIds?.includes(user.$id) ||
                    eventData.attendees?.includes(user.$id);
                setIsAlreadyInvited(alreadyInvited);
            }

        } catch (error) {
            console.error('Error loading invite data:', error);
            Alert.alert('Error', 'Failed to load event details. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptInvite = async () => {
        if (!currentUser) {
            // User needs to sign up/in first
            Alert.alert(
                'Account Required',
                'You need to create an account to accept this invite.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign Up', onPress: () => router.push('/SignUp') },
                    { text: 'Sign In', onPress: () => router.push('/SignIn') },
                ]
            );
            return;
        }

        if (!event) return;

        try {
            // Add user to event attendees and remove from invitees
            const updatedInvitees = (event.inviteeIds || []).filter(id => id !== currentUser.$id);
            const updatedAttendees = [...(event.attendees || []), currentUser.$id];

            await databases.updateDocument(
                config.databaseID!,
                config.eventsCollectionID!,
                event.$id,
                {
                    inviteeIds: updatedInvitees,
                    attendees: updatedAttendees,
                }
            );

            Alert.alert('Success!', 'You\'ve accepted the invite and are now attending this event!');
            router.push(`/(root)/event/${event.$id}`);
        } catch (error) {
            console.error('Error accepting invite:', error);
            Alert.alert('Error', 'Failed to accept invite. Please try again.');
        }
    };

    const handleDownloadApp = () => {
        const appStoreUrl = 'https://apps.apple.com/app/up2'; // Replace with your actual App Store URL
        const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.nikolajszeps.up2'; // Replace with your actual Play Store URL

        const url = Platform.OS === 'ios' ? appStoreUrl : playStoreUrl;

        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Unable to open app store. Please search for "Up2" in your app store.');
        });
    };

    const formatEventDate = (startTime: string, endTime: string) => {
        const start = new Date(startTime);
        const end = new Date(endTime);

        const dateStr = start.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        const timeStr = `${start.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        })} - ${end.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        })}`;

        return { dateStr, timeStr };
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white">
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#0061FF" />
                    <Text className="mt-4 text-gray-500 text-lg">Loading invite...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!event) {
        return (
            <SafeAreaView className="flex-1 bg-white">
                <View className="flex-1 justify-center items-center px-6">
                    <MaterialIcons name="error-outline" size={64} color="#EF4444" />
                    <Text className="text-xl font-rubik-semibold text-gray-800 mt-4 text-center">
                        Invite Not Found
                    </Text>
                    <Text className="text-gray-600 text-center mt-2">
                        This invite link appears to be invalid or the event may no longer exist.
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.push('/')}
                        className="bg-blue-500 px-6 py-3 rounded-lg mt-6"
                    >
                        <Text className="text-white font-rubik-semibold">Go to Home</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const { dateStr, timeStr } = formatEventDate(event.startTime, event.endTime);

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header */}
            <LinearGradient
                colors={['#0061FF', '#0047CC']}
                start={[0, 0]}
                end={[1, 1]}
                className="px-6 py-8"
            >
                <View className="items-center">
                    <Image
                        source={images.logo}
                        className="w-16 h-16 mb-4"
                        resizeMode="contain"
                    />
                    <Text className="text-white text-2xl font-rubik-bold text-center">
                        You're Invited!
                    </Text>
                    {inviterDetails && (
                        <Text className="text-blue-100 text-lg font-rubik-medium mt-2 text-center">
                            {userDisplayUtils.getFullName(inviterDetails)} invited you to join
                        </Text>
                    )}
                </View>
            </LinearGradient>

            <ScrollView className="flex-1 px-6 py-6">
                {/* Event Details Card */}
                <View className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <Text className="text-2xl font-rubik-bold text-gray-800 mb-4">
                        {event.title}
                    </Text>

                    <View className="space-y-3">
                        <View className="flex-row items-start">
                            <MaterialIcons name="schedule" size={20} color="#0061FF" />
                            <View className="ml-3 flex-1">
                                <Text className="text-gray-800 font-rubik-medium">{dateStr}</Text>
                                <Text className="text-gray-600">{timeStr}</Text>
                            </View>
                        </View>

                        <View className="flex-row items-start">
                            <MaterialIcons name="location-on" size={20} color="#0061FF" />
                            <Text className="ml-3 flex-1 text-gray-800">{event.location}</Text>
                        </View>

                        {event.description && (
                            <View className="flex-row items-start">
                                <MaterialIcons name="description" size={20} color="#0061FF" />
                                <Text className="ml-3 flex-1 text-gray-700">{event.description}</Text>
                            </View>
                        )}
                    </View>

                    {/* Attendee Count */}
                    <View className="mt-4 pt-4 border-t border-gray-100">
                        <Text className="text-gray-600 font-rubik-medium">
                            {(event.attendees?.length || 0)} people attending
                        </Text>
                    </View>
                </View>

                {/* Action Buttons */}
                <View className="space-y-4">
                    {currentUser ? (
                        isAlreadyInvited ? (
                            <View className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <View className="flex-row items-center justify-center">
                                    <MaterialIcons name="check-circle" size={24} color="#22C55E" />
                                    <Text className="ml-2 text-green-700 font-rubik-semibold text-lg">
                                        You're already invited!
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => router.push(`/(root)/event/${event.$id}`)}
                                    className="bg-green-600 py-3 rounded-lg mt-3"
                                >
                                    <Text className="text-white text-center font-rubik-semibold text-lg">
                                        View Event Details
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={handleAcceptInvite}
                                className="bg-blue-500 py-4 rounded-xl shadow-lg"
                            >
                                <Text className="text-white text-center font-rubik-bold text-lg">
                                    Accept Invite & Join Event
                                </Text>
                            </TouchableOpacity>
                        )
                    ) : (
                        <>
                            <TouchableOpacity
                                onPress={() => router.push('/SignUp')}
                                className="bg-blue-500 py-4 rounded-xl shadow-lg"
                            >
                                <Text className="text-white text-center font-rubik-bold text-lg">
                                    Sign Up to Accept Invite
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => router.push('/SignIn')}
                                className="bg-white border-2 border-blue-500 py-4 rounded-xl"
                            >
                                <Text className="text-blue-500 text-center font-rubik-semibold text-lg">
                                    Already Have an Account? Sign In
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* App Download Section */}
                {!currentUser && (
                    <View className="mt-8 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6">
                        <View className="items-center">
                            <MaterialIcons name="phone-android" size={48} color="#8B5CF6" />
                            <Text className="text-lg font-rubik-bold text-gray-800 mt-3 text-center">
                                Get the Up2 App
                            </Text>
                            <Text className="text-gray-600 text-center mt-2 mb-4">
                                Join thousands of people organizing amazing events in your area!
                            </Text>
                            <TouchableOpacity
                                onPress={handleDownloadApp}
                                className="bg-gradient-to-r from-purple-500 to-blue-500 py-3 px-8 rounded-lg"
                            >
                                <Text className="text-white font-rubik-semibold">
                                    Download Now
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
