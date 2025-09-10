import { getEventInvitees } from '@/lib/api/event';
import { getCurrentUser } from '@/lib/appwrite/appwrite';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useEvents } from '../context/EventContext';

export default function InviteDebugger() {
    const [debugInfo, setDebugInfo] = useState<string>('');
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const { events } = useEvents();

    useEffect(() => {
        const fetchUserId = async () => {
            const user = await getCurrentUser();
            setCurrentUserId(user?.$id || '');
        };
        fetchUserId();
    }, []);

    const runDiagnostic = async () => {
        let output = '🔍 EVENT INVITE DIAGNOSTIC\n\n';

        try {
            output += `Current User ID: ${currentUserId}\n`;
            output += `Total Events: ${events.length}\n\n`;

            let inviteCount = 0;
            let legacyInviteCount = 0;

            for (const event of events) {
                if (event.creatorId === currentUserId) continue;

                // Check junction table invites
                try {
                    const junctionInvites = await getEventInvitees(event.$id);
                    const isInvitedViaJunction = junctionInvites.includes(currentUserId);

                    if (isInvitedViaJunction) {
                        inviteCount++;
                        output += `✅ INVITED (Junction): ${event.title}\n`;
                    }
                } catch (err) {
                    output += `❌ Junction Error for ${event.title}: ${err}\n`;
                }

                // Check legacy invites
                if (Array.isArray((event as any).inviteeIds) && (event as any).inviteeIds.includes(currentUserId)) {
                    legacyInviteCount++;
                    output += `🔄 INVITED (Legacy): ${event.title}\n`;
                }
            }

            output += `\n📊 SUMMARY:\n`;
            output += `Junction Table Invites: ${inviteCount}\n`;
            output += `Legacy Field Invites: ${legacyInviteCount}\n`;

            if (inviteCount === 0 && legacyInviteCount === 0) {
                output += `\n❓ No invites found. This could mean:\n`;
                output += `1. You truly have no invites\n`;
                output += `2. Junction table is not configured\n`;
                output += `3. Invites are stored differently\n`;
            }

        } catch (error) {
            output += `\n💥 Error: ${error}`;
        }

        setDebugInfo(output);
    };

    return (
        <View style={{ flex: 1, padding: 20, backgroundColor: '#f5f5f5' }}>
            <TouchableOpacity
                onPress={runDiagnostic}
                style={{
                    backgroundColor: '#007AFF',
                    padding: 15,
                    borderRadius: 8,
                    marginBottom: 20,
                }}
            >
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                    Run Invite Diagnostic
                </Text>
            </TouchableOpacity>

            <ScrollView style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {debugInfo || 'Press the button above to run diagnostic'}
                </Text>
            </ScrollView>
        </View>
    );
}
