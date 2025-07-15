export interface Event {
  $id: string;  // Internal ID used by the app
  id?: string;  // Required ID field for Appwrite - will match $id
  title: string;
  location: string;
  startTime: string; // ISO format
  endTime: string;   // ISO format
  creatorId: string;
  inviteeIds: string[]; // Users who have been invited to the event
  attendees: string[]; // Users who have confirmed attendance
  isAttending?: boolean;
  description?: string;
  tags: string[]; // Event categories/tags (sports, music, art, etc.)
}

export interface EventWithDetails extends Event {
  description: string;
  attendees: string[]; // Array of attendee user IDs
}