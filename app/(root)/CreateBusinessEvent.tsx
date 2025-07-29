import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import ticketService from '../../lib/api/ticket';
import { BusinessEvent } from '../../lib/types/BusinessEvent';

interface BusinessEventFormData {
    title: string;
    description: string;
    location: string;
    startTime: string;
    endTime: string;
    ticketPrice: string;
    currency: string;
    maxTickets: string;
    organizerName: string;
    organizerEmail: string;
    organizerPhone: string;
    businessCategory: string;
    ticketDescription: string;
    refundPolicy: 'none' | 'partial' | 'full';
    requiresApproval: boolean;
    isPrivate: boolean;
    tags: string;
}

const CreateBusinessEvent: React.FC = () => {
    const [formData, setFormData] = useState<BusinessEventFormData>({
        title: '',
        description: '',
        location: '',
        startTime: '',
        endTime: '',
        ticketPrice: '',
        currency: 'USD',
        maxTickets: '',
        organizerName: '',
        organizerEmail: '',
        organizerPhone: '',
        businessCategory: '',
        ticketDescription: '',
        refundPolicy: 'partial',
        requiresApproval: false,
        isPrivate: false,
        tags: '',
    });

    const [loading, setLoading] = useState(false);

    const handleInputChange = (field: keyof BusinessEventFormData, value: string | boolean) => {
        setFormData(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const validateForm = (): boolean => {
        const required = [
            'title',
            'description',
            'location',
            'startTime',
            'endTime',
            'ticketPrice',
            'organizerName',
            'organizerEmail',
            'businessCategory',
        ];

        for (const field of required) {
            if (!formData[field as keyof BusinessEventFormData]) {
                Alert.alert('Error', `${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is required`);
                return false;
            }
        }

        const price = parseFloat(formData.ticketPrice);
        if (isNaN(price) || price <= 0) {
            Alert.alert('Error', 'Please enter a valid ticket price');
            return false;
        }

        if (formData.maxTickets && (isNaN(parseInt(formData.maxTickets)) || parseInt(formData.maxTickets) <= 0)) {
            Alert.alert('Error', 'Please enter a valid maximum tickets number');
            return false;
        }

        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const eventData: Omit<BusinessEvent, '$id' | '$createdAt' | '$updatedAt' | 'ticketsSold'> = {
                // Basic event fields
                title: formData.title,
                description: formData.description,
                location: formData.location,
                startTime: formData.startTime,
                endTime: formData.endTime,
                creatorId: 'current_user_id', // You'll need to get this from your auth context
                inviteeIds: [],
                attendees: [],
                tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
                isPrivate: formData.isPrivate,
                groupId: undefined,

                // Business event specific fields
                isBusinessEvent: true,
                ticketPrice: Math.round(parseFloat(formData.ticketPrice) * 100), // Convert to cents
                currency: formData.currency,
                maxTickets: formData.maxTickets ? parseInt(formData.maxTickets) : undefined,
                organizerId: 'current_user_id', // You'll need to get this from your auth context
                organizerName: formData.organizerName,
                organizerVerified: false, // Set based on your verification system
                ticketDescription: formData.ticketDescription,
                refundPolicy: formData.refundPolicy,
                paymentMethods: ['card'], // Default to card payments
                businessCategory: formData.businessCategory,
                contactEmail: formData.organizerEmail,
                contactPhone: formData.organizerPhone,
                requiresApproval: formData.requiresApproval,

                // Revenue calculation (5% platform fee)
                platformFee: 5,
                stripeFee: 2.9, // 2.9% + $0.30
                organizerEarnings: Math.round(parseFloat(formData.ticketPrice) * 100 * 0.92), // Roughly 92% after fees
            };

            const createdEvent = await ticketService.createBusinessEvent(eventData);

            Alert.alert(
                'Success!',
                'Your business event has been created successfully!',
                [
                    {
                        text: 'OK',
                        onPress: () => router.back(),
                    },
                ]
            );
        } catch (error) {
            console.error('Error creating business event:', error);
            Alert.alert('Error', 'Failed to create business event. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Create Business Event</Text>
                <Text style={styles.subtitle}>Set up a paid event and start earning revenue</Text>
            </View>

            <View style={styles.form}>
                {/* Basic Event Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Event Details</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Event Title *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter event title"
                            value={formData.title}
                            onChangeText={(value) => handleInputChange('title', value)}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Description *</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Describe your event"
                            value={formData.description}
                            onChangeText={(value) => handleInputChange('description', value)}
                            multiline
                            numberOfLines={4}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Location *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Event location"
                            value={formData.location}
                            onChangeText={(value) => handleInputChange('location', value)}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={styles.halfInput}>
                            <Text style={styles.label}>Start Time *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="YYYY-MM-DD HH:MM"
                                value={formData.startTime}
                                onChangeText={(value) => handleInputChange('startTime', value)}
                            />
                        </View>
                        <View style={styles.halfInput}>
                            <Text style={styles.label}>End Time *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="YYYY-MM-DD HH:MM"
                                value={formData.endTime}
                                onChangeText={(value) => handleInputChange('endTime', value)}
                            />
                        </View>
                    </View>
                </View>

                {/* Pricing */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Pricing</Text>

                    <View style={styles.row}>
                        <View style={styles.halfInput}>
                            <Text style={styles.label}>Ticket Price *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0.00"
                                value={formData.ticketPrice}
                                onChangeText={(value) => handleInputChange('ticketPrice', value)}
                                keyboardType="decimal-pad"
                            />
                        </View>
                        <View style={styles.halfInput}>
                            <Text style={styles.label}>Currency *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="USD"
                                value={formData.currency}
                                onChangeText={(value) => handleInputChange('currency', value.toUpperCase())}
                                maxLength={3}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Maximum Tickets (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Leave empty for unlimited"
                            value={formData.maxTickets}
                            onChangeText={(value) => handleInputChange('maxTickets', value)}
                            keyboardType="number-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>What's Included</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Describe what the ticket includes"
                            value={formData.ticketDescription}
                            onChangeText={(value) => handleInputChange('ticketDescription', value)}
                            multiline
                            numberOfLines={3}
                        />
                    </View>
                </View>

                {/* Business Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Business Information</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Business Name *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Your business name"
                            value={formData.organizerName}
                            onChangeText={(value) => handleInputChange('organizerName', value)}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Business Category *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., Restaurant, Hostel, Event Space"
                            value={formData.businessCategory}
                            onChangeText={(value) => handleInputChange('businessCategory', value)}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Contact Email *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="business@example.com"
                            value={formData.organizerEmail}
                            onChangeText={(value) => handleInputChange('organizerEmail', value)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Contact Phone</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="+1 (555) 123-4567"
                            value={formData.organizerPhone}
                            onChangeText={(value) => handleInputChange('organizerPhone', value)}
                            keyboardType="phone-pad"
                        />
                    </View>
                </View>

                {/* Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Event Settings</Text>

                    <View style={styles.switchRow}>
                        <Text style={styles.label}>Require approval for purchases</Text>
                        <Switch
                            value={formData.requiresApproval}
                            onValueChange={(value) => handleInputChange('requiresApproval', value)}
                        />
                    </View>

                    <View style={styles.switchRow}>
                        <Text style={styles.label}>Private event</Text>
                        <Switch
                            value={formData.isPrivate}
                            onValueChange={(value) => handleInputChange('isPrivate', value)}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Refund Policy</Text>
                        <View style={styles.radioGroup}>
                            {[
                                { label: 'No refunds', value: 'none' },
                                { label: 'Partial refunds', value: 'partial' },
                                { label: 'Full refunds', value: 'full' },
                            ].map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    style={[
                                        styles.radioOption,
                                        formData.refundPolicy === option.value && styles.radioSelected,
                                    ]}
                                    onPress={() => handleInputChange('refundPolicy', option.value)}
                                >
                                    <Text style={[
                                        styles.radioText,
                                        formData.refundPolicy === option.value && styles.radioTextSelected,
                                    ]}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Tags (comma separated)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="food, music, networking"
                            value={formData.tags}
                            onChangeText={(value) => handleInputChange('tags', value)}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    <Text style={styles.submitButtonText}>
                        {loading ? 'Creating Event...' : 'Create Business Event'}
                    </Text>
                </TouchableOpacity>

                <View style={styles.feeInfo}>
                    <Text style={styles.feeTitle}>Fee Structure</Text>
                    <Text style={styles.feeText}>• Platform fee: 5% of ticket price</Text>
                    <Text style={styles.feeText}>• Payment processing: 2.9% + $0.30 per transaction</Text>
                    <Text style={styles.feeText}>• You keep approximately 92% of each ticket sale</Text>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fb',
    },
    header: {
        padding: 24,
        paddingTop: 40,
        backgroundColor: '#ffffff',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        fontWeight: '400',
        lineHeight: 22,
    },
    form: {
        padding: 20,
        paddingTop: 24,
    },
    section: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 20,
        letterSpacing: -0.3,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 15,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
        letterSpacing: -0.1,
    },
    input: {
        borderWidth: 1.5,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        backgroundColor: '#ffffff',
        color: '#1a1a1a',
        fontWeight: '400',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
        paddingTop: 16,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    halfInput: {
        flex: 1,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 8,
    },
    radioGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    radioOption: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderWidth: 1.5,
        borderColor: '#e5e7eb',
        borderRadius: 24,
        backgroundColor: '#ffffff',
    },
    radioSelected: {
        backgroundColor: '#1a1a1a',
        borderColor: '#1a1a1a',
    },
    radioText: {
        color: '#6b7280',
        fontSize: 14,
        fontWeight: '500',
    },
    radioTextSelected: {
        color: '#ffffff',
        fontWeight: '600',
    },
    submitButton: {
        backgroundColor: '#1a1a1a',
        paddingVertical: 18,
        paddingHorizontal: 24,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#1a1a1a',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    submitButtonDisabled: {
        backgroundColor: '#d1d5db',
        shadowOpacity: 0,
        elevation: 0,
    },
    submitButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    feeInfo: {
        backgroundColor: '#f0f9ff',
        padding: 20,
        borderRadius: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#3b82f6',
        marginTop: 8,
    },
    feeTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e40af',
        marginBottom: 12,
        letterSpacing: -0.1,
    },
    feeText: {
        fontSize: 14,
        color: '#1e40af',
        marginBottom: 6,
        lineHeight: 20,
        fontWeight: '400',
    },
});

export default CreateBusinessEvent;
