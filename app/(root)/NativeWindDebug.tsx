import { useTheme } from '@/lib/context/ThemeContext';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NativeWindDebug() {
    const { colors } = useTheme();

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <ScrollView className="flex-1 p-4">
                <Text className="text-2xl font-rubik-semibold mb-6" style={{ color: colors.text }}>
                    NativeWind Debug Test
                </Text>

                {/* Test basic flex and spacing */}
                <View className="mb-6">
                    <Text className="text-lg font-rubik-medium mb-2" style={{ color: colors.text }}>
                        Flex & Spacing Test
                    </Text>
                    <View className="flex-row justify-between items-center p-4 rounded-lg border"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                        <View className="flex-1 mr-4">
                            <Text className="font-rubik" style={{ color: colors.text }}>Left Item</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="font-rubik text-right" style={{ color: colors.text }}>Right Item</Text>
                        </View>
                    </View>
                </View>

                {/* Test button styling */}
                <View className="mb-6">
                    <Text className="text-lg font-rubik-medium mb-2" style={{ color: colors.text }}>
                        Button Test
                    </Text>
                    <TouchableOpacity
                        className="bg-blue-500 px-4 py-3 rounded-lg items-center justify-center"
                    >
                        <Text className="text-white font-rubik-medium">NativeWind Button</Text>
                    </TouchableOpacity>
                </View>

                {/* Test margin and padding */}
                <View className="mb-6">
                    <Text className="text-lg font-rubik-medium mb-2" style={{ color: colors.text }}>
                        Margin & Padding Test
                    </Text>
                    <View className="p-4 m-2 bg-red-100 rounded-lg">
                        <View className="p-2 bg-green-100 rounded">
                            <Text className="text-gray-800 font-rubik">Nested padding test</Text>
                        </View>
                    </View>
                </View>

                {/* Test text colors and typography */}
                <View className="mb-6">
                    <Text className="text-lg font-rubik-medium mb-2" style={{ color: colors.text }}>
                        Typography Test
                    </Text>
                    <Text className="text-red-500 font-rubik-bold mb-1">Red Bold Text</Text>
                    <Text className="text-blue-500 font-rubik-medium mb-1">Blue Medium Text</Text>
                    <Text className="text-green-500 font-rubik-light mb-1">Green Light Text</Text>
                    <Text className="text-gray-500 font-rubik text-xs">Small Gray Text</Text>
                </View>

                {/* Test navigation bar simulation */}
                <View className="mb-6">
                    <Text className="text-lg font-rubik-medium mb-2" style={{ color: colors.text }}>
                        Navigation Bar Simulation
                    </Text>
                    <View
                        className="flex-row justify-between items-center px-4 py-3 rounded-lg"
                        style={{ backgroundColor: colors.tabBar }}
                    >
                        <TouchableOpacity className="flex-1 items-center py-2">
                            <View className="w-6 h-6 bg-white rounded-full mb-1" />
                            <Text className="text-white text-xs font-rubik">Home</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-1 items-center py-2">
                            <View className="w-6 h-6 bg-gray-400 rounded-full mb-1" />
                            <Text className="text-gray-400 text-xs font-rubik">Feed</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-1 items-center py-2">
                            <View className="w-6 h-6 bg-gray-400 rounded-full mb-1" />
                            <Text className="text-gray-400 text-xs font-rubik">Explore</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-1 items-center py-2">
                            <View className="w-6 h-6 bg-gray-400 rounded-full mb-1" />
                            <Text className="text-gray-400 text-xs font-rubik">Profile</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Results */}
                <View className="mt-8 p-4 rounded-lg border"
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                    <Text className="text-lg font-rubik-semibold mb-2" style={{ color: colors.text }}>
                        Test Results
                    </Text>
                    <Text className="font-rubik mb-1" style={{ color: colors.text }}>
                        ✅ If you can see proper spacing, colors, and layout above, NativeWind is working
                    </Text>
                    <Text className="font-rubik mb-1" style={{ color: colors.text }}>
                        ❌ If elements look unstyled or misaligned, there's a NativeWind configuration issue
                    </Text>
                    <Text className="font-rubik text-sm" style={{ color: colors.textSecondary }}>
                        Check the console for any CSS compilation errors
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
