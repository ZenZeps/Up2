import { createContext, ReactNode, useContext, useEffect } from "react";
import { account, getCurrentUserWithProfile } from "./appwrite/appwrite";
import { useAppwrite } from "./appwrite/useAppwrite";
import { authDebug } from "./debug/authDebug";
import { UserProfile } from "./types/Users";

interface User {
    $id: string;
    name: string;
    email: string;
    avatar: string;
    profile?: UserProfile | null; // Add the full profile data
}
interface GlobalContextType {
    isLoggedIn: boolean;
    user: User | null;
    loading: boolean;
    refetch: (newParams?: Record<string, string | number>) => Promise<void>;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined)

export const GlobalProvider = ({ children }: { children: ReactNode }) => {
    const {
        data: user,
        loading,
        refetch,
        error
    } = useAppwrite({
        fn: getCurrentUserWithProfile as unknown as (params?: Record<string, string | number>) => Promise<User>,
        cacheTTL: 5 * 60 * 1000, // 5 minutes cache for auth state
        disableCache: false, // Enable caching for better performance
        skip: false, // Don't skip the initial call
    });

    const isLoggedIn = !!user; // If you call ! on null then it is true. Turns nulls into booleans.

    // Log authentication status for debugging
    useEffect(() => {
        // Only log if we're not in a loading state
        if (!loading) {
            authDebug.logAuthState(isLoggedIn, loading);

            if (isLoggedIn && user) {
                authDebug.info(`User authenticated: ${user.$id}`);
            } else {
                if (error) {
                    authDebug.info(`Not authenticated: ${error}`);
                } else {
                    authDebug.info("Not authenticated (no error)");
                }

                // For debugging only - check if we have active sessions (with error handling)
                account.listSessions()
                    .then(sessions => {
                        if (sessions.sessions.length > 0) {
                            authDebug.warn(`Found ${sessions.sessions.length} active session(s) but user is not authenticated!`,
                                sessions.sessions.map(s => ({
                                    id: s.$id,
                                    provider: s.provider,
                                    expire: new Date(Number(s.expire) * 1000).toLocaleString()
                                }))
                            );
                        } else {
                            authDebug.info("No active sessions found");
                        }
                    })
                    .catch(err => {
                        // This error is expected for non-authenticated users
                        const errMsg = err?.message || String(err);
                        if (!errMsg.includes('missing scope') && !errMsg.includes('User (role: guests)')) {
                            authDebug.error("Error checking sessions", err);
                        }
                    });
            }
        }
    }, [isLoggedIn, loading, user, error]);

    return (
        <GlobalContext.Provider value={{
            isLoggedIn,
            user,
            loading,
            refetch,
        }}>
            {children}
        </GlobalContext.Provider>
    )
}

export const useGlobalContext = (): GlobalContextType => {
    const context = useContext(GlobalContext);

    if (!context) {
        throw new Error('useGlobalContext must be used within a Global Provider');

    }
    return context;
}

export default GlobalProvider;