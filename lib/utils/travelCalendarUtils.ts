import { TravelAnnouncement } from '@/lib/types/Travel';
import dayjs from 'dayjs';

/**
 * Check if a specific date falls within any travel period
 */
export const isDateInTravelPeriod = (date: Date, travelData: TravelAnnouncement[]): boolean => {
    const checkDate = dayjs(date).format('YYYY-MM-DD');

    return travelData.some(travel => {
        const startDate = dayjs(travel.startDate).format('YYYY-MM-DD');
        const endDate = dayjs(travel.endDate).format('YYYY-MM-DD');

        return checkDate >= startDate && checkDate <= endDate;
    });
};

/**
 * Get all travel dates within a date range
 */
export const getTravelDatesInRange = (
    startDate: Date,
    endDate: Date,
    travelData: TravelAnnouncement[]
): Date[] => {
    const travelDates: Date[] = [];
    const current = dayjs(startDate);
    const end = dayjs(endDate);

    while (current.isBefore(end) || current.isSame(end, 'day')) {
        if (isDateInTravelPeriod(current.toDate(), travelData)) {
            travelDates.push(current.toDate());
        }
        current.add(1, 'day');
    }

    return travelDates;
};

/**
 * Generate calendar styling for travel dates
 */
export const generateTravelCalendarStyles = (travelData: TravelAnnouncement[]) => {
    return {
        // Week view styles
        weekView: {
            headerContainerStyle: {
                backgroundColor: '#f8f9fa',
            },
            // This will be applied to date headers when they match travel dates
            travelDateHeaderStyle: {
                backgroundColor: '#667eea20', // Gradient color with transparency
                borderRadius: 4,
                marginHorizontal: 2,
            }
        },
        // Month view styles  
        monthView: {
            travelDateStyle: {
                backgroundColor: '#667eea20', // Gradient color with transparency
                borderRadius: 4,
            },
            travelDateTextStyle: {
                color: '#667eea', // Main gradient color for text
                fontWeight: '600',
            }
        }
    };
};

/**
 * Get travel announcement for a specific date (for tooltips/details)
 */
export const getTravelForDate = (date: Date, travelData: TravelAnnouncement[]): TravelAnnouncement | null => {
    const checkDate = dayjs(date).format('YYYY-MM-DD');

    return travelData.find(travel => {
        const startDate = dayjs(travel.startDate).format('YYYY-MM-DD');
        const endDate = dayjs(travel.endDate).format('YYYY-MM-DD');

        return checkDate >= startDate && checkDate <= endDate;
    }) || null;
};
