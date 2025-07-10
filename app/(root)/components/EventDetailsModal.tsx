import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Image } from 'react-native';
import dayjs from 'dayjs';
import { MaterialIcons } from '@expo/vector-icons';
import images from '@/constants/images';
import icons from '@/constants/icons';

const EventDetailsModal = ({ event, isCreator, onClose, onEdit }) => {
  if (!event) return null;
  console.log('Event in modal:', event);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={!!event}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#666" />
          </TouchableOpacity>

          {/* Creator Info */}
          <View style={styles.creatorInfo}>
            <Image source={images.avatar} style={styles.avatar} />
            <Text style={styles.creatorName}>{event.rawEvent?.creatorName || 'Unknown Creator'}</Text>
          </View>

          {/* Event Image (Placeholder) */}
          <Image source={images.onboarding} style={styles.eventImage} />

          {/* Event Title */}
          <Text style={styles.eventTitle}>{event.title}</Text>

          {/* Event Details */}
          <View style={styles.detailRow}>
            <Image source={icons.location} style={styles.detailIcon} />
            <Text style={styles.detailText}>{event.location}</Text>
          </View>
          <View style={styles.detailRow}>
            <Image source={icons.calendar} style={styles.detailIcon} />
            <Text style={styles.detailText}>
              {dayjs(event.start).format('MMM D, YYYY h:mm A')} - {dayjs(event.end).format('h:mm A')}
            </Text>
          </View>

          {/* Event Description */}
          <Text style={styles.description}>{event.rawEvent?.description}</Text>

          {/* Edit Button */}
          {isCreator && (
            <TouchableOpacity style={styles.editButton} onPress={onEdit}>
              <Text style={styles.editButtonText}>Edit Event</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent background
  },
  modalView: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    backgroundColor: '#eee',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  creatorName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  eventImage: {
    width: '100%',
    height: 200,
    borderRadius: 5,
    marginBottom: 10,
  },
  eventTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  detailIcon: {
    width: 18,
    height: 18,
    marginRight: 8,
    tintColor: '#666',
  },
  detailText: {
    fontSize: 14,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#555',
    marginTop: 10,
    marginBottom: 15,
  },
  editButton: {
    backgroundColor: '#1E88E5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  editButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default EventDetailsModal;