import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../services/api';
import { ApiError } from '../services/api-error';

interface UsePollingOptions<T> {
  /** URL to poll — pass null to skip polling entirely */
  url: string | null;
  /** Base polling interval in milliseconds (default: 3000) */
  interval?: number;
  /** Maximum consecutive errors before polling stops (default: 10) */
  maxRetries?: number;
  /** Callback that returns true when polling should stop */
  shouldStop?: (data: T) => boolean;
}

export function usePolling<T>({
  url,
  interval = 3000,
  maxRetries = 10,
  shouldStop,
}: UsePollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Refs to avoid stale closures and ensure cleanup
  const retryCountRef = useRef(0);
  const stoppedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearScheduled = useCallback(() => {
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (stoppedRef.current) return;
    // url can only be non-null here because the effect guards below
    if (!url) return;

    try {
      const res = await api.get<T>(url);

      if (stoppedRef.current) return;

      setData(res.data);
      setError(null);

      // Reset consecutive error counter on success
      retryCountRef.current = 0;
      setRetryCount(0);

      if (shouldStop && shouldStop(res.data)) {
        stoppedRef.current = true;
        return;
      }

      // Schedule next poll at base interval
      timeoutRef.current = setTimeout(() => {
        void fetchData();
      }, interval);
    } catch (err) {
      if (stoppedRef.current) return;

      const consecutiveErrors = retryCountRef.current + 1;
      retryCountRef.current = consecutiveErrors;
      setRetryCount(consecutiveErrors);

      const message = err instanceof ApiError ? err.message : 'Error al cargar datos';
      setError(message);
      setLoading(false);

      if (consecutiveErrors >= maxRetries) {
        // Stop polling after maxRetries consecutive failures
        stoppedRef.current = true;
        return;
      }

      // Capped exponential backoff: interval * 2^(retries-1), cap at 30s
      const backoff = Math.min(interval * Math.pow(2, consecutiveErrors - 1), 30_000);
      timeoutRef.current = setTimeout(() => {
        void fetchData();
      }, backoff);
    } finally {
      setLoading(false);
    }
  }, [url, interval, maxRetries, shouldStop]);

  useEffect(() => {
    // If no URL, stop immediately with no data — caller shows the appropriate UI
    if (!url) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    // Reset state when url/options change
    stoppedRef.current = false;
    retryCountRef.current = 0;
    setRetryCount(0);
    setError(null);
    setLoading(true);

    // Kick off the first fetch immediately
    void fetchData();

    return () => {
      stoppedRef.current = true;
      clearScheduled();
    };
  }, [fetchData, clearScheduled, url]);

  return { data, loading, error, retryCount };
}
