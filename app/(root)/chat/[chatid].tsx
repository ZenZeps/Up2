import { getUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { userDisplayUtils } from '@/lib/utils/userDisplay';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Messages = () => {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { colors } = useTheme();
    const userId = Array.isArray(id) ? id[0] : id;
    const [userProfile, setUserProfile] = useState<any>(null);

    useEffect(() => {
        const loadUser = async () => {
            if (userId) {
                const profile = await getUserProfile(userId);
                setUserProfile(profile);
            }
        };
        loadUser();
    }, [userId]);

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-4 py-3 flex-row items-center justify-between border-b" style={{ borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text className="text-lg" style={{ color: colors.primary }}>← Back</Text>
                </TouchableOpacity>
                <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>
                    {userProfile ? userDisplayUtils.getFullName(userProfile) : 'Messages'}
                </Text>
                <View />
            </View>

            <View className="flex-1 items-center justify-center px-4">
                <Text className="text-xl font-rubik-semibold mb-4" style={{ color: colors.text }}>
                    💬 Messages
                </Text>
                <Text className="text-center text-gray-600 mb-6" style={{ color: colors.textSecondary }}>
                    {userProfile ?
                        `Conversation with ${userDisplayUtils.getFullName(userProfile)}` :
                        `Loading conversation with user: ${userId}`
                    }
                </Text>
                <Text className="text-center text-gray-500" style={{ color: colors.textSecondary }}>
                    This is where you'll implement the messaging functionality.
                </Text>

                {/* Debug info */}
                <View className="mt-8 p-4 bg-gray-100 rounded-lg">
                    <Text className="text-sm text-gray-600 mb-2">Debug Info:</Text>
                    <Text className="text-sm text-gray-600">User ID: {userId}</Text>
                    <Text className="text-sm text-gray-600">Profile loaded: {userProfile ? 'Yes' : 'No'}</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}; export default Messages;
