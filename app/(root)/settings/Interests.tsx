import { CATEGORIES } from '@/constants/categories';
import { getUserProfile, updateUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const InterestsSettings = () => {
    const router = useRouter();
    const { user, refetch } = useGlobalContext();
    const { colors } = useTheme();
    const userId = user?.$id;

    const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Load profile data
    useEffect(() => {
        const loadProfile = async () => {
            if (!userId) return;

            try {
                const profile = await getUserProfile(userId);
                if (profile) {
                    setSelectedEventTypes(profile.preferences || []);
                }
            } catch (err) {
                console.error('Error loading profile:', err);
            }
        };

        loadProfile();
    }, [userId]);

    const toggleEventType = (type: string) => {
        setSelectedEventTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    const handleSave = async () => {
        try {
            setIsLoading(true);

            if (!userId) return;

            // Get current profile to preserve other data
            const currentProfile = await getUserProfile(userId);

            await updateUserProfile({
                $id: userId,
                firstName: currentProfile?.firstName || '',
                lastName: currentProfile?.lastName || '',
                email: currentProfile?.email || user?.email || '',
                isPublic: currentProfile?.isPublic ?? true,
                preferences: selectedEventTypes,
                friends: currentProfile?.friends || [],
                photoId: currentProfile?.photoId,
            });

            await refetch();
            Alert.alert('Success', 'Interests updated successfully');
        } catch (err) {
            console.error('Error updating interests:', err);
            Alert.alert('Error', 'Failed to update interests');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Interests</Text>
                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleSave}
                    disabled={isLoading}
                >
                    <MaterialIcons
                        name={isLoading ? "hourglass-empty" : "check"}
                        size={18}
                        color={colors.buttonText}
                    />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* Interests Section */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="favorite" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Your Interests</Text>
                    </View>

                    <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                        Select your interests to see relevant events and connect with like-minded people
                    </Text>

                    <View style={styles.tagsContainer}>
                        {CATEGORIES.map((category) => {
                            const isSelected = selectedEventTypes.includes(category.value);
                            return (
                                <TouchableOpacity
                                    key={category.value}
                                    onPress={() => toggleEventType(category.value)}
                                    style={[
                                        styles.tag,
                                        {
                                            backgroundColor: isSelected ? colors.primary : colors.background,
                                            borderColor: isSelected ? colors.primary : colors.border,
                                        }
                                    ]}
                                >
                                    <Text style={styles.tagEmoji}>{category.emoji}</Text>
                                    <Text
                                        style={[
                                            styles.tagText,
                                            { color: isSelected ? 'white' : colors.text }
                                        ]}
                                    >
                                        {category.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Information Card */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="info" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>How Interests Work</Text>
                    </View>

                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        • Selected interests help us recommend relevant events to you
                    </Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        • You'll see more events that match your interests in the Explore tab
                    </Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        • Other users with similar interests may discover you easier
                    </Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        • You can change your interests anytime
                    </Text>
                </View>

                {/* Stats Card */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="analytics" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>Your Selection</Text>
                    </View>

                    <Text style={[styles.statsText, { color: colors.text }]}>
                        You have selected {selectedEventTypes.length} of {CATEGORIES.length} available interests
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 10,
    },
    saveButton: {
        padding: 8,
        borderRadius: 20,
    },
    scrollContainer: {
        flex: 1,
    },
    card: {
        margin: 16,
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 8,
    },
    cardDescription: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 8,
    },
    tagEmoji: {
        fontSize: 16,
        marginRight: 6,
    },
    tagText: {
        fontSize: 14,
        fontWeight: '500',
    },
    infoText: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8,
    },
    statsText: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
});

export default InterestsSettings;
