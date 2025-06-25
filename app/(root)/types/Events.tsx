export interface Event {
  id: string;
  title: string;
  location: string;
  dateTime: string; // ISO format
  duration: number; // duration in minutes
  creatorId: string;
  inviteeIds: string[];
}

export interface EventWithDetails extends Event {
  description: string;
  attendees: string[]; // Array of attendee names or emails
}