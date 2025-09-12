import { config } from '@/lib/appwrite/appwrite';

console.log('=== Event Attendances Configuration Debug ===');
console.log('eventAttendancesCollectionID:', config.eventAttendancesCollectionID);
console.log('Environment variable:', process.env.EXPO_PUBLIC_APPWRITE_EVENTATTENDANCES_COLLECTION_ID);
console.log('Is temp/placeholder?:', config.eventAttendancesCollectionID?.includes('temp_') || config.eventAttendancesCollectionID === 'temp_attendances_id' || config.eventAttendancesCollectionID === 'event_attendances');

// Test the junction table check logic
const isJunctionTableConfigured = () => {
    const collectionId = config.eventAttendancesCollectionID;
    return !(
        !collectionId ||
        collectionId.includes('temp_') ||
        collectionId === 'temp_attendances_id' ||
        collectionId === 'event_attendances'  // This should be added to the check
    );
};

console.log('Junction table configured correctly?:', isJunctionTableConfigured());

export default function DebugAttendances() {
    return null;
}
