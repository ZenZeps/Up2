import icons from '@/constants/icons';
import images from '@/constants/images';
import { getUserProfilePhotoUrl } from '@/lib/api/profilePhoto';
import { getUsersByIds } from '@/lib/api/user';
import { MaterialIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Event } from '@/lib/types/Events';

interface EventDetailsModalProps {
  event: Event;
  isCreator: boolean;
  onClose: () => void;
  onEdit: (event: Event) => void;
  onAttend: () => void;
  onNotAttend: () => void;
  currentUserId: string;
}

const EventDetailsModal = ({
  event,
  isCreator,
  onClose,
  onEdit,
  onAttend,
  onNotAttend,
  currentUserId
}: EventDetailsModalProps) => {
  const [attendeeProfiles, setAttendeeProfiles] = useState<any[]>([]);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [creatorPhotoUrl, setCreatorPhotoUrl] = useState<string | null>(null);
  const [attendeePhotoUrls, setAttendeePhotoUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const fetchAttendeeProfiles = async () => {
      if (event?.attendees?.length > 0) {
        try {
          const profiles = await getUsersByIds(event.attendees);
          setAttendeeProfiles(profiles);

          // Fetch profile photos for attendees
          const photoUrls: Record<string, string | null> = {};
          for (const profile of profiles) {
            try {
              const photoUrl = await getUserProfilePhotoUrl(profile.$id);
              photoUrls[profile.$id] = photoUrl;
            } catch (error) {
              console.error(`Error fetching photo for attendee ${profile.$id}:`, error);
              photoUrls[profile.$id] = null;
            }
          }
          setAttendeePhotoUrls(photoUrls);
        } catch (error) {
          console.error('Error fetching attendee profiles:', error);
        }
      }
    };

    fetchAttendeeProfiles();
  }, [event?.attendees]);

  // Fetch creator's profile photo
  useEffect(() => {
    const fetchCreatorPhoto = async () => {
      if (event?.creatorId) {
        try {
          const photoUrl = await getUserProfilePhotoUrl(event.creatorId);
          setCreatorPhotoUrl(photoUrl);
        } catch (error) {
          console.error('Error fetching creator photo:', error);
        }
      }
    };

    fetchCreatorPhoto();
  }, [event?.creatorId]);

  if (!event) return null;

  const isAttending = event.attendees?.includes(currentUserId);

  interface AttendeeProfile {
    $id: string;
    name: string;
  }

  interface AttendeesListProps {
    profiles: AttendeeProfile[];
    limit?: number | null;
    onPress?: (() => void) | null;
  }

  const AttendeesList = ({ profiles, limit = null, onPress = null }: AttendeesListProps) => (
    <View style={styles.attendeesContainer}>
      <View style={styles.attendeesRow}>
        {(limit ? profiles.slice(0, limit) : profiles).map((profile: AttendeeProfile, index: number) => (
          <View key={profile.$id} style={[styles.attendeeItem, index > 0 && { marginLeft: -10 }]}>
            <Image
              source={attendeePhotoUrls[profile.$id] ? { uri: attendeePhotoUrls[profile.$id] } : images.avatar}
              style={styles.attendeeAvatar}
            />
            {!limit && <Text style={styles.attendeeName}>{profile.name.split(' ')[0]}</Text>}
          </View>
        ))}
        {limit && profiles.length > limit && (
          <View style={[styles.attendeeItem, { marginLeft: -10 }]}>
            <View style={styles.moreAttendeesCircle}>
              <Text style={styles.moreAttendeesText}>+{profiles.length - limit}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );

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

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Creator Info */}
            <View style={styles.creatorInfo}>
              <Image
                source={creatorPhotoUrl ? { uri: creatorPhotoUrl } : images.avatar}
                style={styles.avatar}
              />
              <Text style={styles.creatorName}>
                {/* TypeScript workaround for extended Event with creatorName */}
                {(event as any).creatorName || 'Unknown Creator'}
              </Text>
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
                {event.startTime && dayjs(event.startTime).isValid() ? dayjs(event.startTime).format('MMM D, YYYY h:mm A') : 'Invalid date'}
                -
                {event.endTime && dayjs(event.endTime).isValid() ? dayjs(event.endTime).format('h:mm A') : 'Invalid date'}
              </Text>
            </View>

            {/* Event Description */}
            <Text style={styles.description}>{event.description || 'No description available.'}</Text>

            {/* Attendees Section */}
            {attendeeProfiles.length > 0 && (
              <View style={styles.attendeesSection}>
                <Pressable onPress={() => setShowAttendeesModal(true)}>
                  <Text style={styles.attendeesTitle}>
                    Attending ({attendeeProfiles.length})
                  </Text>
                </Pressable>
                <AttendeesList profiles={attendeeProfiles} limit={5 as any} />
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {isCreator ? (
                <TouchableOpacity
                  style={[styles.button, styles.editButton]}
                  onPress={() => onEdit(event)}
                >
                  <Text style={styles.buttonText}>Edit Event</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.button,
                    isAttending ? styles.notAttendingButton : styles.attendingButton
                  ]}
                  onPress={isAttending ? onNotAttend : onAttend}
                >
                  <Text style={[
                    styles.buttonText,
                    isAttending ? styles.notAttendingText : styles.attendingText
                  ]}>
                    {isAttending ? 'Not Attending' : 'Attend Event'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Full Attendees List Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAttendeesModal}
        onRequestClose={() => setShowAttendeesModal(false)}
      >
        <View style={styles.centeredView}>
          <View style={[styles.modalView, styles.attendeesModalView]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowAttendeesModal(false)}
            >
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>

            <Text style={styles.attendeesModalTitle}>Attendees</Text>

            <ScrollView style={styles.attendeesModalList}>
              <AttendeesList profiles={attendeeProfiles} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

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
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 1,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  eventImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    marginBottom: 15,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  detailText: {
    fontSize: 16,
    color: '#666',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginVertical: 15,
  },
  attendeesSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  attendeesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  attendeesContainer: {
    marginTop: 5,
  },
  attendeesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeItem: {
    alignItems: 'center',
  },
  attendeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
  attendeeName: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  moreAttendeesCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  moreAttendeesText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  actionButtons: {
    marginTop: 20,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 5,
  },
  editButton: {
    backgroundColor: '#4A90E2',
  },
  attendingButton: {
    backgroundColor: '#4CAF50',
  },
  notAttendingButton: {
    backgroundColor: '#FF5252',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  attendingText: {
    color: 'white',
  },
  notAttendingText: {
    color: 'white',
  },
  attendeesModalView: {
    padding: 20,
    width: '90%',
    maxHeight: '70%',
  },
  attendeesModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  attendeesModalList: {
    width: '100%',
  },
});

export default EventDetailsModal;