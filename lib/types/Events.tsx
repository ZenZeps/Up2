export interface Event {
  $id: string;  // Internal ID used by the app
  id?: string;  // Optional external id (will match $id when present)
  title: string;
  location: string;
  startTime: string; // ISO format
  endTime: string;   // ISO format
  creatorId: string;
  // Note: legacy arrays (inviteeIds/attendees) were removed as part of the junction-table migration.
  // These optional fields are temporarily present as deprecated compatibility shims so the
  // UI can be migrated incrementally. Remove these once the codebase no longer depends on them.
  inviteeIds?: string[]; // DEPRECATED: use getEventInvitees / inviteCount instead
  attendees?: string[]; // DEPRECATED: use getEventAttendees / attendeeCount instead
  description?: string;
  tags: string[]; // Event categories/tags (sports, music, art, etc.)
  isPrivate?: boolean; // Whether the event is private (only visible to invitees)
  groupId?: string; // Optional group ID if event belongs to a group
  groupName?: string; // Optional group name for display (computed field)
  // Optimized fields for enterprise scalability
  attendeeCount?: number; // Count of confirmed attendees (performance counter)
  inviteCount?: number; // Count of sent invites (performance counter)
  viewCount?: number; // Number of views (engagement metric)
  popularityScore?: number; // Computed popularity score (0.0-1.0)
  responseRate?: boolean; // Whether responses are being tracked
  lastActivityAt?: string; // ISO timestamp of last activity
}

export interface EventWithDetails extends Event {
  description: string;
}