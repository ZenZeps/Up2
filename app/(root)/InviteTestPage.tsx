import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QuickShareButton from '../../components/QuickShareButton';
import ShareInviteModal from '../../components/ShareInviteModal';
import { generateAppDeepLink, generateInviteLink } from '../../lib/utils/invites';

export default function InviteTestingPage() {
    const [eventId, setEventId] = useState('');
    const [showShareModal, setShowShareModal] = useState(false);
    const [generatedWebLink, setGeneratedWebLink] = useState('');
    const [generatedDeepLink, setGeneratedDeepLink] = useState('');

    const generateTestLinks = async () => {
        if (!eventId.trim()) {
            Alert.alert('Error', 'Please enter an Event ID');
            return;
        }

        try {
            const mockInviteData = {
                eventId: eventId.trim(),
                eventTitle: 'Test Event',
                eventDate: 'Tomorrow at 7:00 PM',
                eventLocation: 'Test Location',
                inviterName: 'Test User',
                inviterUserId: 'test-user-123'
            };

            const webLink = generateInviteLink(mockInviteData);
            const deepLink = generateAppDeepLink(mockInviteData);

            setGeneratedWebLink(webLink);
            setGeneratedDeepLink(deepLink);

            Alert.alert('Success', 'Test links generated!');
        } catch (error) {
            console.error('Error generating links:', error);
            Alert.alert('Error', 'Failed to generate test links');
        }
    };

    const copyToClipboard = (text: string) => {
        // In a real app, you'd use expo-clipboard or similar
        console.log('Copy to clipboard:', text);
        Alert.alert('Copied', 'Link copied to console log');
    };

    const testDeepLink = () => {
        if (!generatedDeepLink) {
            Alert.alert('Error', 'Generate links first');
            return;
        }

        // In a real test, you'd use Linking.openURL(generatedDeepLink)
        console.log('Testing deep link:', generatedDeepLink);
        Alert.alert('Deep Link Test', 'Check console for link - use with iOS Simulator or Android Emulator');
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <ScrollView className="flex-1 p-4">
                {/* Header */}
                <View className="bg-blue-500 rounded-xl p-6 mb-6">
                    <Text className="text-white text-2xl font-rubik-bold mb-2">
                        Invite System Testing
                    </Text>
                    <Text className="text-blue-100">
                        Test the cross-platform invite functionality
                    </Text>
                </View>

                {/* Event ID Input */}
                <View className="bg-white rounded-xl p-4 mb-4">
                    <Text className="text-lg font-rubik-semibold mb-2">Event ID</Text>
                    <TextInput
                        value={eventId}
                        onChangeText={setEventId}
                        placeholder="Enter an existing event ID"
                        className="border border-gray-300 rounded-lg p-3 mb-3"
                    />
                    <TouchableOpacity
                        onPress={generateTestLinks}
                        className="bg-blue-500 py-3 rounded-lg"
                    >
                        <Text className="text-white text-center font-rubik-semibold">
                            Generate Test Links
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Generated Links */}
                {generatedWebLink && (
                    <View className="bg-white rounded-xl p-4 mb-4">
                        <Text className="text-lg font-rubik-semibold mb-3">Generated Links</Text>

                        <View className="mb-4">
                            <Text className="font-rubik-medium text-gray-700 mb-2">Web Link:</Text>
                            <TouchableOpacity
                                onPress={() => copyToClipboard(generatedWebLink)}
                                className="bg-gray-100 p-3 rounded-lg flex-row justify-between items-center"
                            >
                                <Text className="text-gray-800 flex-1" numberOfLines={2}>
                                    {generatedWebLink}
                                </Text>
                                <MaterialIcons name="content-copy" size={20} color="#666666" />
                            </TouchableOpacity>
                        </View>

                        <View className="mb-4">
                            <Text className="font-rubik-medium text-gray-700 mb-2">Deep Link:</Text>
                            <TouchableOpacity
                                onPress={() => copyToClipboard(generatedDeepLink)}
                                className="bg-gray-100 p-3 rounded-lg flex-row justify-between items-center"
                            >
                                <Text className="text-gray-800 flex-1" numberOfLines={2}>
                                    {generatedDeepLink}
                                </Text>
                                <MaterialIcons name="content-copy" size={20} color="#666666" />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={testDeepLink}
                            className="bg-green-500 py-3 rounded-lg"
                        >
                            <Text className="text-white text-center font-rubik-semibold">
                                Test Deep Link
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Quick Share Buttons */}
                <View className="bg-white rounded-xl p-4 mb-4">
                    <Text className="text-lg font-rubik-semibold mb-3">Quick Share Test</Text>
                    <Text className="text-gray-600 mb-4">
                        Test individual platform sharing (requires valid event ID)
                    </Text>

                    <View className="flex-row flex-wrap gap-3">
                        <QuickShareButton
                            eventId={eventId}
                            platform="whatsapp"
                            size="medium"
                        />
                        <QuickShareButton
                            eventId={eventId}
                            platform="messenger"
                            size="medium"
                        />
                        <QuickShareButton
                            eventId={eventId}
                            platform="instagram"
                            size="medium"
                        />
                        <QuickShareButton
                            eventId={eventId}
                            platform="general"
                            size="medium"
                        />
                    </View>
                </View>

                {/* Full Share Modal Test */}
                <View className="bg-white rounded-xl p-4 mb-4">
                    <Text className="text-lg font-rubik-semibold mb-3">Full Share Modal</Text>
                    <TouchableOpacity
                        onPress={() => setShowShareModal(true)}
                        className="bg-purple-500 py-3 rounded-lg"
                    >
                        <Text className="text-white text-center font-rubik-semibold">
                            Open Share Modal
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Instructions */}
                <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <View className="flex-row items-start mb-2">
                        <MaterialIcons name="info" size={20} color="#F59E0B" />
                        <Text className="ml-2 font-rubik-semibold text-yellow-800">
                            Testing Instructions
                        </Text>
                    </View>
                    <Text className="text-yellow-700 text-sm">
                        1. Enter a valid event ID from your database{'\n'}
                        2. Generate test links to see the format{'\n'}
                        3. Test quick share buttons with real platforms{'\n'}
                        4. Use the full modal for complete testing{'\n'}
                        5. Test deep links on physical devices or emulators
                    </Text>
                </View>
            </ScrollView>

            {/* Share Modal */}
            <ShareInviteModal
                visible={showShareModal}
                onClose={() => setShowShareModal(false)}
                eventId={eventId}
            />
        </SafeAreaView>
    );
}
