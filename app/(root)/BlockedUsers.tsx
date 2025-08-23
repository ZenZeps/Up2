import { getUserProfile, getUsersByIds, updateUserProfile } from '@/lib/api/user';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BlockedUsers() {
    const { user, refetch } = useGlobalContext();
    const { colors } = useTheme();
    const userId = user?.$id;

    const [blockedIds, setBlockedIds] = useState<string[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            if (!userId) return;
            const profile = await getUserProfile(userId);
            const ids = profile?.blocked || [];
            setBlockedIds(ids || []);

            if (ids && ids.length > 0) {
                const pro = await getUsersByIds(ids);
                setProfiles(pro);
            } else {
                setProfiles([]);
            }
        };

        load();
    }, [userId]);

    const handleUnblock = async (targetId: string) => {
        if (!userId) return;
        try {
            const current = await getUserProfile(userId);
            const newBlocked = (current?.blocked || []).filter((id: string) => id !== targetId);
            await updateUserProfile({
                $id: userId,
                firstName: current?.firstName || '',
                lastName: current?.lastName || '',
                email: current?.email || '',
                isPublic: current?.isPublic ?? true,
                friends: current?.friends || [],
                preferences: current?.preferences || [],
                photoId: current?.photoId,
                blocked: newBlocked,
            } as any);
            Alert.alert('Unblocked', 'User has been unblocked');
            setBlockedIds(newBlocked);
            setProfiles(prev => prev.filter(p => p.$id !== targetId));
            refetch();
        } catch (err) {
            console.error('Failed to unblock user', err);
            Alert.alert('Error', 'Failed to unblock user');
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Blocked Users</Text>
            </View>

            <FlatList
                data={profiles}
                keyExtractor={(item) => item.$id}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        <Text style={{ color: colors.textSecondary }}>You haven't blocked anyone.</Text>
                    </View>
                )}
                renderItem={({ item }) => (
                    <View style={[styles.row, { borderBottomColor: colors.border }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.name, { color: colors.text }]}>{item.firstName} {item.lastName}</Text>
                            <Text style={{ color: colors.textSecondary }}>{item.email}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleUnblock(item.$id)} style={styles.unblockButton}>
                            <MaterialIcons name="person-add" size={18} color="white" />
                            <Text style={styles.unblockText}>Unblock</Text>
                        </TouchableOpacity>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 16 },
    title: { fontSize: 20, fontWeight: '700' },
    empty: { padding: 20, alignItems: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    name: { fontSize: 16, fontWeight: '600' },
    unblockButton: { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
    unblockText: { color: 'white', marginLeft: 8, fontWeight: '600' }
});
