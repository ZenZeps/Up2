import { cacheManager } from '@/lib/debug/cacheManager';
import { dbUsageMonitor } from '@/lib/debug/dbUsageMonitor';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * A standalone debug dashboard component that can be displayed without
 * requiring the auth context or causing circular dependencies.
 * This is a simpler version that doesn't depend on the EventsContext.
 */
export default function StandaloneDebugDashboard() {
    const [expanded, setExpanded] = useState(false);
    const [stats, setStats] = useState({
        reads: 0,
        writes: 0,
        readPercentage: 0,
        cacheHitRate: 0,
        cacheSize: 0
    });

    // Update stats periodically when expanded
    useEffect(() => {
        if (!expanded) return;

        const updateStats = () => {
            try {
                const dbStats = dbUsageMonitor.getUsageStats();
                const cacheStats = cacheManager.getStats();

                setStats({
                    reads: dbStats.reads,
                    writes: dbStats.writes,
                    readPercentage: dbStats.readPercentage,
                    cacheHitRate: cacheStats.hitRate,
                    cacheSize: cacheStats.size
                });
            } catch (error) {
                console.error('Error updating debug stats:', error);
            }
        };

        // Update immediately
        updateStats();

        // Then update periodically
        const intervalId = setInterval(updateStats, 2000);

        return () => clearInterval(intervalId);
    }, [expanded]);

    const toggleExpanded = () => setExpanded(!expanded);

    const handleClearCache = () => {
        try {
            cacheManager.clear();
            setStats(prev => ({ ...prev, cacheSize: 0, cacheHitRate: 0 }));
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    };

    const handleResetCounters = () => {
        try {
            dbUsageMonitor.resetCounters();
            setStats(prev => ({ ...prev, reads: 0, writes: 0, readPercentage: 0 }));
        } catch (error) {
            console.error('Error resetting counters:', error);
        }
    };

    const navigateToDebugPage = () => {
        router.push('/debug');
    };

    if (!expanded) {
        // Collapsed state - just show indicator
        return (
            <TouchableOpacity
                style={styles.indicator}
                onPress={toggleExpanded}
                activeOpacity={0.8}
            >
                <Text style={styles.indicatorText}>D</Text>
            </TouchableOpacity>
        );
    }

    // Expanded state - show full dashboard
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Debug Dashboard</Text>
                <TouchableOpacity onPress={toggleExpanded}>
                    <Text style={styles.closeButton}>×</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statRow}>
                    <Text style={styles.statLabel}>DB Reads:</Text>
                    <Text style={styles.statValue}>{stats.reads}</Text>
                </View>
                <View style={styles.statRow}>
                    <Text style={styles.statLabel}>DB Writes:</Text>
                    <Text style={styles.statValue}>{stats.writes}</Text>
                </View>
                <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Read %:</Text>
                    <Text style={styles.statValue}>{stats.readPercentage.toFixed(1)}%</Text>
                </View>
                <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Cache Hit Rate:</Text>
                    <Text style={styles.statValue}>{stats.cacheHitRate.toFixed(1)}%</Text>
                </View>
                <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Cached Items:</Text>
                    <Text style={styles.statValue}>{stats.cacheSize}</Text>
                </View>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.button, styles.clearButton]}
                    onPress={handleClearCache}
                >
                    <Text style={styles.buttonText}>Clear Cache</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.button, styles.resetButton]}
                    onPress={handleResetCounters}
                >
                    <Text style={styles.buttonText}>Reset Counters</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.detailsButton}
                onPress={navigateToDebugPage}
            >
                <Text style={styles.detailsButtonText}>Open Debug Page</Text>
            </TouchableOpacity>
        </View>
    );
}

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 90,
        right: 10,
        width: width * 0.85,
        maxWidth: 350,
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderRadius: 12,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    indicator: {
        position: 'absolute',
        bottom: 90,
        right: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#0061FF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
        zIndex: 1000,
    },
    indicatorText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    title: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    statsContainer: {
        marginBottom: 15,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    statLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
    },
    statValue: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    button: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        flex: 1,
        marginHorizontal: 4,
        alignItems: 'center',
    },
    clearButton: {
        backgroundColor: '#FF6B6B',
    },
    resetButton: {
        backgroundColor: '#4ECDC4',
    },
    buttonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 13,
    },
    detailsButton: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingVertical: 8,
        borderRadius: 6,
        alignItems: 'center',
    },
    detailsButtonText: {
        color: 'white',
        fontSize: 13,
    }
});
