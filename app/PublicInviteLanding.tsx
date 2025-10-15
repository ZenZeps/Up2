import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import images from '../constants/images';
import { config, databases } from '../lib/appwrite/appwrite';

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

export default function PublicInviteLanding() {
    const { eventId, inviter } = useLocalSearchParams<{
        eventId: string;
        inviter: string;
    }>();

    // Consolidated state for better performance
    const [inviteState, setInviteState] = useState(() => ({
        loading: true,
        event: null as EventDetails | null
    }));

    const { loading, event } = inviteState;

    useEffect(() => {
        loadInviteData();
    }, [eventId]);

    const loadInviteData = useCallback(async () => {
        try {
            setInviteState(prev => ({ ...prev, loading: true }));

            if (!eventId) {
                Alert.alert('Invalid Invite', 'This invite link appears to be invalid.');
                return;
            }

            // Parallel fetch of event data and attendees
            const [eventData, attendeesResult] = await Promise.allSettled([
                databases.getDocument(
                    config.databaseID!,
                    config.eventsCollectionID!,
                    eventId
                ),
                (async () => {
                    try {
                        const { getEventAttendees } = await import('../lib/api/event');
                        return await getEventAttendees(eventId);
                    } catch {
                        return null;
                    }
                })()
            ]);

            if (eventData.status === 'fulfilled') {
                const combinedEvent = {
                    ...eventData.value,
                    attendeeCount: attendeesResult.status === 'fulfilled' && Array.isArray(attendeesResult.value)
                        ? attendeesResult.value.length
                        : (eventData.value as any).attendees?.length || 0
                } as unknown as EventDetails;

                setInviteState({ loading: false, event: combinedEvent });
            } else {
                throw eventData.reason;
            }

        } catch (error) {
            console.error('Error loading invite data:', error);
            Alert.alert('Error', 'Failed to load event details. Please try again.');
            setInviteState({ loading: false, event: null });
        }
    }, [eventId]);

    const handleDownloadApp = useCallback(() => {
        const appStoreUrl = 'https://apps.apple.com/app/up2';
        const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.nikolajszeps.up2';
        const url = Platform.OS === 'ios' ? appStoreUrl : playStoreUrl;

        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Unable to open app store. Please search for "Up2" in your app store.');
        });
    }, []);

    const handleOpenInApp = useCallback(() => {
        const deepLink = `up2://invite?eventId=${eventId}&inviter=${inviter}&type=event-invite`;

        Linking.openURL(deepLink).catch(() => {
            handleDownloadApp();
        });
    }, [eventId, inviter, handleDownloadApp]);

    const formatEventDate = useCallback((startTime: string, endTime: string) => {
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
    }, []);

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
                        Event Not Found
                    </Text>
                    <Text className="text-gray-600 text-center mt-2">
                        This event may no longer exist or the invite link is invalid.
                    </Text>
                    <TouchableOpacity
                        onPress={handleDownloadApp}
                        className="bg-blue-500 px-6 py-3 rounded-lg mt-6"
                    >
                        <Text className="text-white font-rubik-semibold">Download Up2 App</Text>
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
                    <Text className="text-blue-100 text-lg font-rubik-medium mt-2 text-center">
                        Join this amazing event on Up2
                    </Text>
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
                            {((typeof (event as any).attendeeCount === 'number') ? (event as any).attendeeCount : (event.attendees?.length || 0))} people attending
                        </Text>
                    </View>
                </View>

                {/* Action Buttons */}
                <View className="space-y-4">
                    <TouchableOpacity
                        onPress={handleOpenInApp}
                        className="bg-blue-500 py-4 rounded-xl shadow-lg"
                    >
                        <Text className="text-white text-center font-rubik-bold text-lg">
                            Open in Up2 App
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleDownloadApp}
                        className="bg-white border-2 border-blue-500 py-4 rounded-xl"
                    >
                        <Text className="text-blue-500 text-center font-rubik-semibold text-lg">
                            Download Up2 App
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* App Features Section */}
                <View className="mt-8 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6">
                    <View className="items-center mb-4">
                        <MaterialIcons name="event" size={48} color="#8B5CF6" />
                        <Text className="text-lg font-rubik-bold text-gray-800 mt-3 text-center">
                            Join the Up2 Community
                        </Text>
                    </View>

                    <View className="space-y-3">
                        <View className="flex-row items-center">
                            <MaterialIcons name="check-circle" size={20} color="#22C55E" />
                            <Text className="ml-2 text-gray-700">Discover local events and activities</Text>
                        </View>
                        <View className="flex-row items-center">
                            <MaterialIcons name="check-circle" size={20} color="#22C55E" />
                            <Text className="ml-2 text-gray-700">Create your own events and invite friends</Text>
                        </View>
                        <View className="flex-row items-center">
                            <MaterialIcons name="check-circle" size={20} color="#22C55E" />
                            <Text className="ml-2 text-gray-700">Connect with like-minded people nearby</Text>
                        </View>
                        <View className="flex-row items-center">
                            <MaterialIcons name="check-circle" size={20} color="#22C55E" />
                            <Text className="ml-2 text-gray-700">Never miss out on exciting experiences</Text>
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <View className="mt-8 items-center">
                    <Text className="text-gray-500 text-center">
                        Available on iOS and Android
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
