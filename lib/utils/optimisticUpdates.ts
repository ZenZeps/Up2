/**
 * Optimistic Updates Manager
 * 
 * Manages local state changes for user actions (attend/unattend) to provide
 * instant UI feedback while reducing database reads.
 */

export type AttendanceAction = 'attend' | 'unattend';

interface OptimisticUpdate {
    eventId: string;
    action: AttendanceAction;
    timestamp: number;
    applied: boolean;
}

interface LocalAttendanceState {
    userId: string;
    attendingEventIds: Set<string>;
    pendingUpdates: Map<string, OptimisticUpdate>;
    lastDbSync: number;
}

class OptimisticUpdatesManager {
    private static instance: OptimisticUpdatesManager;
    private userStates = new Map<string, LocalAttendanceState>();

    public static getInstance(): OptimisticUpdatesManager {
        if (!OptimisticUpdatesManager.instance) {
            OptimisticUpdatesManager.instance = new OptimisticUpdatesManager();
        }
        return OptimisticUpdatesManager.instance;
    }

    /**
     * Initialize user's attendance state
     */
    initializeUser(userId: string, attendingEventIds: string[] = []): void {
        this.userStates.set(userId, {
            userId,
            attendingEventIds: new Set(attendingEventIds),
            pendingUpdates: new Map(),
            lastDbSync: Date.now()
        });
    }

    /**
     * Get user's current attendance state (including optimistic updates)
     */
    getUserAttendanceState(userId: string): Set<string> {
        const state = this.userStates.get(userId);
        if (!state) {
            console.warn(`OptimisticUpdates: User ${userId} not initialized`);
            return new Set();
        }

        // Start with the base attendance set
        const result = new Set(state.attendingEventIds);

        // Apply pending updates
        for (const [eventId, update] of state.pendingUpdates) {
            if (update.action === 'attend') {
                result.add(eventId);
            } else if (update.action === 'unattend') {
                result.delete(eventId);
            }
        }

        return result;
    }

    /**
     * Check if user is attending an event (with optimistic updates)
     */
    isUserAttending(userId: string, eventId: string): boolean {
        const attendanceState = this.getUserAttendanceState(userId);
        return attendanceState.has(eventId);
    }

    /**
     * Apply optimistic update for user action
     */
    applyOptimisticUpdate(userId: string, eventId: string, action: AttendanceAction): void {
        const state = this.userStates.get(userId);
        if (!state) {
            console.warn(`OptimisticUpdates: User ${userId} not initialized, initializing now`);
            this.initializeUser(userId);
            return this.applyOptimisticUpdate(userId, eventId, action);
        }

        // Add or update pending change
        state.pendingUpdates.set(eventId, {
            eventId,
            action,
            timestamp: Date.now(),
            applied: false
        });

        console.log(`OptimisticUpdates: Applied ${action} for event ${eventId} (user: ${userId})`);
    }

    /**
     * Sync with database data (reconciliation)
     */
    syncWithDatabase(userId: string, realAttendingEventIds: string[]): void {
        const state = this.userStates.get(userId);
        if (!state) {
            console.warn(`OptimisticUpdates: User ${userId} not initialized during sync`);
            this.initializeUser(userId, realAttendingEventIds);
            return;
        }

        // Update base state with real database data
        state.attendingEventIds = new Set(realAttendingEventIds);
        state.lastDbSync = Date.now();

        // Clear confirmed updates
        const confirmedUpdates: string[] = [];
        for (const [eventId, update] of state.pendingUpdates) {
            const isCurrentlyAttending = state.attendingEventIds.has(eventId);
            const expectedAfterUpdate = update.action === 'attend';

            if (isCurrentlyAttending === expectedAfterUpdate) {
                // Update was successfully applied in database
                confirmedUpdates.push(eventId);
            }
        }

        // Remove confirmed updates
        confirmedUpdates.forEach(eventId => state.pendingUpdates.delete(eventId));

        console.log(`OptimisticUpdates: Synced user ${userId} with database. Confirmed ${confirmedUpdates.length} updates, ${state.pendingUpdates.size} pending`);
    }

