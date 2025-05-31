export interface Event {
  id: string;
  title: string;
  location: string;
  dateTime: string; // ISO format
  duration: number; // duration in minutes
}

export interface EventWithDetails extends Event {
  description: string;
  attendees: string[]; // Array of attendee names or emails
}