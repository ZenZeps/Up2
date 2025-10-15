import { createTravelAnnouncementWithFriendNotifications } from '@/lib/api/travelFriendNotifications';
import { TravelAnnouncement } from '@/lib/types/Travel';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface TravelFormProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    currentUserId: string;
    userFriends: string[];
    editingTravel?: TravelAnnouncement | null;
}

// Shared location mock data for consistency across components
const LOCATION_MOCKS: Record<string, { lat: number; lng: number }> = {
    'sydney': { lat: -33.8688, lng: 151.2093 },
    'melbourne': { lat: -37.8136, lng: 144.9631 },
    'brisbane': { lat: -27.4698, lng: 153.0251 },
    'perth': { lat: -31.9505, lng: 115.8605 },
    'adelaide': { lat: -34.9285, lng: 138.6007 },
    'new york': { lat: 40.7128, lng: -74.0060 },
    'london': { lat: 51.5074, lng: -0.1278 },
    'tokyo': { lat: 35.6762, lng: 139.6503 },
    'paris': { lat: 48.8566, lng: 2.3522 },
    'bali': { lat: -8.3405, lng: 115.0920 },
    'bangkok': { lat: 13.7563, lng: 100.5018 },
    'singapore': { lat: 1.3521, lng: 103.8198 },
    'hong kong': { lat: 22.3193, lng: 114.1694 },
    'los angeles': { lat: 34.0522, lng: -118.2437 },
    'san francisco': { lat: 37.7749, lng: -122.4194 },
};

