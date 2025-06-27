export interface Event {
  id: string;
  title: string;
  location: string;
  startTime: string; // ISO format
  endTime: string;   // ISO format
  creatorId: string;
  inviteeIds: string[];
  description?: string;
}

export interface EventWithDetails extends Event {
  description: string;
  attendees: string[]; // Array of attendee names or emails
}