    /**
     * Handle failed update (rollback)
     */
    rollbackUpdate(userId: string, eventId: string): void {
        const state = this.userStates.get(userId);
        if (!state) return;

        state.pendingUpdates.delete(eventId);
        console.log(`OptimisticUpdates: Rolled back update for event ${eventId} (user: ${userId})`);
    }

    /**
     * Get pending updates for a user
     */
    getPendingUpdates(userId: string): OptimisticUpdate[] {
        const state = this.userStates.get(userId);
        if (!state) return [];

        return Array.from(state.pendingUpdates.values());
    }

    /**
     * Clear all pending updates for a user (useful for full refresh)
     */
    clearPendingUpdates(userId: string): void {
        const state = this.userStates.get(userId);
        if (!state) return;

        state.pendingUpdates.clear();
        console.log(`OptimisticUpdates: Cleared all pending updates for user ${userId}`);
    }

    /**
     * Filter events based on user attendance (with optimistic updates)
     */
    filterEventsByAttendance(
        userId: string,
        events: any[],
        showAttending: boolean = true
    ): any[] {
        const attendanceState = this.getUserAttendanceState(userId);

        return events.filter(event => {
            const isAttending = attendanceState.has(event.$id);
            return showAttending ? isAttending : !isAttending;
        });
    }

    /**
     * Add attendance metadata to events
     */
    enrichEventsWithAttendance(userId: string, events: any[]): any[] {
        const attendanceState = this.getUserAttendanceState(userId);

        return events.map(event => ({
            ...event,
            isAttending: attendanceState.has(event.$id),
            attendeeCount: this.calculateOptimisticAttendeeCount(event)
        }));
    }

    /**
     * Calculate optimistic attendee count (optional feature)
     */
    private calculateOptimisticAttendeeCount(event: any): number {
        // For now, just return existing count
        // Could be enhanced to track optimistic changes to attendee counts
        return typeof event.attendeeCount === 'number' ? event.attendeeCount :
            Array.isArray(event.attendees) ? event.attendees.length : 0;
    }

    /**
     * Debug: Get full state for a user
     */
    getDebugState(userId: string): any {
        const state = this.userStates.get(userId);
        if (!state) return null;

        return {
            userId,
            baseAttending: Array.from(state.attendingEventIds),
            pendingUpdates: Array.from(state.pendingUpdates.entries()),
            currentAttending: Array.from(this.getUserAttendanceState(userId)),
            lastSync: new Date(state.lastDbSync).toISOString()
        };
    }
}

// Export singleton instance
export const optimisticUpdates = OptimisticUpdatesManager.getInstance();

// Helper functions for easier usage
export const initializeUserAttendance = (userId: string, attendingEventIds: string[]) => {
    optimisticUpdates.initializeUser(userId, attendingEventIds);
};

export const isUserAttendingOptimistic = (userId: string, eventId: string): boolean => {
    return optimisticUpdates.isUserAttending(userId, eventId);
};

export const applyOptimisticAttendance = (userId: string, eventId: string, action: AttendanceAction) => {
    optimisticUpdates.applyOptimisticUpdate(userId, eventId, action);
};

export const syncAttendanceWithDB = (userId: string, realAttendingEventIds: string[]) => {
    optimisticUpdates.syncWithDatabase(userId, realAttendingEventIds);
};

export const filterEventsOptimistic = (userId: string, events: any[], showAttending: boolean = true): any[] => {
    return optimisticUpdates.filterEventsByAttendance(userId, events, showAttending);
};

export const enrichEventsOptimistic = (userId: string, events: any[]): any[] => {
    return optimisticUpdates.enrichEventsWithAttendance(userId, events);
};
