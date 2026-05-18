import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { thesisApi } from '../services/api';
import type { Chapter } from '../types';

/* ── Context type ───────────────────────────────────────── */

interface ChaptersContextType {
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const ChaptersContext = createContext<ChaptersContextType | null>(null);

/* ── Provider ───────────────────────────────────────────── */

interface ChaptersProviderProps {
  children: ReactNode;
  /** Only fetch when enabled (e.g. only for students with a thesis) */
  enabled?: boolean;
}

export function ChaptersProvider({ children, enabled = true }: ChaptersProviderProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    thesisApi
      .findMine()
      .then((thesis) => setChapters(thesis?.chapters ?? []))
      .catch(() => setError('Error al cargar los capítulos'))
      .finally(() => setLoading(false));
  }, [enabled]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <ChaptersContext.Provider value={{ chapters, loading, error, refetch }}>
      {children}
    </ChaptersContext.Provider>
  );
}

/* ── Hook ───────────────────────────────────────────────── */

export function useChapters(): ChaptersContextType {
  const context = useContext(ChaptersContext);
  if (!context) {
    throw new Error('useChapters debe usarse dentro de ChaptersProvider');
  }
  return context;
}
