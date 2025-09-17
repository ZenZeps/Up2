import { getEventColor } from '@/constants/categories';
import { Event as AppEvent } from '@/lib/types/Events';
import { TravelAnnouncement } from '@/lib/types/Travel';

// Validate event for calendar rendering
export const isValidCalendarEvent = (event: AppEvent): boolean => {
    if (!event || typeof event !== 'object') return false;

    // Validate that start and end times are valid dates
    const startValid = event.startTime && !isNaN(new Date(event.startTime).getTime());
    const endValid = event.endTime && !isNaN(new Date(event.endTime).getTime());

    return Boolean(startValid && endValid);
};

// Transform events for calendar display
export const transformEventForCalendar = (
    event: AppEvent,
    getCreatorName: (id: string) => string,
    userTravelData: TravelAnnouncement[] = []
) => {
    const startDate = new Date(event.startTime);
    const endDate = new Date(event.endTime);
    const eventColor = getEventColor((event as any).category || 'other');
    const creatorName = getCreatorName(event.creatorId);

    // Check if the event occurs during a travel period
    const isDuringTravel = userTravelData.some(travel => {
        const travelStart = new Date(travel.startDate);
        const travelEnd = new Date(travel.endDate);
        return startDate >= travelStart && startDate <= travelEnd;
    });

    return {
        title: `${event.title}${creatorName ? ` (${creatorName})` : ''}`,
        start: startDate,
        end: endDate,
        color: eventColor,
        rawEvent: event,
        isDuringTravel
    };
};

// Process calendar events with error handling and filtering
export const processCalendarEvents = (
    events: AppEvent[],
    getCreatorName: (id: string) => string,
    userTravelData: TravelAnnouncement[] = []
): any[] => {
    if (!events || !Array.isArray(events)) return [];

    // Process regular events
    const processedEvents = events
        .filter(isValidCalendarEvent)
        .map(event => transformEventForCalendar(event, getCreatorName, userTravelData))
        .filter(Boolean); // Remove any null/undefined results

    // Add travel periods as all-day calendar events for visual indication
    const travelEvents = userTravelData.map(travel => {
        const travelStart = new Date(travel.startDate);
        const travelEnd = new Date(travel.endDate);

        // Set to beginning and end of day for all-day events
        travelStart.setHours(0, 0, 0, 0);
        travelEnd.setHours(23, 59, 59, 999);

        return {
            title: `✈️ ${travel.destination}`,
            start: travelStart,
            end: travelEnd,
            color: '#9CA3AF', // Grey color for travel indication
            isTravel: true,
            rawTravel: travel,
            allDay: true
        };
    });

    return [...processedEvents, ...travelEvents];
};

// Custom date renderer for travel periods
export const createCustomDateRenderer = (
    userTravelData: TravelAnnouncement[],
    colors: any
) => {
    return (date: Date) => {
        const isTravel = userTravelData.some(travel => {
            const travelStart = new Date(travel.startDate);
            const travelEnd = new Date(travel.endDate);
            return date >= travelStart && date <= travelEnd;
        });

        const isToday = date.toDateString() === new Date().toDateString();

        // Return style configuration instead of JSX
        return {
            backgroundColor: isTravel ? colors.primary + '20' : 'transparent',
            borderRadius: isTravel ? 12 : 0,
            borderWidth: isTravel ? 1 : 0,
            borderColor: isTravel ? colors.primary : 'transparent',
        };
    };
};

// Event validation for rendering
export const validateEventForRender = (event: any): boolean => {
    if (!event) {
        console.warn('renderEvent: event is null or undefined');
        return false;
    }

    if (!event.rawEvent) {
        console.warn('renderEvent: event.rawEvent is null or undefined');
        return false;
    }

    if (!event.rawEvent.$id) {
        console.warn('renderEvent: event.rawEvent.$id is missing');
        return false;
    }

    if (!event.rawEvent.title) {
        console.warn('renderEvent: event.rawEvent.title is missing');
        return false;
    }

    return true;
};
