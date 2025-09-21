export interface UserProfile {
  $id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  isPublic: boolean;
  preferences: string[];
  friends?: string[];
  photoId?: string;
  age?: number;
  about?: string;
  nationality?: string;
  notificationToken?: string;
  notificationsEnabled?: boolean;
  accountStatus?: string;
  language?: string;
  blocked?: string[];
  friendCount?: number;
  groupCount?: number;
  popularityScore?: number;
  lastLocationLat?: number;
  lastLocationLng?: number;
}