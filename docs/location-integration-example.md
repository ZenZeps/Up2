// Example integration for EventForm.tsx
import { geocodeLocation } from '@/lib/utils/locationUtils';

// Add this to your event creation process:
const handleCreateEvent = async (eventData) => {
  // Geocode the location to get coordinates
  const coordinates = await geocodeLocation(eventData.location);
  
  const eventWithCoordinates = {
    ...eventData,
    latitude: coordinates?.latitude || null,
    longitude: coordinates?.longitude || null,
  };

  // Save event with coordinates
  await createEvent(eventWithCoordinates);
};
