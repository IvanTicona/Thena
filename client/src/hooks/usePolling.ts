import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../services/api';
import { ApiError } from '../services/api-error';

interface UsePollingOptions<T> {
  /** URL to poll */
  url: string;
  /** Polling interval in milliseconds */
  interval?: number;
  /** Callback that returns true when polling should stop */
  shouldStop?: (data: T) => boolean;
}

export function usePolling<T>({ url, interval = 3000, shouldStop }: UsePollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get<T>(url);
      setData(res.data);
      setError(null);

      if (shouldStop && shouldStop(res.data)) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = undefined;
        }
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al cargar datos';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [url, shouldStop]);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, interval);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData, interval]);

  return { data, loading, error };
}
