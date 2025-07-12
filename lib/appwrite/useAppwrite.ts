// Custom Hook
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { authDebug } from "../debug/authDebug";
import { cacheManager } from "../debug/cacheManager";
import { dbUsageMonitor } from "../debug/dbUsageMonitor";

// Rate limit configuration (calls per minute)
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000; // 1 minute window
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY = 300; // 300ms debounce

// Rate limiter tracking
interface RateLimiter {
  calls: number;
  resetTime: number;
}
const rateLimiters = new Map<string, RateLimiter>();

// Debounce utility
function useDebounce<T extends (...args: any[]) => Promise<any>>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  const timer = useRef<NodeJS.Timeout | null>(null);

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }

      timer.current = setTimeout(async () => {
        try {
          const result = await callback(...args);
          resolve(result as ReturnType<T>);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
}

// Custom React Hook that helps us manage Appwrite API calls with state and error handling
interface UseAppwriteOptions<T, P extends Record<string, any>> {
  fn: (params?: P) => Promise<T>;
  params?: P;
  skip?: boolean;
  cacheKey?: string; // Custom cache key
  cacheTTL?: number; // Cache time-to-live in ms
  dependencies?: any[]; // Dependencies that trigger refetch when changed
  disableCache?: boolean; // Option to disable caching
  debounce?: number; // Debounce time in ms
}

interface UseAppwriteReturn<T, P> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: (newParams?: P) => Promise<void>;
  clearCache: () => void;
}

export const useAppwrite = <T, P extends Record<string, any>>({
  fn,
  params = {} as P,
  skip = false,
  cacheKey,
  cacheTTL = DEFAULT_CACHE_TTL,
  dependencies = [],
  disableCache = false,
  debounce = 0,
}: UseAppwriteOptions<T, P>): UseAppwriteReturn<T, P> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);
  const previousParams = useRef<P>(params);
  const activeFetch = useRef<Promise<void> | null>(null);

  // Generate a consistent cache key
  const effectiveKey = useMemo(() => {
    return cacheKey || `${fn.name}-${JSON.stringify(params)}`;
  }, [cacheKey, fn.name, params]);

  // Rate limiting logic
  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    const limiter = rateLimiters.get(effectiveKey) || {
      calls: 0,
      resetTime: now + RATE_WINDOW,
    };

    // Reset counter if window expired
    if (now > limiter.resetTime) {
      limiter.calls = 0;
      limiter.resetTime = now + RATE_WINDOW;
    }

    // Check if rate limited
    if (limiter.calls >= RATE_LIMIT) {
      authDebug.warn(`Rate limit reached for ${effectiveKey}, delaying request`);
      return false;
    }

    // Increment counter and update
    limiter.calls++;
    rateLimiters.set(effectiveKey, limiter);
    return true;
  }, [effectiveKey]);

  // Memoize fetch function to avoid unnecessary recreations
  const fetchDataInternal = useCallback(
    async (fetchParams?: P) => {
      // Prevent duplicate simultaneous requests for the same data
      if (activeFetch.current) {
        authDebug.debug(`Already fetching data for ${effectiveKey}, skipping duplicate request`);
        return activeFetch.current;
      }

      // Check for rate limiting
      if (!checkRateLimit()) {
        return;
      }

      const paramsToUse = fetchParams || params;
      const currentCacheKey = cacheKey || `${fn.name}-${JSON.stringify(paramsToUse)}`;

      // Check cache first if not disabled
      if (!disableCache) {
        const cached = cacheManager.get<T>(currentCacheKey);
        if (cached) {
          authDebug.debug(`Cache hit for ${currentCacheKey}`);
          setData(cached);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setError(null);

      // Record this as a database read operation
      dbUsageMonitor.recordRead(`${fn.name}`);

      try {
        authDebug.debug(`Fetching data for ${fn.name}`, paramsToUse);

        // Create a promise for this fetch operation
        activeFetch.current = (async () => {
          try {
            const result = await fn(paramsToUse);
            setData(result);

            // Cache the result if caching is enabled
            if (!disableCache) {
              cacheManager.set<T>(currentCacheKey, result, cacheTTL);
              authDebug.debug(`Cached data for ${currentCacheKey}`);
            }
          } catch (err: unknown) {
            const errorMessage =
              err instanceof Error ? err.message : "An unknown error occurred";
            setError(errorMessage);

            // Only show alert for non-auth errors
            if (
              !errorMessage.includes("missing scope") &&
              !errorMessage.includes("User (role: guests)")
            ) {
              Alert.alert("Error", errorMessage);
            }
            throw err;
          } finally {
            setLoading(false);
            activeFetch.current = null;
          }
        })();

        await activeFetch.current;
      } catch (err) {
        // Error handling is done in the inner try-catch
      }
    },
    [fn, params, disableCache, cacheTTL, checkRateLimit, cacheKey, effectiveKey]
  );

  // Apply debouncing if configured
  const fetchData = useMemo(() => {
    return debounce > 0
      ? useDebounce(fetchDataInternal, debounce)
      : fetchDataInternal;
  }, [fetchDataInternal, debounce]);

  // Function to clear cache for this hook
  const clearCache = useCallback(() => {
    if (cacheKey) {
      cacheManager.remove(cacheKey);
    } else {
      // Clear based on function name
      cacheManager.clearPattern(new RegExp(`^${fn.name}-`));
    }
  }, [cacheKey, fn.name]);

  // Check for param changes
  useEffect(() => {
    // Only refetch if params actually changed
    if (JSON.stringify(previousParams.current) !== JSON.stringify(params)) {
      if (!skip) {
        fetchData(params);
      }
      previousParams.current = params;
    }
  }, [params, skip, fetchData]);

  // Effect to fetch data on mount and when dependencies change
  useEffect(() => {
    if (!skip) {
      fetchData(params);
    }
  }, [skip, ...dependencies]); // Include dependencies array

  const refetch = async (newParams?: P) => await fetchData(newParams);

  return { data, loading, error, refetch, clearCache };
};

// Utility function to invalidate specific cache entries
export const invalidateCache = (keyPattern?: RegExp | string) => {
  if (!keyPattern) {
    // Clear entire cache
    cacheManager.clear();
    return;
  }

  if (typeof keyPattern === 'string') {
    cacheManager.remove(keyPattern);
    return;
  }

  // Clear matching cache entries
  cacheManager.clearPattern(keyPattern);
};
