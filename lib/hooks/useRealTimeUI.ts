import { realTimeUI } from '@/lib/utils/realTimeUI';
import { useEffect, useState } from 'react';

/**
 * Hook to force a rerender when RealTimeUI pending actions change.
 * Returns a tick number you can include in memo/useEffect deps.
 */
export function useRealTimeUI(): number {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const unsubscribe = realTimeUI.addListener(() => setTick(t => t + 1));
        return unsubscribe;
    }, []);

    return tick;
}
