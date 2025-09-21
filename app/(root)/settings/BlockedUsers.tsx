import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BlockedUsersSettings = () => {
    const router = useRouter();
    const { user } = useGlobalContext();
    const { colors } = useTheme();
    const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Load blocked users
    useEffect(() => {
        const loadBlockedUsers = async () => {
            if (!user?.$id) return;

            try {
                setIsLoading(true);
                // TODO: Implement blocked users API call
                // const blocked = await getBlockedUsers(user.$id);
                // setBlockedUsers(blocked);
                setBlockedUsers([]); // Placeholder for now
            } catch (err) {
                console.error('Error loading blocked users:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadBlockedUsers();
    }, [user?.$id]);

    const handleUnblockUser = async (userId: string) => {
        Alert.alert(
            'Unblock User',
            'Are you sure you want to unblock this user?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unblock',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // TODO: Implement unblock user API call
                            // await unblockUser(user.$id, userId);
                            setBlockedUsers(prev => prev.filter(u => u.$id !== userId));
                            Alert.alert('Success', 'User unblocked successfully');
                        } catch (err) {
                            console.error('Error unblocking user:', err);
                            Alert.alert('Error', 'Failed to unblock user');
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => {
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace('/(root)/(tabs)/Profile');
                    }
                }}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Blocked Users</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <MaterialIcons name="hourglass-empty" size={24} color={colors.textSecondary} />
                        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                            Loading blocked users...
                        </Text>
                    </View>
                ) : blockedUsers.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="block" size={48} color={colors.textSecondary} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>
                            No Blocked Users
                        </Text>
                        <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
                            You haven't blocked any users yet. When you block someone, they won't be able to see your profile or send you messages.
                        </Text>
                    </View>
                ) : (
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.cardHeader}>
                            <MaterialIcons name="block" size={20} color={colors.primary} />
                            <Text style={[styles.cardTitle, { color: colors.text }]}>
                                Blocked Users ({blockedUsers.length})
                            </Text>
                        </View>

                        {blockedUsers.map((blockedUser, index) => (
                            <View
                                key={blockedUser.$id}
                                style={[
                                    styles.userItem,
                                    index !== blockedUsers.length - 1 && styles.userItemBorder,
                                    { borderBottomColor: colors.border }
                                ]}
                            >
                                <View style={styles.userInfo}>
                                    {blockedUser.photoUrl ? (
                                        <Image
                                            source={{ uri: blockedUser.photoUrl }}
                                            style={styles.userPhoto}
                                        />
                                    ) : (
                                        <View style={[styles.userPhotoPlaceholder, { backgroundColor: colors.primary }]}>
                                            <Text style={styles.userPhotoText}>
                                                {blockedUser.firstName?.[0]}{blockedUser.lastName?.[0]}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.userDetails}>
                                        <Text style={[styles.userName, { color: colors.text }]}>
                                            {blockedUser.firstName} {blockedUser.lastName}
                                        </Text>
                                        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                                            {blockedUser.email}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[styles.unblockButton, { borderColor: colors.primary }]}
                                    onPress={() => handleUnblockUser(blockedUser.$id)}
                                >
                                    <Text style={[styles.unblockButtonText, { color: colors.primary }]}>
                                        Unblock
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* Information Card */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="info" size={20} color={colors.primary} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>About Blocking</Text>
                    </View>

                    <View style={styles.infoList}>
                        <View style={styles.infoItem}>
                            <MaterialIcons name="visibility-off" size={16} color={colors.textSecondary} />
                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                Blocked users cannot see your profile or events
                            </Text>
                        </View>
                        <View style={styles.infoItem}>
                            <MaterialIcons name="message" size={16} color={colors.textSecondary} />
                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                They cannot send you messages or friend requests
                            </Text>
                        </View>
                        <View style={styles.infoItem}>
                            <MaterialIcons name="group" size={16} color={colors.textSecondary} />
                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                You won't see their content in your feeds
                            </Text>
                        </View>
                    </View>
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
        fontSize: 20,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 10,
    },
    headerSpacer: {
        width: 40,
    },
    scrollContainer: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 16,
        textAlign: 'center',
    },
    emptyDescription: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 24,
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
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    userItemBorder: {
        borderBottomWidth: 1,
        marginBottom: 12,
        paddingBottom: 20,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    userPhoto: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    userPhotoPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userPhotoText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    userDetails: {
        marginLeft: 12,
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '500',
    },
    userEmail: {
        fontSize: 14,
        marginTop: 2,
    },
    unblockButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderRadius: 6,
    },
    unblockButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    infoList: {
        gap: 12,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoText: {
        fontSize: 14,
        marginLeft: 8,
        lineHeight: 20,
    },
});

export default BlockedUsersSettings;
