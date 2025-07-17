import { fetchEventById, fetchEvents, fetchUserEvents } from '@/lib/api/event';
import { useAppwrite } from '@/lib/appwrite/useAppwrite';
import { cacheManager } from '@/lib/debug/cacheManager';
import { dbUsageMonitor } from '@/lib/debug/dbUsageMonitor';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Test component to verify our optimization implementations
 * Only for development use
 */
export default function OptimizationTester() {
    // Test 1: Basic fetch with caching
    const { data: allEvents, loading: loadingEvents, refetch: refetchEvents } = useAppwrite({
        fn: fetchEvents,
        cacheKey: 'test-all-events',
        cacheTTL: 60000, // 1 minute cache
    });

    // Test 2: Parameterized fetch with caching
    const { data: eventDetails, loading: loadingEvent } = useAppwrite({
        fn: (params) => fetchEventById(params?.id || ''),
        params: { id: allEvents?.[0]?.$id || 'unknown' },
        dependencies: [allEvents?.[0]?.$id], // Only refetch when ID changes
    });

    // Test 3: User-specific fetch
    const { data: userEvents, loading: loadingUserEvents } = useAppwrite({
        fn: (params) => fetchUserEvents(params?.userId || ''),
        params: { userId: 'test-user-id' },
        skip: !allEvents, // Skip until allEvents is loaded
    });

    // Run test sequence
    useEffect(() => {
        async function runTests() {
            console.log("Starting optimization tests...");

            // Clear cache for clean test
            cacheManager.clear();
            console.log("Cache cleared");

            // Reset counters
            dbUsageMonitor.resetCounters();
            console.log("DB counters reset");

            // First fetch - should hit database
            await refetchEvents();
            console.log("First fetch completed");

            // Check DB reads
            const stats1 = dbUsageMonitor.getUsageStats();
            console.log("DB reads after first fetch:", stats1.reads);

            // Second fetch - should use cache
            await refetchEvents();
            console.log("Second fetch completed");

            // Check DB reads again - should be same as before if cache working
            const stats2 = dbUsageMonitor.getUsageStats();
            console.log("DB reads after second fetch:", stats2.reads);

            // Check cache stats
            const cacheStats = cacheManager.getStats();
            console.log("Cache stats:", cacheStats);
        }

        runTests();
    }, [refetchEvents]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Optimization Test Results</Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>All Events Test</Text>
                <Text>Status: {loadingEvents ? 'Loading...' : 'Complete'}</Text>
                <Text>Count: {allEvents?.length || 0} events</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Event Details Test</Text>
                <Text>Status: {loadingEvent ? 'Loading...' : 'Complete'}</Text>
                <Text>Title: {eventDetails?.title || 'N/A'}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>User Events Test</Text>
                <Text>Status: {loadingUserEvents ? 'Loading...' : 'Complete'}</Text>
                <Text>Count: {userEvents?.length || 0} events</Text>
            </View>

            <Text style={styles.note}>
                Check the console logs for detailed test results
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        margin: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    section: {
        marginBottom: 15,
        padding: 10,
        backgroundColor: 'white',
        borderRadius: 5,
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: 5,
    },
    note: {
        fontStyle: 'italic',
        marginTop: 20,
    },
});
