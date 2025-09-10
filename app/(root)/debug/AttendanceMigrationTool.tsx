import { migrateEventAttendanceMetadata } from '@/lib/utils/databaseMigration';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function AttendanceMigrationTool() {
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<string>('');

    const runMigration = async () => {
        setIsRunning(true);
        setResults('Starting event attendance metadata migration...\n');

        try {
            // Capture console logs
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;

            let logOutput = '';

            console.log = (...args) => {
                logOutput += args.join(' ') + '\n';
                originalLog(...args);
            };

            console.error = (...args) => {
                logOutput += 'ERROR: ' + args.join(' ') + '\n';
                originalError(...args);
            };

            console.warn = (...args) => {
                logOutput += 'WARN: ' + args.join(' ') + '\n';
                originalWarn(...args);
            };

            await migrateEventAttendanceMetadata();

            // Restore console
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;

            setResults(logOutput + '\n✅ Migration completed successfully!');

        } catch (error) {
            setResults(prev => prev + '\n❌ Migration failed: ' + String(error));
            console.error('Migration error:', error);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <View style={{ flex: 1, padding: 20, backgroundColor: '#f5f5f5' }}>
            <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
                    Event Attendance Migration Tool
                </Text>
                <Text style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
                    This tool will populate missing 'invitedBy' and 'respondedAt' fields in existing event attendance records.
                </Text>

                <TouchableOpacity
                    onPress={runMigration}
                    disabled={isRunning}
                    style={{
                        backgroundColor: isRunning ? '#ccc' : '#007AFF',
                        padding: 15,
                        borderRadius: 8,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                    }}
                >
                    {isRunning && <ActivityIndicator color="white" style={{ marginRight: 10 }} />}
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>
                        {isRunning ? 'Running Migration...' : 'Run Migration'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, backgroundColor: '#000', padding: 10, borderRadius: 8 }}>
                <Text style={{ color: '#00ff00', fontFamily: 'monospace', fontSize: 12 }}>
                    {results || 'Migration output will appear here...'}
                </Text>
            </ScrollView>
        </View>
    );
}
