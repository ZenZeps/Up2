import { config } from '@/lib/appwrite/appwrite';
import { useTheme } from '@/lib/context/ThemeContext';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

// Small debug screen to inspect runtime Appwrite config values.
// Visibility: only in development (__DEV__) or when EXPO_PUBLIC_SHOW_CONFIG_SCREEN is set to '1'.

export default function DebugConfig() {
    const { colors } = useTheme();
    const allowed = __DEV__ || process.env.EXPO_PUBLIC_SHOW_CONFIG_SCREEN === '1';

    if (!allowed) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.text }}>DebugConfig is disabled. Set EXPO_PUBLIC_SHOW_CONFIG_SCREEN=1 or run in dev mode.</Text>
            </View>
        );
    }

    const safeConfig = {
        endpoint: config.endpoint,
        projectID: config.projectID,
        databaseID: config.databaseID,
        usersCollectionID: config.usersCollectionID,
        eventsCollectionID: config.eventsCollectionID,
        userFriendshipsCollectionID: config.userFriendshipsCollectionID,
        eventAttendancesCollectionID: config.eventAttendancesCollectionID,
        groupMembershipsCollectionID: config.groupMembershipsCollectionID,
        profilePhotosBucketID: config.profilePhotosBucketID,
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
            <Text style={[styles.title, { color: colors.text }]}>Runtime Appwrite Config</Text>
            <Text style={[styles.note, { color: colors.textSecondary }]}>Only non-sensitive identifiers are shown.</Text>
            <View style={styles.section}>
                {Object.entries(safeConfig).map(([k, v]) => (
                    <View key={k} style={styles.row}>
                        <Text style={[styles.key, { color: colors.text }]}>{k}</Text>
                        <Text selectable style={[styles.value, { color: colors.textSecondary }]}>{String(v)}</Text>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    note: {
        fontSize: 12,
        marginBottom: 12,
    },
    section: {
        marginTop: 8,
    },
    row: {
        marginBottom: 12,
    },
    key: {
        fontSize: 13,
        fontWeight: '700',
    },
    value: {
        fontSize: 13,
        marginTop: 4,
    }
});
