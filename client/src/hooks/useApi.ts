import { useState, useEffect } from 'react';
import api from '../services/api';
import { ApiError } from '../services/api-error';

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError(null);
    api.get<T>(url)
      .then(res => setData(res.data))
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading, error, setData };
}
