// Simple debug to check what travel collection ID is being used
import { config } from '@/lib/appwrite/appwrite';

console.log('🔍 TRAVEL COLLECTION ID DEBUG');
console.log('Environment variable EXPO_PUBLIC_APPWRITE_TRAVEL_COLLECTION_ID:', process.env.EXPO_PUBLIC_APPWRITE_TRAVEL_COLLECTION_ID);
console.log('Config travelCollectionID:', config.travelCollectionID);
console.log('Are they the same?', process.env.EXPO_PUBLIC_APPWRITE_TRAVEL_COLLECTION_ID === config.travelCollectionID);

export { };

