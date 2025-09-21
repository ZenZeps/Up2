import { getUserProfile } from '@/lib/api/user';
import { config, databases } from '@/lib/appwrite/appwrite';
import { getUserFriends } from '@/lib/api/friendship';
import { useGlobalContext } from '@/lib/global-provider';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * 🛠️ USER SYSTEM DIAGNOSTIC COMPONENT
 */
const UserSystemDiagnostic = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<string[]>([]);
    const { user } = useGlobalContext();

    const addResult = (message: string) => {
        setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const runDiagnostics = async () => {
        setIsRunning(true);
        setResults([]);

        try {
            addResult('🔍 Starting User System Diagnostics...');

            // Test 1: Configuration
            addResult('📋 Configuration Check:');
            addResult(`   Database ID: ${config.databaseID}`);
            addResult(`   Users Collection ID: ${config.usersCollectionID}`);
            addResult(`   User Friendships Collection ID: ${config.userFriendshipsCollectionID}`);
            addResult(`   Event Attendances Collection ID: ${config.eventAttendancesCollectionID}`);

            // Test 2: Basic database access
            addResult('🔌 Basic Database Access:');
            try {
                const users = await databases.listDocuments(
                    config.databaseID!,
                    config.usersCollectionID!,
                    []
                );
                addResult(`   ✅ Can access users collection - ${users.documents.length} users found`);

                if (users.documents.length > 0) {
                    const testUserId = user?.$id || users.documents[0].$id;
                    addResult(`\n🧪 Testing with user: ${testUserId}`);

                    // Test getUserProfile
                    const profile = await getUserProfile(testUserId);
                    addResult(`   Profile retrieval: ${profile ? '✅ Success' : '❌ Failed'}`);

                    if (profile) {
                        addResult(`   Profile data: ${profile.firstName} ${profile.lastName} (${profile.email})`);
                    }

                    // Test friends loading
                    const friends = await getUserFriends(testUserId);
                    addResult(`   Friends loading: ${friends.length >= 0 ? '✅ Success' : '❌ Failed'} (${friends.length} friends)`);
                }

            } catch (error: any) {
                addResult(`   ❌ Database access failed: ${error.message || error}`);
            }

            addResult('✅ Diagnostics completed!');

        } catch (error: any) {
            addResult(`💥 Diagnostic failed: ${error.message || error}`);
        } finally {
            setIsRunning(false);
        }
    };

    const testCurrentUser = async () => {
        if (!user?.$id) {
            Alert.alert('Error', 'No current user ID available');
            return;
        }

        setIsRunning(true);
        addResult(`🧪 Testing current user: ${user.$id}`);

        try {
            const profile = await getUserProfile(user.$id);
            if (profile) {
                addResult(`✅ Profile loaded: ${profile.firstName} ${profile.lastName}`);
                addResult(`   Email: ${profile.email}`);
                addResult(`   Friends: ${profile.friends?.length || 0}`);
                addResult(`   Account Status: ${profile.accountStatus || 'not set'}`);
            } else {
                addResult('❌ Failed to load current user profile');
            }
        } catch (error: any) {
            addResult(`❌ Error: ${error.message || error}`);
        } finally {
            setIsRunning(false);
        }
    };

    const testSearch = async () => {
        setIsRunning(true);
        addResult('🔍 Testing user search...');

        try {
            const { getUsersByName } = await import('@/lib/api/user');
            const results = await getUsersByName('test');
            addResult(`✅ Search returned ${results.length} results`);

            if (results.length > 0) {
                addResult(`   First result: ${results[0].firstName} ${results[0].lastName}`);
            }
        } catch (error: any) {
            addResult(`❌ Search error: ${error.message || error}`);
        } finally {
            setIsRunning(false);
        }
    };

    const testFriends = async () => {
        if (!user?.$id) {
            Alert.alert('Error', 'No current user ID available');
            return;
        }

        setIsRunning(true);
        addResult('👫 Testing friends system...');

        try {
            const friends = await getUserFriends(user.$id);
            addResult(`✅ Friends loaded: ${friends.length}`);

            if (friends.length > 0) {
                addResult(`   First friend ID: ${friends[0]}`);
            }
        } catch (error: any) {
            addResult(`❌ Friends error: ${error.message || error}`);
        } finally {
            setIsRunning(false);
        }
    };

    const clearResults = () => {
        setResults([]);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🛠️ User System Diagnostics</Text>

            <View style={styles.buttonRow}>
                <TouchableOpacity
                    style={[styles.button, styles.primaryButton]}
                    onPress={runDiagnostics}
                    disabled={isRunning}
                >
                    <Text style={styles.buttonText}>Run Full Diagnostic</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={testCurrentUser}
                    disabled={isRunning}
                >
                    <Text style={styles.buttonTextSecondary}>Test Current User</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.buttonRow}>
                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={testSearch}
                    disabled={isRunning}
                >
                    <Text style={styles.buttonTextSecondary}>Test Search</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={testFriends}
                    disabled={isRunning}
                >
                    <Text style={styles.buttonTextSecondary}>Test Friends</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={[styles.button, styles.clearButton]}
                onPress={clearResults}
            >
                <Text style={styles.buttonTextSecondary}>Clear Results</Text>
            </TouchableOpacity>

            <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={true}>
                {results.map((result, index) => (
                    <Text key={index} style={styles.resultText}>{result}</Text>
                ))}

                {isRunning && (
                    <Text style={styles.loadingText}>⏳ Running tests...</Text>
                )}

                {results.length === 0 && !isRunning && (
                    <Text style={styles.placeholderText}>
                        Tap "Run Full Diagnostic" to test the user system
                    </Text>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#f5f5f5',
        padding: 16,
        margin: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        minHeight: 300,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
        color: '#333',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        gap: 8,
    },
    button: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButton: {
        backgroundColor: '#007AFF',
    },
    secondaryButton: {
        backgroundColor: '#6C757D',
    },
    clearButton: {
        backgroundColor: '#DC3545',
        marginBottom: 16,
    },
    buttonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    buttonTextSecondary: {
        color: 'white',
        fontSize: 11,
        fontWeight: '600',
    },
    resultsContainer: {
        backgroundColor: '#000',
        borderRadius: 6,
        padding: 12,
        maxHeight: 200,
        flex: 1,
    },
    resultText: {
        color: '#00FF00',
        fontSize: 10,
        fontFamily: 'monospace',
        marginBottom: 2,
    },
    loadingText: {
        color: '#FFFF00',
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 8,
    },
    placeholderText: {
        color: '#888',
        fontSize: 12,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 20,
    },
});

export default UserSystemDiagnostic;
