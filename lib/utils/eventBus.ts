type Callback = (...args: any[]) => void;

const listeners: Record<string, Callback[]> = {};

export const on = (event: string, cb: Callback) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
    return () => off(event, cb);
};

export const off = (event: string, cb: Callback) => {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter((c) => c !== cb);
};

export const emit = (event: string, ...args: any[]) => {
    const handlers = listeners[event] || [];
    handlers.forEach((h) => {
        try {
            h(...args);
        } catch (err) {
            console.error('eventBus handler error', err);
        }
    });
};

export default { on, off, emit };
