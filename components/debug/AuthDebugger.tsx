import { account } from '@/lib/appwrite/appwrite';
import React, { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

export const AuthDebugger = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');

    const testConnection = async () => {
        setLoading(true);
        setResult('Testing connection...\n');

        try {
            // Test 1: Clear any existing sessions
            try {
                const sessions = await account.listSessions();
                if (sessions.sessions.length > 0) {
                    setResult(prev => prev + `Found ${sessions.sessions.length} existing sessions, clearing...\n`);
                    for (const session of sessions.sessions) {
                        await account.deleteSession(session.$id);
                    }
                    setResult(prev => prev + 'Cleared existing sessions\n');
                } else {
                    setResult(prev => prev + 'No existing sessions found\n');
                }
            } catch (error) {
                setResult(prev => prev + 'Could not check sessions (this is normal for guest users)\n');
            }

            // Test 2: Try to login
            if (email && password) {
                setResult(prev => prev + `Attempting login for ${email.substring(0, 3)}****\n`);

                const session = await account.createEmailPasswordSession(email, password);
                setResult(prev => prev + `✅ Login successful! Session ID: ${session.$id}\n`);

                // Test 3: Get user info
                const user = await account.get();
                setResult(prev => prev + `User ID: ${user.$id}\n`);
                setResult(prev => prev + `Email: ${user.email}\n`);
                setResult(prev => prev + `Email Verified: ${user.emailVerification}\n`);
                setResult(prev => prev + `Name: ${user.name}\n`);
            } else {
                setResult(prev => prev + 'Please enter email and password to test login\n');
            }

        } catch (error: any) {
            setResult(prev => prev + `❌ Error: ${error.message}\n`);
            setResult(prev => prev + `Error Type: ${error.type || 'Unknown'}\n`);
            setResult(prev => prev + `Error Code: ${error.code || 'Unknown'}\n`);

            if (error.response) {
                try {
                    const responseData = JSON.parse(error.response);
                    setResult(prev => prev + `Response: ${JSON.stringify(responseData, null, 2)}\n`);
                } catch (e) {
                    setResult(prev => prev + `Raw Response: ${error.response}\n`);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const clearSessions = async () => {
        setLoading(true);
        try {
            const sessions = await account.listSessions();
            for (const session of sessions.sessions) {
                await account.deleteSession(session.$id);
            }
            Alert.alert('Success', 'All sessions cleared');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ padding: 20, backgroundColor: 'white', flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
                Authentication Debugger
            </Text>

            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                style={{
                    borderWidth: 1,
                    borderColor: '#ccc',
                    padding: 10,
                    marginBottom: 10,
                    borderRadius: 5
                }}
                autoCapitalize="none"
                keyboardType="email-address"
            />

            <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={{
                    borderWidth: 1,
                    borderColor: '#ccc',
                    padding: 10,
                    marginBottom: 20,
                    borderRadius: 5
                }}
            />

            <TouchableOpacity
                onPress={testConnection}
                disabled={loading}
                style={{
                    backgroundColor: loading ? '#ccc' : '#007AFF',
                    padding: 15,
                    borderRadius: 5,
                    marginBottom: 10,
                }}
            >
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                    {loading ? 'Testing...' : 'Test Authentication'}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={clearSessions}
                disabled={loading}
                style={{
                    backgroundColor: loading ? '#ccc' : '#FF3B30',
                    padding: 15,
                    borderRadius: 5,
                    marginBottom: 20,
                }}
            >
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                    Clear All Sessions
                </Text>
            </TouchableOpacity>

            <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Debug Output:</Text>
            <Text style={{
                fontFamily: 'monospace',
                fontSize: 12,
                backgroundColor: '#f5f5f5',
                padding: 10,
                borderRadius: 5,
                maxHeight: 300
            }}>
                {result || 'No output yet...'}
            </Text>
        </View>
    );
};
