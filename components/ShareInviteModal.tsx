import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    getEventInviteData,
    InviteData,
    logInviteSent,
    shareEventInvite,
    shareToInstagram,
    shareToMessenger,
    shareToWhatsApp
} from '../lib/utils/invites';

interface ShareInviteModalProps {
    visible: boolean;
    onClose: () => void;
    eventId: string;
}

interface ShareOption {
    id: string;
    name: string;
    icon: string;
    color: string;
    action: (inviteData: InviteData) => Promise<boolean>;
}

export default function ShareInviteModal({ visible, onClose, eventId }: ShareInviteModalProps) {
    const [loading, setLoading] = useState(false);
    const [inviteData, setInviteData] = useState<InviteData | null>(null); const shareOptions: ShareOption[] = [
        {
            id: 'whatsapp',
            name: 'WhatsApp',
            icon: 'message',
            color: '#25D366',
            action: shareToWhatsApp
        },
        {
            id: 'messenger',
            name: 'Messenger',
            icon: 'chat-bubble',
            color: '#0084FF',
            action: shareToMessenger
        },
        {
            id: 'instagram',
            name: 'Instagram',
            icon: 'photo-camera',
            color: '#E4405F',
            action: shareToInstagram
        },
        {
            id: 'general',
            name: 'More Options',
            icon: 'share',
            color: '#666666',
            action: shareEventInvite
        }
    ];

    React.useEffect(() => {
        if (visible && eventId) {
            loadInviteData();
        }
    }, [visible, eventId]);

    const loadInviteData = async () => {
        try {
            setLoading(true);
            const data = await getEventInviteData(eventId);
            setInviteData(data);
        } catch (error) {
            console.error('Error loading invite data:', error);
            Alert.alert('Error', 'Failed to load event details for sharing.');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async (option: ShareOption) => {
        if (!inviteData) {
            Alert.alert('Error', 'Event data not available for sharing.');
            return;
        }

        try {
            setLoading(true);
            const success = await option.action(inviteData);

            if (success) {
                // Log the invite send event
                await logInviteSent(
                    eventId,
                    inviteData.inviterUserId,
                    option.id as 'whatsapp' | 'instagram' | 'messenger' | 'general'
                );

                // Platform-specific success messages
                let successMessage = '';
                if (option.id === 'instagram') {
                    successMessage = `Your event invite is ready to share! Your device's sharing options will include Instagram if you have it installed.`;
                } else if (option.id === 'messenger') {
                    successMessage = `Your event invite is ready to share! Your device's sharing options will include Messenger if you have it installed.`;
                } else if (option.id === 'whatsapp') {
                    successMessage = `Your event invite has been shared via WhatsApp! Friends will be able to view the event details and join even if they don't have the Up2 app yet.`;
                } else {
                    successMessage = `Your event invite has been shared! Friends will be able to view the event details and join even if they don't have the Up2 app yet.`;
                }

                Alert.alert('Invite Ready!', successMessage);
                onClose();
            } else {
                Alert.alert('Sharing Failed', `Unable to share via ${option.name}. Please try another option.`);
            }
        } catch (error) {
            console.error(`Error sharing via ${option.name}:`, error);
            Alert.alert('Error', `Failed to share via ${option.name}. Please try again.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Black Header matching your app style */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>
                            Share Event Invite
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeButton}
                            disabled={loading}
                        >
                            <MaterialIcons name="close" size={24} color="#ffffff" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#0061FF" />
                                <Text style={styles.loadingText}>
                                    Loading event details...
                                </Text>
                            </View>
                        ) : inviteData ? (
                            <>
                                {/* Event Preview Card */}
                                <View style={styles.eventCard}>
                                    <Text style={styles.eventTitle}>
                                        {inviteData.eventTitle}
                                    </Text>
                                    <View style={styles.eventDetail}>
                                        <Text style={styles.eventDetailText}>
                                            📅 {inviteData.eventDate}
                                        </Text>
                                    </View>
                                    <View style={styles.eventDetail}>
                                        <Text style={styles.eventDetailText}>
                                            📍 {inviteData.eventLocation}
                                        </Text>
                                    </View>
                                </View>

                                {/* Share Options Title */}
                                <Text style={styles.shareTitle}>
                                    Choose how to share your invite:
                                </Text>

                                {/* Share Options */}
                                <View style={styles.shareOptionsContainer}>
                                    {shareOptions.map((option) => (
                                        <TouchableOpacity
                                            key={option.id}
                                            onPress={() => handleShare(option)}
                                            disabled={loading}
                                            style={styles.shareOption}
                                            activeOpacity={0.7}
                                        >
                                            <View
                                                style={[
                                                    styles.shareIconContainer,
                                                    { backgroundColor: option.color + '20' }
                                                ]}
                                            >
                                                <MaterialIcons
                                                    name={option.icon as any}
                                                    size={24}
                                                    color={option.color}
                                                />
                                            </View>
                                            <View style={styles.shareOptionContent}>
                                                <Text style={styles.shareOptionTitle}>
                                                    {option.name}
                                                </Text>
                                                <Text style={styles.shareOptionDescription}>
                                                    {option.id === 'whatsapp' && 'Share directly to WhatsApp chats'}
                                                    {option.id === 'messenger' && 'Share using your device\'s sharing options (includes Messenger)'}
                                                    {option.id === 'instagram' && 'Share using your device\'s sharing options (includes Instagram)'}
                                                    {option.id === 'general' && 'Use your device\'s sharing options'}
                                                </Text>
                                            </View>
                                            <MaterialIcons name="chevron-right" size={24} color="#CCCCCC" />
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Info Card */}
                                <View style={styles.infoCard}>
                                    <View style={styles.infoContent}>
                                        <MaterialIcons name="info" size={20} color="#0061FF" />
                                        <Text style={styles.infoText}>
                                            Friends will receive a link that works whether they have the Up2 app or not.
                                            New users will be prompted to download the app, while existing users will
                                            go directly to the event!
                                        </Text>
                                    </View>
                                </View>
                            </>
                        ) : (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>
                                    Failed to load event details
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

// StyleSheet matching your app's design patterns
const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '95%', // Increased from 90% to give more space
        minHeight: '50%', // Ensure minimum height for content visibility
    },
    header: {
        backgroundColor: '#000000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#333333',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
    },
    closeButton: {
        padding: 8,
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 40, // Increased bottom padding to prevent cutoff
        maxHeight: '100%', // Allow full height usage
    },
    scrollContent: {
        paddingBottom: 20, // Additional padding for scroll content
    },
    loadingContainer: {
        paddingVertical: 48,
        alignItems: 'center',
    },
    loadingText: {
        textAlign: 'center',
        color: '#6c757d',
        marginTop: 16,
        fontSize: 14,
    },
    eventCard: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    eventDetail: {
        marginBottom: 4,
    },
    eventDetailText: {
        fontSize: 14,
        color: '#6c757d',
        lineHeight: 20,
    },
    shareTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#343a40',
        marginBottom: 16,
    },
    shareOptionsContainer: {
        gap: 12,
    },
    shareOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    shareIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    shareOptionContent: {
        flex: 1,
    },
    shareOptionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    shareOptionDescription: {
        fontSize: 13,
        color: '#6c757d',
        lineHeight: 18,
    },
    infoCard: {
        marginTop: 24,
        padding: 16,
        backgroundColor: '#e8f4fd',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#bee5eb',
    },
    infoContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    infoText: {
        marginLeft: 8,
        color: '#0c5460',
        fontSize: 13,
        flex: 1,
        lineHeight: 18,
    },
    errorContainer: {
        paddingVertical: 48,
        alignItems: 'center',
    },
    errorText: {
        textAlign: 'center',
        color: '#dc3545',
        fontSize: 14,
    },
});
