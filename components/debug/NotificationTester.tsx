import { useGlobalContext } from '@/lib/global-provider';
import notificationService from '@/lib/notifications/notificationService';
import { NotificationTokenService } from '@/lib/notifications/notificationTokenService';
import { sendFriendRequestNotification } from '@/lib/notifications/notificationUtils';
import { notificationTokenManager } from '@/lib/notifications/tokenManager';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const NotificationTester = () => {
    const [testResults, setTestResults] = useState<string[]>([]);
    const { user } = useGlobalContext();

    const addResult = (result: string) => {
        setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
    };

    const testNotificationToken = async () => {
        try {
            const token = await notificationService.registerForPushNotifications();
            if (token && user?.$id) {
                try {
                    // Try production service first
                    await NotificationTokenService.registerToken(user.$id, token);
                    addResult(`✅ Got and stored token in production database: ${token.substring(0, 20)}...`);
                } catch (error) {
                    // Fallback to temporary storage
                    notificationTokenManager.setUserToken(user.$id, token, true);
                    addResult(`✅ Got token, stored temporarily (DB failed): ${token.substring(0, 20)}...`);
                }
            } else {
                addResult(`❌ Failed to get token or no user`);
            }
        } catch (error) {
            addResult(`❌ Failed to get token: ${error}`);
        }
    };

    const testTokenStorage = async () => {
        if (!user?.$id) {
            addResult('❌ No current user');
            return;
        }

        // Test temporary storage
        const tokenData = notificationTokenManager.getUserToken(user.$id);
        addResult(`📱 Temporary token: ${JSON.stringify({
            hasToken: !!tokenData?.token,
            enabled: tokenData?.enabled,
            tokenPrefix: tokenData?.token?.substring(0, 20) + '...'
        })}`);

        // Test production database
        try {
            const prodTokens = await NotificationTokenService.getUserTokens(user.$id);
            addResult(`🏢 Production tokens: ${prodTokens.length} found`);
            prodTokens.forEach((token, index) => {
                addResult(`  ${index + 1}. ${token.substring(0, 20)}...`);
            });
        } catch (error) {
            addResult(`❌ Production database error: ${error}`);
        }
    };

    const listAllTokens = () => {
        const allTokens = notificationTokenManager.getAllTokens();
        addResult(`📋 All stored tokens: ${allTokens.length} users`);
        allTokens.forEach((tokenInfo, index) => {
            addResult(`  ${index + 1}. ${tokenInfo.userId}: ${tokenInfo.token.substring(0, 20)}... (enabled: ${tokenInfo.enabled})`);
        });
    };

    const testSendNotification = async () => {
        if (!user?.$id) {
            addResult('❌ No current user');
            return;
        }

        try {
            // Send notification to self for testing
            await sendFriendRequestNotification(user.$id, 'Test Sender', 'test_sender_id');
            addResult('✅ Notification sent to self (check logs for details)');
        } catch (error) {
            addResult(`❌ Failed to send notification: ${error}`);
        }
    };

    const sendLocalTest = async () => {
        try {
            await notificationService.sendLocalNotification(
                'Test Notification',
                'This is a test notification to verify the system works'
            );
            addResult('✅ Local notification sent');
        } catch (error) {
            addResult(`❌ Failed to send local notification: ${error}`);
        }
    };

    const clearResults = () => {
        setTestResults([]);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Notification Debug Tool</Text>

            <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.button} onPress={testNotificationToken}>
                    <Text style={styles.buttonText}>Test Token Registration</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.button} onPress={testTokenStorage}>
                    <Text style={styles.buttonText}>Check Token Storage</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.button} onPress={listAllTokens}>
                    <Text style={styles.buttonText}>List All Tokens</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.button} onPress={sendLocalTest}>
                    <Text style={styles.buttonText}>Send Local Test</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.button} onPress={testSendNotification}>
                    <Text style={styles.buttonText}>Test Friend Request Notification</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={clearResults}>
                    <Text style={styles.buttonText}>Clear Results</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.resultsContainer}>
                <Text style={styles.resultsTitle}>Test Results:</Text>
                {testResults.map((result, index) => (
                    <Text key={index} style={styles.resultText}>{result}</Text>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: 'white',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    buttonContainer: {
        gap: 10,
        marginBottom: 20,
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    clearButton: {
        backgroundColor: '#FF3B30',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    resultsContainer: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 8,
        maxHeight: 300,
    },
    resultsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    resultText: {
        fontSize: 14,
        marginBottom: 5,
        fontFamily: 'monospace',
    },
});
