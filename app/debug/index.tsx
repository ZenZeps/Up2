import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Debug page for testing our database optimizations
 * Moved outside of (root) directory to avoid authentication context issues
 */
export default function DebugPage() {
    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Debug & Testing Page</Text>
                <Text style={styles.subtitle}>Database Optimization Test Suite</Text>
            </View>

            <View style={{ padding: 20, backgroundColor: '#ffe0e0', borderRadius: 8, marginVertical: 10 }}>
                <Text style={{ fontWeight: 'bold' }}>OptimizationTester Temporarily Disabled</Text>
                <Text style={{ marginTop: 5 }}>
                    The tester was causing React context nesting issues. It has been moved outside the (root) directory.
                </Text>
            </View>

            <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>How to Use the Debug Dashboard</Text>
                <Text style={styles.infoText}>
                    1. The Debug Dashboard is available in development mode only
                </Text>
                <Text style={styles.infoText}>
                    2. It appears as a small indicator at the bottom right of the screen
                </Text>
                <Text style={styles.infoText}>
                    3. Tap the indicator to expand the full dashboard
                </Text>
                <Text style={styles.infoText}>
                    4. Monitor database usage, cache hit rates, and performance metrics
                </Text>
                <Text style={styles.infoText}>
                    5. Use the "Reset Counters" and "Clear Cache" buttons to test different scenarios
                </Text>
            </View>

            <View style={styles.infoSection}>
                <Text style={styles.infoTitle}>Key Metrics to Monitor</Text>
                <Text style={styles.infoText}>
                    • <Text style={styles.bold}>Total DB Reads:</Text> Should increase slowly due to caching
                </Text>
                <Text style={styles.infoText}>
                    • <Text style={styles.bold}>Cache Hit Rate:</Text> Should be above 70% for optimal performance
                </Text>
                <Text style={styles.infoText}>
                    • <Text style={styles.bold}>Daily Usage:</Text> Should remain below warning thresholds
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        padding: 16,
    },
    header: {
        marginBottom: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 24,
    },
    infoSection: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 8,
    },
    bold: {
        fontWeight: '600',
    },
});
