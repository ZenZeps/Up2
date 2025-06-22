export interface UserProfile {
  id: string;
  name: string;
  isPublic: boolean;
  preferences: string[]; // ['sports', 'party', ...]
}