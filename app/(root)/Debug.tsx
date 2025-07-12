import { ScrollView, StyleSheet, Text, View } from 'react-native';
// Import but don't use OptimizationTester until we fix the context nesting issue
// import OptimizationTester from './components/OptimizationTester';

/**
 * Debug page for testing our database optimizations
 */
export default function DebugPage() {
    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Debug & Testing Page</Text>
                <Text style={styles.subtitle}>Database Optimization Test Suite</Text>
            </View>

            {/* Temporarily disabled to fix context nesting issue */}
            {/* <OptimizationTester /> */}
            <View style={{ padding: 20, backgroundColor: '#ffe0e0', borderRadius: 8, marginVertical: 10 }}>
                <Text style={{ fontWeight: 'bold' }}>OptimizationTester Temporarily Disabled</Text>
                <Text style={{ marginTop: 5 }}>
                    The tester was causing React context nesting issues. It will be fixed in a future update.
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
        backgroundColor: '#f0f2f5',
    },
    header: {
        padding: 20,
        backgroundColor: '#4b7bec',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    infoSection: {
        margin: 20,
        padding: 15,
        backgroundColor: 'white',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#2d3436',
    },
    infoText: {
        fontSize: 14,
        color: '#636e72',
        marginBottom: 8,
        lineHeight: 20,
    },
    bold: {
        fontWeight: 'bold',
        color: '#2d3436',
    },
});
