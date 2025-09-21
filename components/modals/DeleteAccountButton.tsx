/**
 * Delete Account Component
 * 
 * Provides UI for account deletion with confirmation dialogs and progress tracking.
 */

import { deleteAccount, DeleteAccountResult, getAccountDeletionPreview } from '@/lib/api/deleteAccount';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface DeleteAccountButtonProps {
    userId: string;
    onDeleteComplete?: () => void;
}

export const DeleteAccountButton: React.FC<DeleteAccountButtonProps> = ({
    userId,
    onDeleteComplete
}) => {
    const { colors } = useTheme();
    const router = useRouter();
    const { refetch } = useGlobalContext();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);

    const handleDeleteRequest = async () => {
        try {
            // First get preview of what will be deleted
            const preview = await getAccountDeletionPreview(userId);
            setPreviewData(preview);
            setShowPreviewModal(true);
        } catch (error) {
            Alert.alert('Error', 'Failed to load account deletion preview. Please try again.');
        }
    };

    const handleConfirmDelete = () => {
        setShowPreviewModal(false);

        Alert.alert(
            'Delete Account - Final Confirmation',
            '⚠️ THIS ACTION CANNOT BE UNDONE ⚠️\n\nAre you absolutely sure you want to permanently delete your account and all associated data?\n\nThis includes:\n• Your profile\n• All friendships\n• Group memberships\n• Event attendances\n• Messages\n• All other account data',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'DELETE FOREVER',
                    style: 'destructive',
                    onPress: performAccountDeletion
                }
            ]
        );
    };

    const performAccountDeletion = async () => {
        setIsDeleting(true);

        try {
            const result: DeleteAccountResult = await deleteAccount(userId);

            if (result.success) {
                Alert.alert(
                    'Account Deleted',
                    'Your account and all associated data have been successfully deleted.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                onDeleteComplete?.();
                                router.replace('/SignIn');
                            }
                        }
                    ]
                );
            } else {
                Alert.alert(
                    'Deletion Completed with Issues',
                    `${result.message}\n\nSome data may not have been fully deleted. Please contact support if needed.\n\nDeleted:\n• ${result.deletedCounts.friendships} friendships\n• ${result.deletedCounts.groupMemberships} group memberships\n• ${result.deletedCounts.eventAttendances} event attendances\n• ${result.deletedCounts.messages} messages\n• ${result.deletedCounts.chats} chats`,
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                onDeleteComplete?.();
                                router.replace('/SignIn');
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            Alert.alert(
                'Deletion Failed',
                `An error occurred while deleting your account: ${error}\n\nPlease try again or contact support.`
            );
        } finally {
            setIsDeleting(false);
        }
    };

    const PreviewModal = () => (
        <Modal
            visible={showPreviewModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowPreviewModal(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <View style={styles.modalHeader}>
                        <MaterialIcons name="warning" size={40} color="#FF3B30" />
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            Delete Account Confirmation
                        </Text>
                    </View>

                    <Text style={[styles.warningText, { color: colors.text }]}>
                        ⚠️ This action will permanently delete:
                    </Text>

                    <View style={styles.dataList}>
                        <DataItem
                            icon="people"
                            label="Friendships"
                            count={previewData?.friendshipsCount || 0}
                            color={colors.text}
                        />
                        <DataItem
                            icon="groups"
                            label="Group Memberships"
                            count={previewData?.groupMembershipsCount || 0}
                            color={colors.text}
                        />
                        <DataItem
                            icon="event"
                            label="Event Attendances"
                            count={previewData?.eventAttendancesCount || 0}
                            color={colors.text}
                        />
                        <DataItem
                            icon="message"
                            label="Messages"
                            count={previewData?.messagesCount || 0}
                            color={colors.text}
                        />
                        <DataItem
                            icon="chat"
                            label="Chat Conversations"
                            count={previewData?.chatsCount || 0}
                            color={colors.text}
                        />
                        <DataItem
                            icon="person"
                            label="Your Profile"
                            count={1}
                            color={colors.text}
                        />
                    </View>

                    <Text style={[styles.finalWarning, { color: '#FF3B30' }]}>
                        This action cannot be undone!
                    </Text>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.cancelButton, { borderColor: colors.text }]}
                            onPress={() => setShowPreviewModal(false)}
                        >
                            <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={handleConfirmDelete}
                        >
                            <Text style={styles.deleteButtonText}>DELETE FOREVER</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const DataItem = ({ icon, label, count, color }: { icon: string; label: string; count: number; color: string }) => (
        <View style={styles.dataItem}>
            <MaterialIcons name={icon as any} size={20} color={color} />
            <Text style={[styles.dataLabel, { color }]}>{label}</Text>
            <Text style={[styles.dataCount, { color }]}>({count})</Text>
        </View>
    );

    return (
        <>
            <TouchableOpacity
                style={styles.deleteAccountButton}
                onPress={handleDeleteRequest}
                disabled={isDeleting}
            >
                {isDeleting ? (
                    <ActivityIndicator color="white" size="small" />
                ) : (
                    <MaterialIcons name="delete-forever" size={20} color="white" />
                )}
                <Text style={styles.deleteAccountText}>
                    {isDeleting ? 'Deleting Account...' : 'Delete Account'}
                </Text>
            </TouchableOpacity>

            <PreviewModal />
        </>
    );
};

const styles = StyleSheet.create({
    deleteAccountButton: {
        backgroundColor: '#FF3B30',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 20,
        gap: 8
    },
    deleteAccountText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%'
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 20
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 10,
        textAlign: 'center'
    },
    warningText: {
        fontSize: 16,
        marginBottom: 16,
        textAlign: 'center',
        fontWeight: '500'
    },
    dataList: {
        marginBottom: 20
    },
    dataItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 12
    },
    dataLabel: {
        flex: 1,
        fontSize: 14
    },
    dataCount: {
        fontSize: 14,
        fontWeight: '500'
    },
    finalWarning: {
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 24
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12
    },
    cancelButton: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center'
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '500'
    },
    deleteButton: {
        flex: 1,
        backgroundColor: '#FF3B30',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center'
    },
    deleteButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    }
});
