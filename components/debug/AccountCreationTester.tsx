import { createUserProfile } from '@/lib/api/user';
import { config, databases } from '@/lib/appwrite/appwrite';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

/**
 * 🧪 ACCOUNT CREATION TESTER
 * Test the new user profile creation with the updated database schema
 */

const AccountCreationTester = () => {
    const [isCreating, setIsCreating] = useState(false);
    const [testUserId, setTestUserId] = useState('test-user-' + Date.now());
    const [firstName, setFirstName] = useState('Test');
    const [lastName, setLastName] = useState('User');
    const [email, setEmail] = useState('test@example.com');
    const [results, setResults] = useState<string[]>([]);

    const addResult = (message: string) => {
        setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const testUserCreation = async () => {
        setIsCreating(true);
        setResults([]);

        try {
            addResult('🧪 Testing user profile creation...');

            // Test creating a user profile with the new schema
            await createUserProfile({
                $id: testUserId,
                firstName: firstName,
                lastName: lastName,
                email: email,
                isPublic: true,
                preferences: ['test'],
                friends: [],
                age: 25,
                photoId: undefined,
            });

            addResult(`✅ User profile created successfully: ${testUserId}`);
            addResult(`   Name: ${firstName} ${lastName}`);
            addResult(`   Email: ${email}`);
            addResult(`   Account Status: active (default)`);

            // Verify the profile was created
            const profile = await databases.getDocument(
                config.databaseID!,
                config.usersCollectionID!,
                testUserId
            );

            addResult('✅ Profile verification successful');
            addResult(`   Document ID: ${profile.$id}`);
            addResult(`   Account Status: ${profile.accountStatus}`);
            addResult(`   Last Active: ${profile.lastActive}`);
            addResult(`   Friend Count: ${profile.friendCount}`);

        } catch (error: any) {
            addResult(`❌ User creation failed: ${error.message || error}`);

            if (error.message?.includes('Missing required attribute')) {
                addResult('💡 Fix: Make sure all required attributes are set in Appwrite collection');
            }

            if (error.message?.includes('already exists')) {
                addResult('💡 Note: User already exists, try a different ID');
            }
        } finally {
            setIsCreating(false);
        }
    };

    const testDatabaseConnection = async () => {
        setIsCreating(true);
        setResults([]);

        try {
            addResult('🔌 Testing database connection...');

            // Test basic database access
            const users = await databases.listDocuments(
                config.databaseID!,
                config.usersCollectionID!,
                []
            );

            addResult(`✅ Database connection successful`);
            addResult(`   Found ${users.documents.length} existing users`);
            addResult(`   Database ID: ${config.databaseID}`);
            addResult(`   Collection ID: ${config.usersCollectionID}`);

        } catch (error: any) {
            addResult(`❌ Database connection failed: ${error.message || error}`);

            if (error.message?.includes('collection_not_found')) {
                addResult('💡 Fix: Check collection ID in .env.local');
            }
        } finally {
            setIsCreating(false);
        }
    };

    const deleteTestUser = async () => {
        setIsCreating(true);
        addResult('🗑️ Deleting test user...');

        try {
            await databases.deleteDocument(
                config.databaseID!,
                config.usersCollectionID!,
                testUserId
            );
            addResult(`✅ Test user deleted: ${testUserId}`);
        } catch (error: any) {
            addResult(`❌ Delete failed: ${error.message || error}`);
        } finally {
            setIsCreating(false);
        }
    };

    const generateNewTestId = () => {
        setTestUserId('test-user-' + Date.now());
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🧪 Account Creation Tester</Text>

            <View style={styles.inputContainer}>
                <Text style={styles.label}>Test User ID:</Text>
                <TextInput
                    style={styles.input}
                    value={testUserId}
                    onChangeText={setTestUserId}
                    placeholder="test-user-id"
                />
                <TouchableOpacity style={styles.smallButton} onPress={generateNewTestId}>
                    <Text style={styles.smallButtonText}>Generate New</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.row}>
                <View style={styles.inputHalf}>
                    <Text style={styles.label}>First Name:</Text>
                    <TextInput
                        style={styles.input}
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="First name"
                    />
                </View>
                <View style={styles.inputHalf}>
                    <Text style={styles.label}>Last Name:</Text>
                    <TextInput
                        style={styles.input}
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder="Last name"
                    />
                </View>
            </View>

            <View style={styles.inputContainer}>
                <Text style={styles.label}>Email:</Text>
                <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="test@example.com"
                    keyboardType="email-address"
                />
            </View>

            <View style={styles.buttonRow}>
                <TouchableOpacity
                    style={[styles.button, styles.primaryButton]}
                    onPress={testDatabaseConnection}
                    disabled={isCreating}
                >
                    <Text style={styles.buttonText}>Test DB Connection</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.successButton]}
                    onPress={testUserCreation}
                    disabled={isCreating}
                >
                    <Text style={styles.buttonText}>Create Test User</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={[styles.button, styles.dangerButton]}
                onPress={deleteTestUser}
                disabled={isCreating}
            >
                <Text style={styles.buttonText}>Delete Test User</Text>
            </TouchableOpacity>

            <View style={styles.resultsContainer}>
                {results.map((result, index) => (
                    <Text key={index} style={styles.resultText}>{result}</Text>
                ))}

                {isCreating && (
                    <Text style={styles.loadingText}>⏳ Running test...</Text>
                )}

                {results.length === 0 && !isCreating && (
                    <Text style={styles.placeholderText}>
                        Test database connection and user creation
                    </Text>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#f8f9fa',
        padding: 16,
        margin: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
        color: '#495057',
    },
    inputContainer: {
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    inputHalf: {
        flex: 1,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
        color: '#6c757d',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 4,
        padding: 8,
        fontSize: 12,
        backgroundColor: 'white',
    },
    smallButton: {
        backgroundColor: '#6c757d',
        padding: 4,
        borderRadius: 4,
        alignItems: 'center',
        marginTop: 4,
    },
    smallButtonText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '600',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        gap: 8,
    },
    button: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButton: {
        backgroundColor: '#007bff',
    },
    successButton: {
        backgroundColor: '#28a745',
    },
    dangerButton: {
        backgroundColor: '#dc3545',
        marginBottom: 16,
    },
    buttonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    resultsContainer: {
        backgroundColor: '#212529',
        borderRadius: 6,
        padding: 12,
        minHeight: 150,
        maxHeight: 200,
    },
    resultText: {
        color: '#28a745',
        fontSize: 10,
        fontFamily: 'monospace',
        marginBottom: 2,
    },
    loadingText: {
        color: '#ffc107',
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 8,
    },
    placeholderText: {
        color: '#6c757d',
        fontSize: 12,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 20,
    },
});

export default AccountCreationTester;
