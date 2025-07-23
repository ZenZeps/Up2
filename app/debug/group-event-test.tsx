import { createEvent } from '@/lib/api/event';
import { addEventToGroup, createGroup, getAllGroups, getGroupEvents } from '@/lib/api/group';
import { useGlobalContext } from '@/lib/global-provider';
import { Event } from '@/lib/types/Events';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function GroupEventTest() {
    const { user } = useGlobalContext();
    const [testResults, setTestResults] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const addTestResult = (result: string) => {
        setTestResults(prev => [...prev, result]);
        console.log(result); // Also log to console for easier debugging
    };

    const createTestGroup = async () => {
        if (!user) {
            Alert.alert('Error', 'Please sign in first');
            return;
        }

        setLoading(true);
        setTestResults([]);

        try {
            addTestResult('🏗️ Creating test group...');

            const testGroup = await createGroup(
                `Test Group ${new Date().getTime()}`,
                user.$id,
                []
            );

            if (testGroup) {
                addTestResult(`✅ Created group: "${testGroup.title}" (ID: ${testGroup.$id})`);
            } else {
                addTestResult('❌ Failed to create group - no group returned');
            }

        } catch (error) {
            addTestResult(`❌ Failed to create group: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.error('Create group error:', error);
        } finally {
            setLoading(false);
        }
    };

    const runBasicTest = async () => {
        if (!user) {
            Alert.alert('Error', 'Please sign in first');
            return;
        }

        setLoading(true);
        setTestResults([]);

        try {
            addTestResult('🧪 Starting Basic Database Test');

            // Test 1: Check database connectivity
            addTestResult('📋 Test 1: Checking database connectivity...');
            try {
                const groups = await getAllGroups();
                addTestResult(`✅ Database connected - Found ${groups.length} total groups`);
            } catch (error) {
                addTestResult(`❌ Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                return;
            }

            // Test 2: Create a test event (without group association)
            addTestResult('📋 Test 2: Creating standalone test event...');
            try {
                const testEventData = {
                    title: `Standalone Test Event ${new Date().getTime()}`,
                    location: 'Test Location',
                    startTime: new Date().toISOString(),
                    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                    creatorId: user.$id,
                    inviteeIds: [],
                    attendees: [],
                    description: 'Standalone test event',
                    tags: ['test'],
                    isPrivate: false,
                } as Omit<Event, '$id'>;

                const createdEvent = await createEvent(testEventData as Event);
                addTestResult(`✅ Created standalone event: "${createdEvent.title}" (ID: ${createdEvent.$id})`);
            } catch (error) {
                addTestResult(`❌ Failed to create standalone event: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }

            addTestResult('✅ Basic tests completed');

        } catch (error) {
            addTestResult(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.error('Basic test error:', error);
        } finally {
            setLoading(false);
        }
    };

    const runGroupEventTest = async () => {
        if (!user) {
            Alert.alert('Error', 'Please sign in first');
            return;
        }

        setLoading(true);
        setTestResults([]);

        try {
            addTestResult('🧪 Starting Group-Event Association Test');

            // Step 1: Get all groups
            addTestResult('📋 Step 1: Fetching all groups...');
            const groups = await getAllGroups();
            addTestResult(`✅ Found ${groups.length} groups`);

            if (groups.length === 0) {
                addTestResult('⚠️ No groups found. Creating a test group first...');

                const newGroup = await createGroup(
                    `Test Group ${new Date().getTime()}`,
                    user.$id,
                    []
                );

                if (newGroup) {
                    addTestResult(`✅ Created new group: "${newGroup.title}" (ID: ${newGroup.$id})`);
                    groups.push(newGroup);
                } else {
                    addTestResult('❌ Failed to create new group');
                    return;
                }
            }

            // Use the first group for testing
            const testGroup = groups[0];
            addTestResult(`🎯 Using group: "${testGroup.title}" (ID: ${testGroup.$id})`);

            // Step 2: Create a test event
            addTestResult('📋 Step 2: Creating test event...');
            const testEventData = {
                title: `Group Test Event ${new Date().getTime()}`,
                location: 'Test Location',
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                creatorId: user.$id,
                inviteeIds: [],
                attendees: [],
                description: 'Test event for group association',
                tags: ['test', 'group'],
                isPrivate: false,
            } as Omit<Event, '$id'>;

            const createdEvent = await createEvent(testEventData as Event);
            addTestResult(`✅ Created event: "${createdEvent.title}" (ID: ${createdEvent.$id})`);

            // Step 3: Associate event with group
            addTestResult('📋 Step 3: Associating event with group...');
            const associationSuccess = await addEventToGroup(testGroup.$id, createdEvent.$id);

            if (associationSuccess) {
                addTestResult('✅ Successfully associated event with group');
            } else {
                addTestResult('❌ Failed to associate event with group');
                return;
            }

            // Step 4: Verify the association by fetching group events
            addTestResult('📋 Step 4: Verifying association by fetching group events...');
            const groupEvents = await getGroupEvents(testGroup.$id);

            const eventFound = groupEvents.some(event => event.$id === createdEvent.$id);

            if (eventFound) {
                addTestResult('✅ Event found in group events - Association successful!');
                addTestResult(`📊 Group now has ${groupEvents.length} total events`);
            } else {
                addTestResult('❌ Event not found in group events - Association failed');
                addTestResult(`📊 Group events returned: ${groupEvents.length} events`);
                addTestResult(`🔍 Looking for event ID: ${createdEvent.$id}`);
                addTestResult(`🔍 Found event IDs: ${groupEvents.map(e => e.$id).join(', ')}`);
            }

            // Step 5: Show summary
            addTestResult('📋 Step 5: Test Summary');
            addTestResult(`✅ Test completed - Group-Event association is ${eventFound ? 'WORKING' : 'NOT WORKING'}`);

        } catch (error) {
            addTestResult(`❌ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.error('Group-Event test error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={{ flex: 1, padding: 20, backgroundColor: 'white' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
                Group-Event Database Tests
            </Text>

            <View style={{ gap: 10, marginBottom: 20 }}>
                <TouchableOpacity
                    onPress={runBasicTest}
                    disabled={loading}
                    style={{
                        backgroundColor: loading ? '#ccc' : '#28a745',
                        padding: 15,
                        borderRadius: 8,
                    }}
                >
                    <Text style={{ color: 'white', textAlign: 'center', fontSize: 16 }}>
                        {loading ? 'Running Test...' : '🔍 Run Basic Database Test'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={createTestGroup}
                    disabled={loading}
                    style={{
                        backgroundColor: loading ? '#ccc' : '#ffc107',
                        padding: 15,
                        borderRadius: 8,
                    }}
                >
                    <Text style={{ color: 'black', textAlign: 'center', fontSize: 16 }}>
                        {loading ? 'Creating...' : '🏗️ Create Test Group'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={runGroupEventTest}
                    disabled={loading}
                    style={{
                        backgroundColor: loading ? '#ccc' : '#007AFF',
                        padding: 15,
                        borderRadius: 8,
                    }}
                >
                    <Text style={{ color: 'white', textAlign: 'center', fontSize: 16 }}>
                        {loading ? 'Running Test...' : '🧪 Run Group-Event Association Test'}
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#f5f5f5', padding: 15, borderRadius: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
                    Test Results:
                </Text>
                {testResults.length === 0 ? (
                    <Text style={{ color: '#666' }}>No test results yet. Click a test button to start.</Text>
                ) : (
                    testResults.map((result, index) => (
                        <Text key={index} style={{ fontSize: 14, marginBottom: 5, fontFamily: 'monospace' }}>
                            {result}
                        </Text>
                    ))
                )}
            </View>

            {user && (
                <View style={{ marginTop: 20, padding: 15, backgroundColor: '#e8f4fd', borderRadius: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Current User:</Text>
                    <Text>ID: {user.$id}</Text>
                    <Text>Email: {user.email}</Text>
                </View>
            )}
        </ScrollView>
    );
}
