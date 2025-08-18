import { getPublicGroups, joinGroup, leaveGroup, searchPublicGroups } from '@/lib/api/group';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { Group } from '@/lib/types/Groups';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GroupsExplore = () => {
    const router = useRouter();
    const { colors } = useTheme();
    const { user } = useGlobalContext();
    const userId = user?.$id;

    const [groups, setGroups] = useState<Group[]>([]);
    const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [joinLoading, setJoinLoading] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        // Only load groups if user is authenticated
        if (user && userId) {
            loadPublicGroups();
        } else {
            console.log('GroupsExplore: Waiting for user authentication before loading groups');
        }
    }, [user, userId]);

    useEffect(() => {
        if (searchTerm.trim()) {
            handleSearch();
        } else {
            setFilteredGroups(groups);
        }
    }, [searchTerm, groups]);

    const loadPublicGroups = async () => {
        try {
            console.log('GroupsExplore: Starting to load public groups...');
            console.log('GroupsExplore: User authenticated:', !!user);
            console.log('GroupsExplore: User ID:', userId);

            setLoading(true);
            const publicGroups = await getPublicGroups();
            console.log('GroupsExplore: Loaded', publicGroups.length, 'public groups');

            setGroups(publicGroups);
            setFilteredGroups(publicGroups);
        } catch (error) {
            console.error('Error loading public groups:', error);
            console.error('Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                userId: userId,
                userAuthenticated: !!user
            });
            Alert.alert('Error', 'Failed to load groups. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            setFilteredGroups(groups);
            return;
        }

        try {
            console.log('GroupsExplore: Starting search for:', searchTerm);
            const searchResults = await searchPublicGroups(searchTerm.trim());
            console.log('GroupsExplore: Search returned', searchResults.length, 'results');
            setFilteredGroups(searchResults);
        } catch (error) {
            console.error('Error searching groups:', error);
            // Always fallback to local filtering for better user experience
            console.log('GroupsExplore: Falling back to local search');
            const localResults = groups.filter(group =>
                group.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            console.log('GroupsExplore: Local search found', localResults.length, 'results');
            setFilteredGroups(localResults);
        }
    };

    const handleJoinGroup = async (group: Group) => {
        if (!userId || !group.$id) return;

        setJoinLoading(prev => ({ ...prev, [group.$id]: true }));
        try {
            const success = await joinGroup(group.$id, userId);
            if (success) {
                Alert.alert('Success', `You have joined ${group.title}!`, [
                    {
                        text: 'View Group',
                        onPress: () => router.push(`/Group/${group.$id}`)
                    },
                    {
                        text: 'OK',
                        style: 'cancel'
                    }
                ]);
                // Refresh the groups to update membership status
                loadPublicGroups();
            } else {
                Alert.alert('Error', 'Failed to join group');
            }
        } catch (error) {
            console.error('Error joining group:', error);
            Alert.alert('Error', 'Failed to join group');
        } finally {
            setJoinLoading(prev => ({ ...prev, [group.$id]: false }));
        }
    };

    const handleLeaveGroup = async (group: Group) => {
        if (!userId || !group.$id) return;

        Alert.alert(
            'Leave Group',
            `Are you sure you want to leave ${group.title}?`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        setJoinLoading(prev => ({ ...prev, [group.$id]: true }));
                        try {
                            const success = await leaveGroup(group.$id, userId);
                            if (success) {
                                Alert.alert('Success', `You have left ${group.title}`);
                                loadPublicGroups();
                            } else {
                                Alert.alert('Error', 'Failed to leave group');
                            }
                        } catch (error) {
                            console.error('Error leaving group:', error);
                            Alert.alert('Error', 'Failed to leave group');
                        } finally {
                            setJoinLoading(prev => ({ ...prev, [group.$id]: false }));
                        }
                    }
                }
            ]
        );
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadPublicGroups();
        setRefreshing(false);
    };

    const isUserMember = (group: Group): boolean => {
        if (!userId || !group.users) return false;
        return group.users.some((memberId: any) => {
            if (typeof memberId === 'string') {
                return memberId === userId;
            } else if (memberId && typeof memberId === 'object' && memberId.$id) {
                return memberId.$id === userId;
            }
            return false;
        });
    };

    const renderGroupItem = ({ item: group }: { item: Group }) => {
        const isMember = isUserMember(group);
        const isCreator = group.creatorId === userId;
        const isJoinButtonLoading = joinLoading[group.$id] || false;

        return (
            <TouchableOpacity
                className="bg-white dark:bg-gray-800 p-4 rounded-lg mb-3 border"
                style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border
                }}
                onPress={() => router.push(`/Group/${group.$id}`)}
            >
                <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-1">
                        <Text className="text-lg font-rubik-semibold" style={{ color: colors.text }}>
                            {group.title}
                        </Text>
                        <Text className="text-sm font-rubik mt-1" style={{ color: colors.textSecondary }}>
                            {group.memberCount || 0} members
                        </Text>
                        {group.description && (
                            <Text className="text-sm font-rubik mt-1" style={{ color: colors.textSecondary }}>
                                {group.description}
                            </Text>
                        )}
                    </View>

                    <View className="ml-4">
                        {isMember ? (
                            isCreator ? (
                                <View className="bg-blue-500 px-3 py-1 rounded-lg">
                                    <Text className="text-white font-rubik-medium text-sm">Creator</Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => handleLeaveGroup(group)}
                                    disabled={isJoinButtonLoading}
                                    className="bg-red-500 px-3 py-1 rounded-lg"
                                >
                                    {isJoinButtonLoading ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <Text className="text-white font-rubik-medium text-sm">Leave</Text>
                                    )}
                                </TouchableOpacity>
                            )
                        ) : (
                            <TouchableOpacity
                                onPress={() => handleJoinGroup(group)}
                                disabled={isJoinButtonLoading}
                                className="bg-blue-500 px-3 py-1 rounded-lg"
                            >
                                {isJoinButtonLoading ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text className="text-white font-rubik-medium text-sm">Join</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            {/* Header */}
            <View className="px-4 py-4 border-b" style={{ borderBottomColor: colors.border }}>
                <View className="flex-row items-center justify-between mb-3">
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text className="text-blue-500 font-rubik-medium">← Back</Text>
                    </TouchableOpacity>
                    <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>
                        Explore Groups
                    </Text>
                    <TouchableOpacity onPress={() => router.push('/CreateGroup')}>
                        <Text className="text-blue-500 font-rubik-medium">Create</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Input */}
                <TextInput
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    placeholder="Search public groups..."
                    placeholderTextColor={colors.textSecondary}
                    className="p-3 rounded-lg border font-rubik"
                    style={{
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text
                    }}
                />
            </View>

            {/* Groups List */}
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text className="mt-4 font-rubik" style={{ color: colors.text }}>Loading groups...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredGroups}
                    keyExtractor={(item) => item.$id}
                    renderItem={renderGroupItem}
                    className="flex-1 px-4"
                    contentContainerStyle={{ paddingTop: 16, paddingBottom: 20 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View className="flex-1 justify-center items-center py-12">
                            <Text className="text-lg font-rubik-semibold mb-2" style={{ color: colors.text }}>
                                {searchTerm ? 'No groups found' : 'No public groups yet'}
                            </Text>
                            <Text className="text-center font-rubik mb-6" style={{ color: colors.textSecondary }}>
                                {searchTerm
                                    ? `No groups match "${searchTerm}"`
                                    : 'Be the first to create a public group!'
                                }
                            </Text>
                            {!searchTerm && (
                                <TouchableOpacity
                                    onPress={() => router.push('/CreateGroup')}
                                    className="bg-blue-500 px-6 py-3 rounded-lg"
                                >
                                    <Text className="text-white font-rubik-medium">Create Group</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

export default GroupsExplore;
