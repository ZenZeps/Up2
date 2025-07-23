import { useTheme } from '@/lib/context/ThemeContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Messages = () => {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { colors } = useTheme();
    const userId = Array.isArray(id) ? id[0] : id;

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="px-4 py-3 flex-row items-center justify-between border-b" style={{ borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text className="text-lg" style={{ color: colors.primary }}>← Back</Text>
                </TouchableOpacity>
                <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>
                    Messages
                </Text>
                <View />
            </View>

            <View className="flex-1 items-center justify-center px-4">
                <Text className="text-xl font-rubik-semibold mb-4" style={{ color: colors.text }}>
                    Messages Feature
                </Text>
                <Text className="text-center text-gray-600 mb-6" style={{ color: colors.textSecondary }}>
                    This will be the messaging conversation with user: {userId}
                </Text>
                <Text className="text-center text-gray-500" style={{ color: colors.textSecondary }}>
                    Implementation coming soon...
                </Text>
            </View>
        </SafeAreaView>
    );
};

export default Messages;