const TravelForm: React.FC<TravelFormProps> = ({
    visible,
    onClose,
    onSuccess,
    currentUserId,
    userFriends,
    editingTravel
}) => {
    // Consolidated form state
    const [formState, setFormState] = useState(() => ({
        destination: editingTravel?.destination || '',
        description: editingTravel?.description || '',
        startDate: editingTravel ? new Date(editingTravel.startDate) : new Date(),
        endDate: editingTravel ? new Date(editingTravel.endDate) : new Date(),
        isPublic: editingTravel?.isPublic ?? true,
        isLoading: false,
        destinationLat: editingTravel?.destinationLat,
        destinationLng: editingTravel?.destinationLng
    }));

    // Date picker state
    const [datePickerState, setDatePickerState] = useState(() => ({
        showStartDatePicker: false,
        showEndDatePicker: false
    }));

    // Memoized destructuring
    const { destination, description, startDate, endDate, isPublic, isLoading, destinationLat, destinationLng } = formState;
    const { showStartDatePicker, showEndDatePicker } = datePickerState;

    // Optimized location search with shared logic
    const searchLocation = React.useCallback((query: string) => {
        const normalizedQuery = query.toLowerCase();
        const location = LOCATION_MOCKS[normalizedQuery];

        setFormState(prev => ({
            ...prev,
            destination: query,
            destinationLat: location?.lat,
            destinationLng: location?.lng
        }));
    }, []);

    const handleSave = async () => {
        if (!currentUserId || currentUserId.trim() === '') {
            Alert.alert('Error', 'Please log in to create travel announcements');
            return;
        }

        if (!destination.trim()) {
            Alert.alert('Error', 'Please enter a destination');
            return;
        }

        if (endDate < startDate) {
            Alert.alert('Error', 'End date must be after start date');
            return;
        }

        setFormState(prev => ({ ...prev, isLoading: true }));
        try {
            if (editingTravel) {
                Alert.alert('Info', 'Editing travel announcements will be available soon');
                return;
            }

            const travelData = {
                userId: currentUserId,
                destination: destination.trim(),
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                description: description.trim(),
                isPublic,
                destinationLat,
                destinationLng,
                locationName: destination.trim(),
            };

            await createTravelAnnouncementWithFriendNotifications(
                travelData,
                userFriends
            );

            Alert.alert(
                'Travel Created! 🌍',
                `Your travel to ${destination} has been created and friends have been notified!`
            );

            onSuccess();
            onClose();

            // Reset form
            setFormState({
                destination: '',
                description: '',
                startDate: new Date(),
                endDate: new Date(),
                isPublic: true,
                isLoading: false,
                destinationLat: undefined,
                destinationLng: undefined
            });
        } catch (error) {
            console.error('🧳 TravelForm: Error saving travel:', error);

            // Log detailed error information
            if (error instanceof Error) {
                console.error('🧳 TravelForm: Error message:', error.message);
                console.error('🧳 TravelForm: Error stack:', error.stack);
            }

            // Check for specific Appwrite errors
            if (error && typeof error === 'object' && 'type' in error) {
                console.error('🧳 TravelForm: Appwrite error type:', error.type);
                if ('code' in error) {
                    console.error('🧳 TravelForm: Appwrite error code:', error.code);
                }
            }

            Alert.alert('Error', `Failed to save travel announcement: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setFormState(prev => ({ ...prev, isLoading: false }));
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleClose} disabled={isLoading}>
                        <MaterialIcons name="close" size={24} color="#007AFF" />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>
                        {editingTravel ? 'Edit Travel' : 'New Travel'}
                    </Text>

                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={isLoading || !destination.trim()}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#007AFF" />
                        ) : (
                            <Text style={[
                                styles.saveButton,
                                { color: (!destination.trim() || isLoading) ? '#999' : '#007AFF' }
                            ]}>
                                Save
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Destination */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Where are you traveling? ✈️</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g., Sydney, New York, Tokyo"
                            value={destination}
                            onChangeText={searchLocation}
                            editable={!isLoading}
                        />
                        {destinationLat && destinationLng && (
                            <Text style={styles.coordinatesText}>
                                📍 Location found: {destinationLat.toFixed(4)}, {destinationLng.toFixed(4)}
                            </Text>
                        )}
                    </View>

                    {/* Dates */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Travel Dates 📅</Text>

                        {/* Start Date */}
                        <View style={styles.dateRow}>
                            <Text style={styles.dateLabel}>From:</Text>
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => setDatePickerState(prev => ({ ...prev, showStartDatePicker: true }))}
                                disabled={isLoading}
                            >
                                <Text style={styles.dateText}>
                                    {startDate.toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </Text>
                                <MaterialIcons name="date-range" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {/* End Date */}
                        <View style={styles.dateRow}>
                            <Text style={styles.dateLabel}>To:</Text>
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => setDatePickerState(prev => ({ ...prev, showEndDatePicker: true }))}
                                disabled={isLoading}
                            >
                                <Text style={styles.dateText}>
                                    {endDate.toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </Text>
                                <MaterialIcons name="date-range" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Description */}
                    <View style={styles.section}>
                        <Text style={styles.label}>What are you doing there? ✨</Text>
                        <TextInput
                            style={[styles.textInput, styles.textArea]}
                            placeholder="Business trip, vacation, visiting friends..."
                            value={description}
                            onChangeText={(text) => setFormState(prev => ({ ...prev, description: text }))}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            editable={!isLoading}
                        />
                    </View>

                    {/* Privacy */}
                    <View style={styles.section}>
                        <View style={styles.switchRow}>
                            <View style={styles.switchInfo}>
                                <Text style={styles.label}>Public Travel 🌍</Text>
                                <Text style={styles.switchDescription}>
                                    Allow friends to see your travel plans
                                </Text>
                            </View>
                            <Switch
                                value={isPublic}
                                onValueChange={(value) => setFormState(prev => ({ ...prev, isPublic: value }))}
                                disabled={isLoading}
                                trackColor={{ false: '#E5E5E5', true: '#007AFF' }}
                                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                            />
                        </View>
                    </View>

                    {/* Friend Notification Info */}
                    <View style={styles.infoSection}>
                        <View style={styles.infoRow}>
                            <MaterialIcons name="people" size={20} color="#007AFF" />
                            <Text style={styles.infoText}>
                                Friends in {destination || 'your destination'} will be automatically notified
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <MaterialIcons name="location-on" size={20} color="#007AFF" />
                            <Text style={styles.infoText}>
                                Friends traveling there at the same time will see your overlap
                            </Text>
                        </View>
                    </View>

                    {/* Quick location suggestions */}
                    <View style={styles.section}>
                        <Text style={styles.label}>Popular Destinations</Text>
                        <View style={styles.chipContainer}>
                            {['Sydney', 'Melbourne', 'New York', 'Tokyo', 'London', 'Bali'].map((city) => (
                                <TouchableOpacity
                                    key={city}
                                    style={styles.chip}
                                    onPress={() => searchLocation(city)}
                                    disabled={isLoading}
                                >
                                    <Text style={styles.chipText}>{city}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>

                {/* Date Pickers */}
                {showStartDatePicker && (
                    <DateTimePicker
                        value={startDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                            setDatePickerState(prev => ({ ...prev, showStartDatePicker: false }));
                            if (selectedDate) {
                                setFormState(prev => {
                                    const newState = { ...prev, startDate: selectedDate };
                                    // Auto-adjust end date if it's before the new start date
                                    if (selectedDate > prev.endDate) {
                                        newState.endDate = selectedDate;
                                    }
                                    return newState;
                                });
                            }
                        }}
                    />
                )}

                {showEndDatePicker && (
                    <DateTimePicker
                        value={endDate}
                        mode="date"
                        display="default"
                        minimumDate={startDate}
                        onChange={(event, selectedDate) => {
                            setDatePickerState(prev => ({ ...prev, showEndDatePicker: false }));
                            if (selectedDate) {
                                setFormState(prev => ({ ...prev, endDate: selectedDate }));
                            }
                        }}
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000',
    },
    saveButton: {
        fontSize: 16,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    section: {
        marginTop: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        marginBottom: 8,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        backgroundColor: '#FAFAFA',
    },
    textArea: {
        height: 100,
        paddingTop: 12,
    },
    coordinatesText: {
        fontSize: 12,
        color: '#007AFF',
        marginTop: 4,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    dateLabel: {
        fontSize: 16,
        color: '#666',
        width: 50,
        marginRight: 12,
    },
    dateButton: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FAFAFA',
    },
    dateText: {
        fontSize: 16,
        color: '#000',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    switchInfo: {
        flex: 1,
        marginRight: 16,
    },
    switchDescription: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    infoSection: {
        marginTop: 24,
        padding: 16,
        backgroundColor: '#F0F8FF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E1F3FF',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: '#333',
        marginLeft: 8,
        flex: 1,
        lineHeight: 20,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
    },
    chip: {
        backgroundColor: '#007AFF',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
        marginBottom: 8,
    },
    chipText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
});

export default TravelForm;
