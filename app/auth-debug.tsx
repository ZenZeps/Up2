import { AuthDebugger } from '@/components/debug/AuthDebugger';
import React, { memo } from 'react';

// Memoized component for better performance
const AuthDebug = memo(() => {
    return <AuthDebugger />;
});

AuthDebug.displayName = 'AuthDebug';

export default AuthDebug;
