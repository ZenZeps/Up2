/**
 * Real-time UI Updates Manager
 * 
 * Simple state manager for immediate UI feedback on attend/unattend actions
 * without complex optimistic update reconciliation.
 */

interface PendingAction {
    eventId: string;
    action: 'attend' | 'unattend';
    timestamp: number;
}

class RealTimeUIManager {
    private static instance: RealTimeUIManager;
    private pendingActions = new Map<string, PendingAction>(); // eventId -> action
    private listeners = new Set<() => void>();

    public static getInstance(): RealTimeUIManager {
        if (!RealTimeUIManager.instance) {
            RealTimeUIManager.instance = new RealTimeUIManager();
        }
        return RealTimeUIManager.instance;
    }

    /**
     * Get the pending action for a specific event, if any
     */
    getPendingAction(eventId: string): PendingAction | undefined {
        return this.pendingActions.get(eventId);
    }

    /**
     * Get a list of eventIds that have the given pending action type
     */
    getEventIdsByAction(action: 'attend' | 'unattend'): string[] {
        const ids: string[] = [];
        this.pendingActions.forEach((pa, id) => { if (pa.action === action) ids.push(id); });
        return ids;
    }

    /**
     * Apply immediate UI change
     */
    applyAction(eventId: string, action: 'attend' | 'unattend'): void {
        this.pendingActions.set(eventId, {
            eventId,
            action,
            timestamp: Date.now()
        });

        console.log(`🔥 RealTimeUI: Applied ${action} for event ${eventId}. Total pending: ${this.pendingActions.size}`);
        this.notifyListeners();
    }

    /**
     * Remove pending action (when confirmed or failed)
     */
    clearAction(eventId: string): void {
        const removed = this.pendingActions.delete(eventId);
        if (removed) {
            console.log(`🔥 RealTimeUI: Cleared action for event ${eventId}. Total pending: ${this.pendingActions.size}`);
            this.notifyListeners();
        }
    }

    /**
     * Check if user should be shown as attending (including pending actions)
     */
    isUserAttending(eventId: string, baseAttending: boolean): boolean {
        const pending = this.pendingActions.get(eventId);
        if (!pending) return baseAttending;

        // Apply pending action
        if (pending.action === 'attend') return true;
        if (pending.action === 'unattend') return false;

        return baseAttending;
    }

    /**
     * Filter events based on attendance including pending actions
     */
    filterEvents(events: any[], showAttending: boolean, baseAttendingIds: Set<string>): any[] {
        return events.filter(event => {
            const shouldShow = this.isUserAttending(event.$id, baseAttendingIds.has(event.$id));
            return showAttending ? shouldShow : !shouldShow;
        });
    }

    /**
     * Add listener for UI updates
     */
    addListener(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify all listeners of changes
     */
    private notifyListeners(): void {
        this.listeners.forEach(listener => {
            try {
                listener();
            } catch (error) {
                console.error('RealTimeUI: Error in listener:', error);
            }
        });
    }

    /**
     * Get debug info
     */
    getDebugInfo(): any {
        return {
            pendingActions: Array.from(this.pendingActions.entries()),
            listenerCount: this.listeners.size
        };
    }

    /**
     * Clear all pending actions
     */
    clearAll(): void {
        this.pendingActions.clear();
        this.notifyListeners();
    }
}

export const realTimeUI = RealTimeUIManager.getInstance();
