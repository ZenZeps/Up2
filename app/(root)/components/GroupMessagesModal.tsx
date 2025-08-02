import { getGroupChatMessages, getOrCreateGroupChat } from '@/lib/api/chats';
import { createMessage } from '@/lib/api/messages';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { Group } from '@/lib/types/Groups';
import { MessageWithAuthor } from '@/lib/types/Messages';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    Modal,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface GroupMessagesModalProps {
    visible: boolean;
    onClose: () => void;
    group: Group;
}

const GroupMessagesModal: React.FC<GroupMessagesModalProps> = ({
    visible,
    onClose,
    group
}) => {
    const { colors } = useTheme();
    const { user } = useGlobalContext();
    const [messages, setMessages] = useState<MessageWithAuthor[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatId, setChatId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    // Load messages when modal opens
    useEffect(() => {
        if (visible && group.$id) {
            loadMessages();
        }
    }, [visible, group.$id]);

    const loadMessages = async () => {
        try {
            setLoading(true);

            // Get or create chat for this group
            const chat = await getOrCreateGroupChat(group.$id);
            setChatId(chat.$id);

            // Load messages
            const messages = await getGroupChatMessages(chat.$id);
            setMessages(messages);

        } catch (error) {
            console.error('Error loading group messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !chatId || !user?.$id) return;

        try {
            setSending(true);

            await createMessage({
                content: newMessage.trim(),
                chatId,
            }, user.$id);

            setNewMessage('');

            // Reload messages to show the new one
            await loadMessages();

        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    const formatTime = (timestamp?: string) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (timestamp?: string) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString();
        }
    };

    const renderMessage = ({ item }: { item: MessageWithAuthor }) => {
        const isCurrentUser = item.authorId === user?.$id;

        return (
            <View className={`mb-3 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                <View
                    className={`max-w-xs px-4 py-2 rounded-lg ${isCurrentUser ? 'bg-blue-500' : 'bg-gray-200'
                        }`}
                    style={{
                        backgroundColor: isCurrentUser ? colors.primary : colors.card
                    }}
                >
                    {!isCurrentUser && (
                        <Text
                            className="text-xs font-rubik-medium mb-1"
                            style={{ color: colors.textSecondary }}
                        >
                            {item.authorName}
                        </Text>
                    )}
                    <Text
                        className="font-rubik"
                        style={{ color: isCurrentUser ? 'white' : colors.text }}
                    >
                        {item.content}
                    </Text>
                    <Text
                        className="text-xs mt-1"
                        style={{
                            color: isCurrentUser ? 'rgba(255,255,255,0.7)' : colors.textSecondary
                        }}
                    >
                        {formatTime(item.$createdAt)}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View className="flex-1" style={{ backgroundColor: colors.background }}>
                {/* Header */}
                <View className="px-4 py-4 border-b flex-row items-center justify-between"
                    style={{ borderBottomColor: colors.border }}>
                    <TouchableOpacity onPress={onClose}>
                        <Text className="text-lg font-rubik-medium" style={{ color: colors.primary }}>
                            Back
                        </Text>
                    </TouchableOpacity>
                    <Text className="text-xl font-rubik-semibold" style={{ color: colors.text }}>
                        {group.title}
                    </Text>
                    <View style={{ width: 60 }} />
                </View>

                {/* Messages */}
                <View className="flex-1">
                    {loading ? (
                        <View className="flex-1 justify-center items-center">
                            <Text style={{ color: colors.textSecondary }}>Loading messages...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={messages}
                            renderItem={renderMessage}
                            keyExtractor={(item) => item.$id}
                            className="flex-1 px-4 py-4"
                            showsVerticalScrollIndicator={false}
                            inverted={false}
                            ListEmptyComponent={
                                <View className="flex-1 justify-center items-center py-8">
                                    <Text
                                        className="text-center font-rubik"
                                        style={{ color: colors.textSecondary }}
                                    >
                                        No messages yet. Start the conversation!
                                    </Text>
                                </View>
                            }
                        />
                    )}
                </View>

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
                        onPress={sendMessage}
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
            </View>
        </Modal>
    );
};

export default GroupMessagesModal;
