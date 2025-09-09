import { addEventAttendee, removeEventAttendee } from '@/lib/api/event';
import { Event as AppEvent } from '@/lib/types/Events';
import { realTimeUI } from './realTimeUI';

// Smart refetch function with rate limiting
export const createSmartRefetch = (
  refetchEvents: () => Promise<any>,
  lastFetchTimeRef: React.MutableRefObject<number>,
  hasInitialLoadRef: React.MutableRefObject<boolean>
) => {
  return async (reason: 'navigation' | 'viewModeChange' | 'manual' = 'manual') => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    const minFetchInterval = 30 * 1000; // Minimum 30 seconds between automatic fetches

    // For manual triggers (like creating/editing events), always fetch
    if (reason === 'manual') {
      lastFetchTimeRef.current = now;
      return await refetchEvents();
    }

    // For navigation and view mode changes, respect minimum interval unless it's the first load
    if (!hasInitialLoadRef.current || timeSinceLastFetch > minFetchInterval) {
      lastFetchTimeRef.current = now;
      hasInitialLoadRef.current = true;
      return await refetchEvents();
    }
  };
};

// Event attendance handlers with real-time UI support
export const createEventAttendanceHandlers = (
  currentUser: any,
  selectedEvent: AppEvent | null,
  userAttendingEvents: AppEvent[],
  setUserAttendingEvents: (events: AppEvent[]) => void,
  recordAction: (action: string, reason: string) => Promise<void>
) => {
  const handleEventAttend = async () => {
    if (!selectedEvent || !currentUser?.$id) return;

    // Apply immediate UI feedback via realTimeUI
    realTimeUI.applyAction(selectedEvent.$id, 'attend');

    // Update local state immediately
    const updatedEvents = [...userAttendingEvents, selectedEvent];
    setUserAttendingEvents(updatedEvents);

    try {
      // Perform the actual database update
      await addEventAttendee(selectedEvent.$id, currentUser.$id);

      // Record the action for cache invalidation
      await recordAction('attend', 'home_event_attended');
    } catch (error) {
      console.error('Error attending event:', error);

      // Rollback on failure - remove from local state
      const rolledBackEvents = userAttendingEvents.filter(e => e.$id !== selectedEvent.$id);
      setUserAttendingEvents(rolledBackEvents);
    }
  };

  const handleEventNotAttend = async () => {
    if (!selectedEvent || !currentUser?.$id) return;

    // Apply immediate UI feedback via realTimeUI
    realTimeUI.applyAction(selectedEvent.$id, 'unattend');

    // Update local state immediately
    const updatedEvents = userAttendingEvents.filter(e => e.$id !== selectedEvent.$id);
    setUserAttendingEvents(updatedEvents);

    try {
      // Perform the actual database update
      await removeEventAttendee(selectedEvent.$id, currentUser.$id);

      // Record the action for cache invalidation
      await recordAction('unattend', 'home_event_unattended');
    } catch (error) {
      console.error('Error not attending event:', error);

      // Rollback on failure - add back to local state
      const rolledBackEvents = [...userAttendingEvents, selectedEvent];
      setUserAttendingEvents(rolledBackEvents);
    }
  };

  return { handleEventAttend, handleEventNotAttend };
};

// Event press handler with validation
export const createEventPressHandler = (
  setSelectedEvent: (event: AppEvent | null) => void,
  setDetailsModalVisible: (visible: boolean) => void
) => {
  return (event: any) => {
    try {
      if (!event) {
        console.warn('handlePressEvent: event is null or undefined');
        return;
      }

      if (!event.rawEvent) {
        console.warn('handlePressEvent: event.rawEvent is null or undefined');
        return;
      }

      // Validate that the raw event has required properties
      if (!event.rawEvent.$id) {
        console.warn('handlePressEvent: event.rawEvent.$id is missing');
        return;
      }

      setSelectedEvent(event.rawEvent as AppEvent);
      setDetailsModalVisible(true);
    } catch (error) {
      console.error('Error in handlePressEvent:', error);
      // Don't crash the app, just log the error
    }
  };
};
