// Global error handler for unhandled JavaScript errors
export const setupGlobalErrorHandler = () => {
    // Handle unhandled promise rejections
    const globalObj = global as any;
    const originalHandler = globalObj.ErrorUtils?.getGlobalHandler();

    if (globalObj.ErrorUtils) {
        globalObj.ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
            console.error('Global error caught:', {
                error,
                isFatal,
                stack: error?.stack,
                message: error?.message,
                name: error?.name
            });

            // Log specific event-related errors
            if (error?.message?.includes('event') || error?.message?.includes('Event')) {
                console.error('Event-related global error:', {
                    error: error?.message,
                    stack: error?.stack
                });
            }

            // Call the original handler if it exists
            if (originalHandler) {
                originalHandler(error, isFatal);
            } else {
                // Default behavior - log the error but don't crash the app
                console.error('Unhandled error:', error);
            }
        });
    }

    // Handle unhandled promise rejections
    if (typeof global.addEventListener === 'function') {
        global.addEventListener('unhandledrejection', (event: any) => {
            console.error('Unhandled promise rejection:', event.reason);

            // Prevent the default behavior of crashing the app
            event.preventDefault();
        });
    }
};

// Call this in your app's entry point
setupGlobalErrorHandler();
