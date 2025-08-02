import { getGroupChatMessages, getOrCreateGroupChat } from '@/lib/api/chats';
import { createMessage } from '@/lib/api/messages';
import { useTheme } from '@/lib/context/ThemeContext';
import { useGlobalContext } from '@/lib/global-provider';
import { Group } from '@/lib/types/Groups';
import { MessageWithAuthor } from '@/lib/types/Messages';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
            <View style={[styles.messageContainer, isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage]}>
                <View
                    style={[
                        styles.messageBubble,
                        {
                            backgroundColor: isCurrentUser ? colors.primary : colors.card,
                            borderColor: colors.border,
                        }
                    ]}
                >
                    {!isCurrentUser && (
                        <Text style={[styles.authorName, { color: colors.textSecondary }]}>
                            {item.authorName}
                        </Text>
                    )}
                    <Text style={[styles.messageText, { color: isCurrentUser ? 'white' : colors.text }]}>
                        {item.content}
                    </Text>
                    <Text
                        style={[
                            styles.messageTime,
                            { color: isCurrentUser ? 'rgba(255,255,255,0.7)' : colors.textSecondary }
                        ]}
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
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Stylish Header */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <TouchableOpacity style={styles.backButton} onPress={onClose}>
                            <MaterialIcons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>

                        <View style={styles.headerCenter}>
                            <View style={styles.chatIconContainer}>
                                <MaterialIcons name="chat" size={20} color="white" />
                            </View>
                            <View style={styles.headerTextContainer}>
                                <Text style={styles.headerTitle}>{group.title}</Text>
                                <Text style={styles.headerSubtitle}>
                                    {group.users?.length || 0} members
                                </Text>
                            </View>
                        </View>

                        <View style={styles.headerRight}>
                            <TouchableOpacity style={styles.headerActionButton}>
                                <MaterialIcons name="more-vert" size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Messages Container */}
                <View style={styles.messagesContainer}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <MaterialIcons name="chat-bubble-outline" size={48} color={colors.textSecondary} />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                                Loading messages...
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={messages}
                            renderItem={renderMessage}
                            keyExtractor={(item) => item.$id}
                            style={styles.messagesList}
                            showsVerticalScrollIndicator={false}
                            inverted={false}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
                                        <MaterialIcons name="chat-bubble-outline" size={32} color={colors.textSecondary} />
                                    </View>
                                    <Text style={[styles.emptyText, { color: colors.text }]}>
                                        No messages yet
                                    </Text>
                                    <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                                        Start the conversation with your group!
                                    </Text>
                                </View>
                            }
                        />
                    )}
                </View>

                {/* Enhanced Message Input */}
                <View style={[styles.inputContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                    <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <TextInput
                            value={newMessage}
                            onChangeText={setNewMessage}
                            placeholder="Type a message..."
                            style={[styles.textInput, { color: colors.text }]}
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            maxLength={500}
                        />
                        <TouchableOpacity
                            onPress={sendMessage}
                            disabled={!newMessage.trim() || sending}
                            style={[
                                styles.sendButton,
                                {
                                    backgroundColor: newMessage.trim() ? colors.primary : colors.border
                                }
                            ]}
                        >
                            <MaterialIcons
                                name={sending ? "hourglass-empty" : "send"}
                                size={20}
                                color={newMessage.trim() ? 'white' : colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        backgroundColor: '#000',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        padding: 4,
        marginRight: 12,
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    chatIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    headerTextContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: 'white',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    headerRight: {
        width: 40,
        alignItems: 'flex-end',
    },
    headerActionButton: {
        padding: 4,
    },
    messagesContainer: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        marginTop: 12,
    },
    messagesList: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 32,
    },
    emptyIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        textAlign: 'center',
    },
    messageContainer: {
        marginBottom: 16,
    },
    currentUserMessage: {
        alignItems: 'flex-end',
    },
    otherUserMessage: {
        alignItems: 'flex-start',
    },
    messageBubble: {
        maxWidth: '75%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        borderWidth: 1,
    },
    authorName: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 20,
    },
    messageTime: {
        fontSize: 11,
        marginTop: 4,
    },
    inputContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        borderRadius: 24,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 8,
        minHeight: 48,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        maxHeight: 100,
        paddingVertical: 8,
    },
    sendButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
});

export default GroupMessagesModal;
