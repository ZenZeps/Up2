import { Event as AppEvent } from '@/lib/types/Events';

// Heuristic to determine if a user appears to be attending an event
export function isUserAttendingHeuristic(event: AppEvent | any, userId?: string): boolean {
    if (!userId) return false;
    if (!event) return false;

    try {
        if (event.creatorId === userId) return true;
        const anyEv: any = event as any;
        if (anyEv.isAttending) return true;
        if (Array.isArray(anyEv.attendees) && anyEv.attendees.includes(userId)) return true;
        if (Array.isArray(anyEv.inviteeIds) && anyEv.inviteeIds.includes(userId)) return true;
        if (Array.isArray(anyEv.attendeeIds) && anyEv.attendeeIds.includes(userId)) return true;
    } catch (err) {
        // Be conservative on errors
        return false;
    }

    return false;
}

// Simple helper to check if an event is still upcoming
export function isEventUpcoming(event: AppEvent | any): boolean {
    if (!event) return false;
    const end = (event as any).endTime || (event as any).startTime || (event as any).date;
    if (!end) return false;
    try {
        return new Date(end) > new Date();
    } catch (err) {
        return false;
    }
}
