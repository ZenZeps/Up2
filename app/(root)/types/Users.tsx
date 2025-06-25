export interface UserProfile {
  id: string;
  name: string;
  email: string;
  isPublic: boolean;
  preferences: string[];
}