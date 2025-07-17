import { createTravelAnnouncement, updateTravelAnnouncement } from '@/lib/api/travel';
import { TravelAnnouncement } from '@/lib/types/Travel';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface TravelFormProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    currentUserId: string;
    editingTravel?: TravelAnnouncement | null;
}

export default function TravelForm({
    visible,
    onClose,
    onSuccess,
    currentUserId,
    editingTravel
}: TravelFormProps) {
    const [destination, setDestination] = useState(editingTravel?.destination || '');
    const [description, setDescription] = useState(editingTravel?.description || '');
    const [startDate, setStartDate] = useState(
        editingTravel ? new Date(editingTravel.startDate) : new Date()
    );
    const [endDate, setEndDate] = useState(
        editingTravel ? new Date(editingTravel.endDate) : new Date()
    );
    const [isPublic, setIsPublic] = useState(editingTravel?.isPublic ?? true);
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!destination.trim()) {
            Alert.alert('Error', 'Please enter a destination');
            return;
        }

        if (endDate < startDate) {
            Alert.alert('Error', 'End date must be after start date');
            return;
        }

        setLoading(true);
        try {
            if (editingTravel) {
                // Update existing travel
                await updateTravelAnnouncement(editingTravel.$id, {
                    destination: destination.trim(),
                    description: description.trim(),
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    isPublic,
                });
                Alert.alert('Success', 'Travel announcement updated!');
            } else {
                // Create new travel
                await createTravelAnnouncement({
                    userId: currentUserId,
                    destination: destination.trim(),
                    description: description.trim(),
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    isPublic,
                });
                Alert.alert('Success', 'Travel announcement created!');
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving travel:', error);
            Alert.alert('Error', 'Failed to save travel announcement');
        } finally {
            setLoading(false);
        }
    };

    const onStartDateChange = (event: any, selectedDate?: Date) => {
        setShowStartDatePicker(false);
        if (selectedDate) {
            setStartDate(selectedDate);
            // If end date is before new start date, update it
            if (endDate < selectedDate) {
                setEndDate(selectedDate);
            }
        }
    };

    const onEndDateChange = (event: any, selectedDate?: Date) => {
        setShowEndDatePicker(false);
        if (selectedDate) {
            setEndDate(selectedDate);
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <SafeAreaView style={styles.modalView}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                            <Text style={styles.title}>
                                {editingTravel ? 'Edit Travel' : 'Announce Travel'}
                            </Text>
                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={loading}
                                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                            >
                                <Text style={styles.saveButtonText}>
                                    {loading ? 'Saving...' : 'Save'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Form Fields */}
                        <View style={styles.form}>
                            {/* Destination */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>Destination *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={destination}
                                    onChangeText={setDestination}
                                    placeholder="Where are you traveling to?"
                                    placeholderTextColor="#999"
                                />
                            </View>

                            {/* Start Date */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>Start Date *</Text>
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => setShowStartDatePicker(true)}
                                >
                                    <Text style={styles.dateButtonText}>
                                        {startDate.toLocaleDateString()}
                                    </Text>
                                    <MaterialIcons name="date-range" size={20} color="#666" />
                                </TouchableOpacity>
                            </View>

                            {/* End Date */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>End Date *</Text>
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => setShowEndDatePicker(true)}
                                >
                                    <Text style={styles.dateButtonText}>
                                        {endDate.toLocaleDateString()}
                                    </Text>
                                    <MaterialIcons name="date-range" size={20} color="#666" />
                                </TouchableOpacity>
                            </View>

                            {/* Description */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>Description</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={description}
                                    onChangeText={setDescription}
                                    placeholder="Tell your friends about your trip..."
                                    placeholderTextColor="#999"
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                            </View>

                            {/* Public Switch */}
                            <View style={styles.switchContainer}>
                                <View style={styles.switchLabelContainer}>
                                    <Text style={styles.label}>Share with friends</Text>
                                    <Text style={styles.switchDescription}>
                                        Let your friends see this travel announcement
                                    </Text>
                                </View>
                                <Switch
                                    value={isPublic}
                                    onValueChange={setIsPublic}
                                    trackColor={{ false: '#ccc', true: '#4A90E2' }}
                                    thumbColor={isPublic ? '#fff' : '#f4f3f4'}
                                />
                            </View>
                        </View>
                    </ScrollView>

                    {/* Date Pickers */}
                    {showStartDatePicker && (
                        <DateTimePicker
                            value={startDate}
                            mode="date"
                            display="default"
                            onChange={onStartDateChange}
                            minimumDate={new Date()}
                        />
                    )}

                    {showEndDatePicker && (
                        <DateTimePicker
                            value={endDate}
                            mode="date"
                            display="default"
                            onChange={onEndDateChange}
                            minimumDate={startDate}
                        />
                    )}
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: 'white',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        padding: 5,
    },
    saveButton: {
        backgroundColor: '#4A90E2',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    saveButtonDisabled: {
        backgroundColor: '#ccc',
    },
    saveButtonText: {
        color: 'white',
        fontWeight: '600',
    },
    form: {
        padding: 20,
    },
    fieldContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: '#333',
        backgroundColor: '#f9f9f9',
    },
    textArea: {
        height: 80,
    },
    dateButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 12,
        backgroundColor: '#f9f9f9',
    },
    dateButtonText: {
        fontSize: 16,
        color: '#333',
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    switchLabelContainer: {
        flex: 1,
        marginRight: 15,
    },
    switchDescription: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
});
