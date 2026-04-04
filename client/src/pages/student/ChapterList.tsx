import { useEffect, useState, useCallback } from 'react';
import { Spin, Alert, Button } from 'antd';
import { Navigate } from 'react-router-dom';
import api from '../../services/api';
import { ApiError } from '../../services/api-error';
import type { Chapter } from '../../types';

/**
 * ChapterList — redirects to the first actionable chapter.
 *
 * The sidebar already shows the full chapter list with status dots,
 * so rendering them again here would be redundant. Instead we redirect
 * to the first chapter the student can work on (DRAFT or IN_REVIEW),
 * or the first chapter if none are actionable yet.
 */
export default function ChapterList() {
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchChapters = useCallback(() => {
    setError(null);
    api
      .get<Chapter[]>('/chapters')
      .then((res) => setChapters(res.data))
      .catch((err: ApiError) => {
        setError(err.message || 'Error al cargar los capítulos');
      });
  }, []);

  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);

  useEffect(() => { document.title = 'Mis Capítulos — Thena'; }, []);

  // Loading
  if (!chapters && !error) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  // Error
  if (error) {
    return (
      <Alert
        type="error"
        message="Error al cargar los capítulos"
        description={error}
        showIcon
        style={{ maxWidth: 600, margin: '60px auto' }}
        action={
          <Button size="small" onClick={fetchChapters}>
            Reintentar
          </Button>
        }
      />
    );
  }

  // No chapters at all (shouldn't happen after onboarding)
  if (!chapters || chapters.length === 0) {
    return <Alert type="info" message="No se encontraron capítulos para tu proyecto." showIcon style={{ maxWidth: 600, margin: '60px auto' }} />;
  }

  // Find the first actionable chapter (DRAFT or IN_REVIEW), fallback to first chapter
  const actionable = chapters.find((ch) => ch.status === 'DRAFT' || ch.status === 'IN_REVIEW');
  const target = actionable || chapters[0];

  return <Navigate to={`/chapters/${target.id}`} replace />;
}
