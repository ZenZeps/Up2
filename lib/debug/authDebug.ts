/**
 * Auth Debug Utility
 * This file provides debugging tools for authentication flows
 */
import { Platform } from 'react-native';

// Define log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Configure which levels to output
const ENABLED_LEVELS: LogLevel[] = ['info', 'warn', 'error', 'debug'];
const DEBUG_PREFIX = '🔐 Auth';

// Check if we're in development mode
const isDev = __DEV__;

// Track auth metrics
interface AuthMetrics {
    loginAttempts: number;
    loginSuccesses: number;
    loginFailures: number;
    signupAttempts: number;
    signupSuccesses: number;
    signupFailures: number;
    verificationAttempts: number;
    verificationSuccesses: number;
    passwordResetRequests: number;
    sessionRefreshes: number;
    lastActivity: number;
}

// Initialize metrics
const metrics: AuthMetrics = {
    loginAttempts: 0,
    loginSuccesses: 0,
    loginFailures: 0,
    signupAttempts: 0,
    signupSuccesses: 0,
    signupFailures: 0,
    verificationAttempts: 0,
    verificationSuccesses: 0,
    passwordResetRequests: 0,
    sessionRefreshes: 0,
    lastActivity: Date.now()
};

// List of sensitive fields that should be masked in logs
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken'];

// Mask sensitive data in objects
const maskSensitiveData = (data: any): any => {
    if (!data || typeof data !== 'object') {
        return data;
    }

    const result = Array.isArray(data) ? [...data] : { ...data };

    Object.keys(result).forEach(key => {
        if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
            result[key] = '***MASKED***';
        } else if (typeof result[key] === 'object' && result[key] !== null) {
            result[key] = maskSensitiveData(result[key]);
        }
    });

    return result;
};

export const authDebug = {
    debug: (message: string, data?: any) => {
        if (isDev && ENABLED_LEVELS.includes('debug')) {
            console.log(`${DEBUG_PREFIX} [DEBUG]: ${message}`, data !== undefined ? maskSensitiveData(data) : '');
        }
    },

    info: (message: string, data?: any) => {
        if (isDev && ENABLED_LEVELS.includes('info')) {
            console.log(`${DEBUG_PREFIX} [INFO]: ${message}`, data !== undefined ? maskSensitiveData(data) : '');
        }
    },

    warn: (message: string, data?: any) => {
        if (ENABLED_LEVELS.includes('warn')) {
            console.warn(`${DEBUG_PREFIX} [WARN]: ${message}`, data !== undefined ? maskSensitiveData(data) : '');
        }
    },

    error: (message: string, error?: any) => {
        if (ENABLED_LEVELS.includes('error')) {
            console.error(`${DEBUG_PREFIX} [ERROR]: ${message}`, error !== undefined ? maskSensitiveData(error) : '');
        }
    },

    // Special function to safely log user objects without exposing sensitive data
    logUser: (user: any) => {
        if (!user) {
            authDebug.info('User object is null or undefined');
            return;
        }

        // Extract and log only non-sensitive fields
        const safeUserData = {
            $id: user.$id,
            name: user.name,
            email: user.email ? `${user.email.substring(0, 3)}****` : null,
            emailVerification: user.emailVerification,
            status: user.status,
        };

        authDebug.info('User data:', safeUserData);
    },

    // Log authentication state
    logAuthState: (isLoggedIn: boolean, isLoading: boolean) => {
        authDebug.info(`Auth state: isLoggedIn=${isLoggedIn}, isLoading=${isLoading}`);
    },

    // Record login attempt
    recordLoginAttempt: (success: boolean, reason?: string) => {
        metrics.loginAttempts++;
        metrics.lastActivity = Date.now();

        if (success) {
            metrics.loginSuccesses++;
            authDebug.info('Login successful');
        } else {
            metrics.loginFailures++;
            authDebug.warn(`Login failed: ${reason || 'Unknown reason'}`);
        }
    },

    // Record signup attempt
    recordSignupAttempt: (success: boolean, reason?: string) => {
        metrics.signupAttempts++;
        metrics.lastActivity = Date.now();

        if (success) {
            metrics.signupSuccesses++;
            authDebug.info('Signup successful');
        } else {
            metrics.signupFailures++;
            authDebug.warn(`Signup failed: ${reason || 'Unknown reason'}`);
        }
    },

    // Record verification attempt
    recordVerificationAttempt: (success: boolean) => {
        metrics.verificationAttempts++;

        if (success) {
            metrics.verificationSuccesses++;
            authDebug.info('Verification successful');
        } else {
            authDebug.warn('Verification failed');
        }
    },

    // Record password reset request
    recordPasswordResetRequest: () => {
        metrics.passwordResetRequests++;
        authDebug.info('Password reset requested');
    },

    // Record session refresh
    recordSessionRefresh: () => {
        metrics.sessionRefreshes++;
        authDebug.debug('Session refreshed');
    },

    // Get auth metrics
    getMetrics: () => {
        return {
            ...metrics,
            successRate: metrics.loginAttempts > 0
                ? (metrics.loginSuccesses / metrics.loginAttempts) * 100
                : 0,
            signupConversionRate: metrics.signupAttempts > 0
                ? (metrics.signupSuccesses / metrics.signupAttempts) * 100
                : 0,
            verificationRate: metrics.verificationAttempts > 0
                ? (metrics.verificationSuccesses / metrics.verificationAttempts) * 100
                : 0,
            platform: Platform.OS,
            version: Platform.Version,
            isExpo: Platform.constants && 'expoVersion' in Platform.constants,
        };
    },

    // Reset metrics
    resetMetrics: () => {
        Object.keys(metrics).forEach(key => {
            (metrics as any)[key] = 0;
        });
        metrics.lastActivity = Date.now();
        authDebug.info('Auth metrics reset');
    }
};
