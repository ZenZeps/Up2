import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ShareInviteModal from '../modals/ShareInviteModal';
import QuickShareButton from './QuickShareButton';

interface EventCardWithShareProps {
    event: {
        $id: string;
        title: string;
        location: string;
        startTime: string;
        // ... other event properties
    };
    onEventPress?: () => void;
    showQuickShare?: boolean;
    quickSharePlatform?: 'whatsapp' | 'instagram' | 'messenger' | 'general';
}

export default function EventCardWithShare({
    event,
    onEventPress,
    showQuickShare = false,
    quickSharePlatform = 'whatsapp'
}: EventCardWithShareProps) {
    const [showShareModal, setShowShareModal] = useState(false);

    // Format date for display
    const eventDate = new Date(event.startTime);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <View style={styles.cardContainer}>
            <TouchableOpacity
                onPress={onEventPress}
                style={styles.card}
                activeOpacity={0.7}
            >
                {/* Event Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.eventTitle} numberOfLines={2}>
                            {event.title}
                        </Text>
                    </View>

                    {/* Share Options */}
                    <View style={styles.shareContainer}>
                        {showQuickShare && (
                            <View style={styles.quickShareContainer}>
                                <QuickShareButton
                                    eventId={event.$id}
                                    platform={quickSharePlatform}
                                    size="small"
                                    style="minimal"
                                />
                            </View>
                        )}
                        <TouchableOpacity
                            onPress={() => setShowShareModal(true)}
                            style={styles.shareButton}
                            activeOpacity={0.7}
                        >
                            <MaterialIcons name="share" size={20} color="#0061FF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Event Details */}
                <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                        <View style={styles.iconContainer}>
                            <MaterialIcons name="schedule" size={16} color="#0061FF" />
                        </View>
                        <Text style={styles.detailText}>
                            {formattedDate}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={styles.iconContainer}>
                            <MaterialIcons name="location-on" size={16} color="#0061FF" />
                        </View>
                        <Text style={styles.detailText} numberOfLines={2}>
                            {event.location}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>

            {/* Share Modal */}
            <ShareInviteModal
                visible={showShareModal}
                onClose={() => setShowShareModal(false)}
                eventId={event.$id}
            />
        </View>
    );
}

// StyleSheet that matches your app's design patterns
const styles = StyleSheet.create({
    cardContainer: {
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e5e5e5',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    titleContainer: {
        flex: 1,
        marginRight: 12,
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a1a1a',
        lineHeight: 24,
    },
    shareContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    quickShareContainer: {
        marginRight: 8,
    },
    shareButton: {
        padding: 8,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    detailsContainer: {
        gap: 8,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 32,
        height: 32,
        backgroundColor: '#f0f8ff',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    detailText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6c757d',
        flex: 1,
    },
});

// Example usage component
export function ExampleEventList() {
    const sampleEvents = [
        {
            $id: 'event1',
            title: 'Weekend Beach Volleyball',
            location: 'Santa Monica Beach',
            startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        },
        {
            $id: 'event2',
            title: 'Coffee & Code Meetup',
            location: 'Downtown Coffee Shop',
            startTime: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        }
    ];

    return (
        <View style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
            {/* Black Header like your app */}
            <View style={headerStyles.header}>
                <View style={headerStyles.headerContent}>
                    <Text style={headerStyles.headerTitle}>Events with Sharing</Text>
                </View>
            </View>

            {sampleEvents.map((event) => (
                <EventCardWithShare
                    key={event.$id}
                    event={event}
                    onEventPress={() => console.log('Event pressed:', event.title)}
                    showQuickShare={true}
                    quickSharePlatform="whatsapp"
                />
            ))}
        </View>
    );
}

// Header styles matching your app's black header pattern
const headerStyles = StyleSheet.create({
    header: {
        backgroundColor: '#000000',
        borderBottomWidth: 1,
        borderBottomColor: '#333333',
        marginBottom: 16,
    },
    headerContent: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#ffffff',
    },
});
