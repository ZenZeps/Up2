import {
    createEventMessage,
    createGroupMessage,
    deleteMessage,
    getEventMessages,
    getGroupMessages,
    updateMessage,
} from '@/lib/api/messages';
import { useTheme } from '@/lib/context/ThemeContext';
import { MessageWithAuthor } from '@/lib/types/Messages';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UserAvatar from '../components/UserAvatar';

dayjs.extend(relativeTime);

interface MessageModalProps {
    visible: boolean;
    onClose: () => void;
    eventId?: string;
    groupId?: string;
    title: string;
    currentUserId: string;
}

export default function MessageModal({
    visible,
    onClose,
    eventId,
    groupId,
    title,
    currentUserId,
}: MessageModalProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const flatListRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<MessageWithAuthor[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [editingMessage, setEditingMessage] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    // Load messages when modal opens
    useEffect(() => {
        if (visible) {
            loadMessages();
        }
    }, [visible, eventId, groupId]);

    const loadMessages = async () => {
        try {
            setLoading(true);
            let messageThread;

            if (eventId) {
                messageThread = await getEventMessages(eventId);
            } else if (groupId) {
                messageThread = await getGroupMessages(groupId);
            } else {
                throw new Error('Either eventId or groupId must be provided');
            }

            setMessages(messageThread.messages);
        } catch (error) {
            console.error('Error loading messages:', error);
            Alert.alert('Error', 'Failed to load messages');
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || sending) return;

        try {
            setSending(true);

            let message;
            if (eventId) {
                message = await createEventMessage(eventId, newMessage.trim(), currentUserId);
            } else if (groupId) {
                message = await createGroupMessage(groupId, newMessage.trim(), currentUserId);
            } else {
                throw new Error('Either eventId or groupId must be provided');
            }

            // Add the new message to the list (it will get author info when we reload)
            await loadMessages();
            setNewMessage('');

            // Scroll to bottom
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (error) {
            console.error('Error sending message:', error);
            Alert.alert('Error', 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const handleEditMessage = (messageId: string, currentContent: string) => {
        setEditingMessage(messageId);
        setEditText(currentContent);
    };

    const handleSaveEdit = async () => {
        if (!editingMessage || !editText.trim()) return;

        try {
            await updateMessage(editingMessage, editText.trim(), currentUserId);
            await loadMessages();
            setEditingMessage(null);
            setEditText('');
        } catch (error) {
            console.error('Error updating message:', error);
            Alert.alert('Error', 'Failed to update message');
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        Alert.alert(
            'Delete Message',
            'Are you sure you want to delete this message?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteMessage(messageId, currentUserId);
                            await loadMessages();
                        } catch (error) {
                            console.error('Error deleting message:', error);
                            Alert.alert('Error', 'Failed to delete message');
                        }
                    },
                },
            ]
        );
    };

    const renderMessage = ({ item }: { item: MessageWithAuthor }) => {
        const isOwnMessage = item.authorId === currentUserId;
        const isEditing = editingMessage === item.$id;

        return (
            <View className={`mb-3 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                <View className={`flex-row max-w-[80%] ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                    {!isOwnMessage && (
                        <UserAvatar
                            photoUrl={item.authorPhotoUrl}
                            name={item.authorName}
                            size={32}
                            className="mr-2"
                        />
                    )}

                    <View>
                        {!isOwnMessage && (
                            <Text className="text-xs mb-1 ml-1" style={{ color: colors.textSecondary }}>
                                {item.authorName}
                            </Text>
                        )}

                        <TouchableOpacity
                            onLongPress={() => {
                                if (isOwnMessage) {
                                    Alert.alert(
                                        'Message Options',
                                        '',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Edit',
                                                onPress: () => handleEditMessage(item.$id, item.content),
                                            },
                                            {
                                                text: 'Delete',
                                                style: 'destructive',
                                                onPress: () => handleDeleteMessage(item.$id),
                                            },
                                        ]
                                    );
                                }
                            }}
                            className={`p-3 rounded-2xl ${isOwnMessage ? 'rounded-tr-md' : 'rounded-tl-md'
                                }`}
                            style={{
                                backgroundColor: isOwnMessage ? colors.primary : colors.card,
                            }}
                        >
                            {isEditing ? (
                                <View>
                                    <TextInput
                                        value={editText}
                                        onChangeText={setEditText}
                                        multiline
                                        className="min-h-[40px]"
                                        style={{ color: isOwnMessage ? colors.background : colors.text }}
                                        autoFocus
                                    />
                                    <View className="flex-row mt-2 space-x-2">
                                        <TouchableOpacity
                                            onPress={handleSaveEdit}
                                            className="px-3 py-1 rounded-lg"
                                            style={{ backgroundColor: colors.background }}
                                        >
                                            <Text className="text-xs" style={{ color: colors.primary }}>
                                                Save
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setEditingMessage(null);
                                                setEditText('');
                                            }}
                                            className="px-3 py-1 rounded-lg"
                                            style={{ backgroundColor: colors.surface }}
                                        >
                                            <Text className="text-xs" style={{ color: colors.text }}>
                                                Cancel
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <Text
                                    className="text-base"
                                    style={{ color: isOwnMessage ? colors.background : colors.text }}
                                >
                                    {item.content}
                                    {item.isEdited && (
                                        <Text className="text-xs opacity-70"> (edited)</Text>
                                    )}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <Text
                            className={`text-xs mt-1 ${isOwnMessage ? 'text-right mr-1' : 'ml-1'}`}
                            style={{ color: colors.textSecondary }}
                        >
                            {dayjs(item.$createdAt).fromNow()}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
                {/* Header */}
                <View className="px-4 py-4 border-b flex-row items-center justify-between"
                    style={{ borderBottomColor: colors.border }}>
                    <TouchableOpacity onPress={onClose}>
                        <Text className="text-lg font-rubik-medium" style={{ color: colors.primary }}>
                            Back
                        </Text>
                    </TouchableOpacity>
                    <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>
                        {title}
                    </Text>
                    <View style={{ width: 60 }} />
                </View>

                {/* Messages */}
                <KeyboardAvoidingView
                    className="flex-1"
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {loading ? (
                        <View className="flex-1 justify-center items-center">
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text className="mt-2" style={{ color: colors.textSecondary }}>
                                Loading messages...
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            keyExtractor={(item) => item.$id}
                            renderItem={renderMessage}
                            className="flex-1 px-4"
                            contentContainerStyle={{ paddingVertical: 16 }}
                            onContentSizeChange={() => {
                                flatListRef.current?.scrollToEnd({ animated: false });
                            }}
                            ListEmptyComponent={
                                <View className="flex-1 justify-center items-center">
                                    <Text style={{ color: colors.textSecondary }}>
                                        No messages yet. Start the conversation!
                                    </Text>
                                </View>
                            }
                        />
                    )}

                    {/* Message Input */}
                    <View
                        className="px-4 py-3 border-t flex-row items-center"
                        style={{ borderTopColor: colors.border }}
                    >
                        <TextInput
                            value={newMessage}
                            onChangeText={setNewMessage}
                            placeholder="Type a message..."
                            className="flex-1 border rounded-full px-4 py-2 mr-3 font-rubik"
                            style={{
                                borderColor: colors.border,
                                backgroundColor: colors.card,
                                color: colors.text
                            }}
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            maxLength={500}
                        />
                        <TouchableOpacity
                            onPress={handleSendMessage}
                            disabled={!newMessage.trim() || sending}
                            className="px-4 py-2 rounded-full"
                            style={{
                                backgroundColor: newMessage.trim() ? colors.primary : colors.border
                            }}
                        >
                            <Text
                                className="text-white font-rubik-medium"
                                style={{
                                    color: newMessage.trim() ? 'white' : colors.textSecondary
                                }}
                            >
                                {sending ? '...' : 'Send'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}
