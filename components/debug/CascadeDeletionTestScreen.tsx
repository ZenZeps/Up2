/**
 * 🧪 Cascade Deletion Test Screen
 * 
 * Use this component to test cascade deletion functionality
 * Place this in your app for easy testing
 */

import { testChatCascadeDeletion, testManualCascadeDeletion } from '@/lib/api/cascadeDelete';
import { useGlobalContext } from '@/lib/global-provider';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const CascadeDeletionTestScreen = () => {
  const { user } = useGlobalContext();

  const runEventCascadeTest = async () => {
    if (!user?.$id) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    Alert.alert(
      'Test Event Cascade Deletion',
      'This will create test event, attendance, chat, and messages then delete the event to verify cascade deletion works. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Test',
          onPress: async () => {
            try {
              console.log('🧪 Starting event cascade deletion test...');
              const result = await testManualCascadeDeletion(user.$id);

              Alert.alert(
                result.success ? 'Event Test Passed! 🎉' : 'Event Test Failed ❌',
                result.message
              );
            } catch (error) {
              console.error('Test error:', error);
              Alert.alert('Test Error', 'Failed to run test: ' + (error instanceof Error ? error.message : 'Unknown error'));
            }
          }
        }
      ]
    );
  };

  const runChatCascadeTest = async () => {
    if (!user?.$id) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    Alert.alert(
      'Test Chat Cascade Deletion',
      'This will create test chat and messages then delete the chat to verify cascade deletion works. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Test',
          onPress: async () => {
            try {
              console.log('🧪 Starting chat cascade deletion test...');
              const result = await testChatCascadeDeletion(user.$id);

              Alert.alert(
                result.success ? 'Chat Test Passed! 🎉' : 'Chat Test Failed ❌',
                result.message
              );
            } catch (error) {
              console.error('Test error:', error);
              Alert.alert('Test Error', 'Failed to run test: ' + (error instanceof Error ? error.message : 'Unknown error'));
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cascade Deletion Test</Text>

      <Text style={styles.description}>
        Choose a test to run:
      </Text>

      <TouchableOpacity
        style={styles.testButton}
        onPress={runEventCascadeTest}
      >
        <Text style={styles.buttonText}>🎯 Test Event Cascade</Text>
      </TouchableOpacity>

      <Text style={styles.testDescription}>
        Creates event → attendance → chat → messages, then deletes event and verifies all related data is removed.
      </Text>

      <TouchableOpacity
        style={[styles.testButton, styles.chatTestButton]}
        onPress={runChatCascadeTest}
      >
        <Text style={styles.buttonText}>💬 Test Chat Cascade</Text>
      </TouchableOpacity>

      <Text style={styles.testDescription}>
        Creates chat → messages, then deletes chat and verifies all messages are removed.
      </Text>

      <Text style={styles.note}>
        Check the console logs for detailed test output.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    lineHeight: 24,
  },
  testButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  chatTestButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  testDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
    textAlign: 'center',
  },
  note: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});