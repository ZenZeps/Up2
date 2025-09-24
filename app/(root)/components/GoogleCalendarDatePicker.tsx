import { MaterialIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import {
    Dimensions,
    Modal,
    Platform,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// Import the date picker based on platform
let DateTimePicker: any;
try {
    if (Platform.OS === 'ios') {
        DateTimePicker = require('@react-native-community/datetimepicker').default;
    } else {
        DateTimePicker = require('@react-native-community/datetimepicker').default;
    }
} catch (error) {
    console.warn('DateTimePicker not available:', error);
}

const { width, height } = Dimensions.get('window');

interface GoogleCalendarDatePickerProps {
    visible: boolean;
    onClose: () => void;
    onSave: (startDate: Date, endDate: Date, isAllDay: boolean) => void;
    initialStartDate: Date;
    initialEndDate: Date;
    initialIsAllDay?: boolean;
    title?: string;
}

export default function GoogleCalendarDatePicker({
    visible,
    onClose,
    onSave,
    initialStartDate,
    initialEndDate,
    initialIsAllDay = false,
    title = '',
}: GoogleCalendarDatePickerProps) {
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [isAllDay, setIsAllDay] = useState(initialIsAllDay);
    const [activeField, setActiveField] = useState<'start-date' | 'start-time' | 'end-date' | 'end-time' | null>(null);
    const [showPicker, setShowPicker] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setStartDate(initialStartDate);
            setEndDate(initialEndDate);
            setIsAllDay(initialIsAllDay);
            setActiveField(null);
            setShowPicker(false);
        }
    }, [visible, initialStartDate, initialEndDate, initialIsAllDay]);

    const handleDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowPicker(false);
        }

        if (selectedDate && activeField) {
            const newDate = selectedDate;

            if (activeField === 'start-date') {
                // Keep the time, change only the date
                const newStartDate = dayjs(startDate)
                    .year(newDate.getFullYear())
                    .month(newDate.getMonth())
                    .date(newDate.getDate())
                    .toDate();
                setStartDate(newStartDate);

                // If end date is before new start date, adjust it
                if (endDate < newStartDate) {
                    const newEndDate = dayjs(newStartDate).add(1, 'hour').toDate();
                    setEndDate(newEndDate);
                }
            } else if (activeField === 'start-time') {
                // Keep the date, change only the time
                const newStartDate = dayjs(startDate)
                    .hour(newDate.getHours())
                    .minute(newDate.getMinutes())
                    .toDate();
                setStartDate(newStartDate);

                // Adjust end time if needed
                if (endDate <= newStartDate) {
                    const newEndDate = dayjs(newStartDate).add(1, 'hour').toDate();
                    setEndDate(newEndDate);
                }
            } else if (activeField === 'end-date') {
                // Keep the time, change only the date
                const newEndDate = dayjs(endDate)
                    .year(newDate.getFullYear())
                    .month(newDate.getMonth())
                    .date(newDate.getDate())
                    .toDate();

                if (newEndDate > startDate) {
                    setEndDate(newEndDate);
                }
            } else if (activeField === 'end-time') {
                // Keep the date, change only the time
                const newEndDate = dayjs(endDate)
                    .hour(newDate.getHours())
                    .minute(newDate.getMinutes())
                    .toDate();

                if (newEndDate > startDate) {
                    setEndDate(newEndDate);
                }
            }
        }

        if (Platform.OS === 'ios') {
            // Keep picker open on iOS for better UX
            // User will tap "Done" to close
        } else {
            setActiveField(null);
        }
    };

    const openPicker = (field: 'start-date' | 'start-time' | 'end-date' | 'end-time') => {
        setActiveField(field);
        setShowPicker(true);
    };

    const handleAllDayToggle = (value: boolean) => {
        setIsAllDay(value);
        if (value) {
            // Set to start and end of day
            const startOfDay = dayjs(startDate).startOf('day').toDate();
            const endOfDay = dayjs(startDate).endOf('day').toDate();
            setStartDate(startOfDay);
            setEndDate(endOfDay);
        }
    };

    const handleSave = () => {
        onSave(startDate, endDate, isAllDay);
        onClose();
    };

    const getPickerMode = () => {
        if (!activeField) return 'datetime';
        return activeField.includes('date') ? 'date' : 'time';
    };

    const getPickerValue = () => {
        if (!activeField) return startDate;
        return activeField.startsWith('start') ? startDate : endDate;
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                        <MaterialIcons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Set Date & Time</Text>
                    <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                        <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    {/* All Day Toggle */}
                    <View style={styles.allDayContainer}>
                        <View style={styles.allDayLabel}>
                            <MaterialIcons name="schedule" size={20} color="#666" />
                            <Text style={styles.allDayText}>All day</Text>
                        </View>
                        <Switch
                            value={isAllDay}
                            onValueChange={handleAllDayToggle}
                            trackColor={{ false: '#E5E5E5', true: '#34C759' }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    {/* Start Date/Time */}
                    <View style={styles.dateTimeSection}>
                        <View style={styles.dateTimeRow}>
                            <View style={styles.dateTimeLabels}>
                                <Text style={styles.dateLabel}>
                                    {dayjs(startDate).format('ddd, MMM D')}
                                </Text>
                                {!isAllDay && (
                                    <Text style={styles.timeLabel}>
                                        {dayjs(startDate).format('h:mm A')}
                                    </Text>
                                )}
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color="#C7C7CC" />
                        </View>

                        {/* Date Picker Button */}
                        <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => openPicker('start-date')}
                        >
                            <Text style={styles.pickerButtonText}>
                                {dayjs(startDate).format('dddd, MMMM D, YYYY')}
                            </Text>
                        </TouchableOpacity>

                        {/* Time Picker Button */}
                        {!isAllDay && (
                            <TouchableOpacity
                                style={styles.pickerButton}
                                onPress={() => openPicker('start-time')}
                            >
                                <Text style={styles.pickerButtonText}>
                                    {dayjs(startDate).format('h:mm A')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* End Date/Time */}
                    <View style={styles.dateTimeSection}>
                        <View style={styles.dateTimeRow}>
                            <View style={styles.dateTimeLabels}>
                                <Text style={styles.dateLabel}>
                                    {dayjs(endDate).format('ddd, MMM D')}
                                </Text>
                                {!isAllDay && (
                                    <Text style={styles.timeLabel}>
                                        {dayjs(endDate).format('h:mm A')}
                                    </Text>
                                )}
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color="#C7C7CC" />
                        </View>

                        {/* Date Picker Button */}
                        <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => openPicker('end-date')}
                        >
                            <Text style={styles.pickerButtonText}>
                                {dayjs(endDate).format('dddd, MMMM D, YYYY')}
                            </Text>
                        </TouchableOpacity>

                        {/* Time Picker Button */}
                        {!isAllDay && (
                            <TouchableOpacity
                                style={styles.pickerButton}
                                onPress={() => openPicker('end-time')}
                            >
                                <Text style={styles.pickerButtonText}>
                                    {dayjs(endDate).format('h:mm A')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Native Date/Time Picker */}
                {showPicker && DateTimePicker && (
                    <DateTimePicker
                        value={getPickerValue()}
                        mode={getPickerMode()}
                        display="spinner"
                        onChange={handleDateChange}
                        style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
                        textColor="#000000"
                        accentColor="#000000"
                    />
                )}

                {/* iOS Picker Done Button */}
                {showPicker && Platform.OS === 'ios' && (
                    <View style={styles.iosPickerActions}>
                        <TouchableOpacity
                            onPress={() => {
                                setShowPicker(false);
                                setActiveField(null);
                            }}
                            style={styles.iosPickerDone}
                        >
                            <Text style={styles.iosPickerDoneText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 0.5,
        borderBottomColor: '#C6C6C8',
    },
    headerButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#000000',
    },
    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingTop: 20,
    },
    allDayContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 10,
    },
    allDayLabel: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    allDayText: {
        fontSize: 16,
        color: '#000000',
        marginLeft: 8,
    },
    dateTimeSection: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 10,
        padding: 16,
    },
    dateTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    dateTimeLabels: {
        flex: 1,
    },
    dateLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
        marginBottom: 2,
    },
    timeLabel: {
        fontSize: 14,
        color: '#666666',
    },
    pickerButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#F2F2F7',
        borderRadius: 8,
        marginBottom: 8,
    },
    pickerButtonText: {
        fontSize: 16,
        color: '#000000',
        textAlign: 'center',
    },
    iosPicker: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        borderRadius: 10,
    },
    iosPickerActions: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 0.5,
        borderTopColor: '#C6C6C8',
    },
    iosPickerDone: {
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#000000',
        borderRadius: 8,
    },
    iosPickerDoneText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
