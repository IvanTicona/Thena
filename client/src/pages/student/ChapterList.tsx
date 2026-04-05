import { Spin, Alert, Button } from 'antd';
import { Navigate } from 'react-router-dom';
import { useChapters } from '../../contexts/ChaptersContext';

/**
 * ChapterList — redirects to the first actionable chapter.
 *
 * Uses the shared ChaptersContext (already loaded by AppLayout)
 * instead of making its own API call.
 */
export default function ChapterList() {
  const { chapters, loading, error, refetch } = useChapters();

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (error) {
    return (
      <Alert
        type="error"
        title="Error al cargar los capítulos"
        description={error}
        showIcon
        style={{ maxWidth: 600, margin: '60px auto' }}
        action={
          <Button size="small" onClick={refetch}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (!chapters || chapters.length === 0) {
    return (
      <Alert
        type="info"
        title="No se encontraron capítulos para tu proyecto."
        showIcon
        style={{ maxWidth: 600, margin: '60px auto' }}
      />
    );
  }

  // Find the first actionable chapter (DRAFT or IN_REVIEW), fallback to first chapter
  const actionable = chapters.find((ch) => ch.status === 'DRAFT' || ch.status === 'IN_REVIEW');
  const target = actionable || chapters[0];

  return <Navigate to={`/chapters/${target.id}`} replace />;
}
