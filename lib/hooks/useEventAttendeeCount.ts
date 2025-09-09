/**
 * Hook to get accurate attendee count for events
 * Falls back to junction table if stored count seems inaccurate
 */

import { getEventAttendees } from '@/lib/api/event';
import { useEffect, useState } from 'react';

interface EventAttendeeCount {
    [eventId: string]: number;
}

export function useEventAttendeeCount(events: any[], fallbackToJunction: boolean = true) {
    const [attendeeCounts, setAttendeeCounts] = useState<EventAttendeeCount>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!events || events.length === 0 || !fallbackToJunction) return;

        const fetchCounts = async () => {
            setLoading(true);
            const newCounts: EventAttendeeCount = {};

            // Check which events might need junction table lookup
            const eventsToCheck = events.filter(event =>
                typeof event.attendeeCount !== 'number' || event.attendeeCount === 0
            );

            if (eventsToCheck.length === 0) {
                setLoading(false);
                return;
            }

            // Fetch real counts from junction tables
            await Promise.all(
                eventsToCheck.slice(0, 10).map(async (event) => { // Limit to first 10 to avoid overwhelming
                    try {
                        const attendeeIds = await getEventAttendees(event.$id);
                        newCounts[event.$id] = attendeeIds.length;
                    } catch (error) {
                        // Fallback to stored count
                        newCounts[event.$id] = event.attendeeCount || 0;
                    }
                })
            );

            setAttendeeCounts(newCounts);
            setLoading(false);
        };

        fetchCounts();
    }, [events, fallbackToJunction]);

    const getAttendeeCount = (event: any): number => {
        // First try our fetched count
        if (attendeeCounts[event.$id] !== undefined) {
            return attendeeCounts[event.$id];
        }

        // Then try stored count
        if (typeof event.attendeeCount === 'number' && event.attendeeCount > 0) {
            return event.attendeeCount;
        }

        // Fallback to legacy attendees array
        if (Array.isArray(event.attendees)) {
            return event.attendees.length;
        }

        return 0;
    };

    return { getAttendeeCount, loading };
}
