import * as Linking from 'expo-linking';
import React from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { parseInviteLink } from '../lib/utils/invites';

export default function DeepLinkTester() {
    const testDeepLink = () => {
        const testUrl = 'up2://invite?eventId=test123&inviter=user456&type=event-invite';
        const parsed = parseInviteLink(testUrl);

        Alert.alert(
            'Deep Link Test',
            `Parsed: ${JSON.stringify(parsed, null, 2)}`,
            [
                { text: 'OK' },
                {
                    text: 'Test Link',
                    onPress: () => {
                        Linking.openURL(testUrl).catch(err => {
                            Alert.alert('Error', 'Could not open link: ' + err.message);
                        });
                    }
                }
            ]
        );
    };

    return (
        <View className="p-4">
            <TouchableOpacity
                onPress={testDeepLink}
                className="bg-blue-500 p-4 rounded-lg"
            >
                <Text className="text-white text-center font-bold">
                    Test Deep Link Parsing
                </Text>
            </TouchableOpacity>
        </View>
    );
}
