import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Typography,
  Spin,
  Alert,
  Empty,
  Button,
  Skeleton,
  message,
} from 'antd';
import { Allotment } from 'allotment';
import { ArrowLeftOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { usePolling } from '../../hooks/usePolling';
import type {
  ReviewResult,
  Observation,
  AgentType,
  Severity,
  AgentStatus,
} from '../../types';
import { AGENT_LABELS } from './components/observation-config';
import ReviewSummaryCard from './components/ReviewSummaryCard';
import ObservationCard from './components/ObservationCard';
import ObservationFilters from './components/ObservationFilters';
import DocumentPreview from './components/DocumentPreview';
import { reviewsApi } from '../../services/api';
import './ReviewView.css';

const { Title, Text } = Typography;

const shouldStopPolling = (data: ReviewResult) =>
  data.status === 'COMPLETED' || data.status === 'FAILED';

const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  PENDING: 'En espera',
  RUNNING: 'Analizando...',
  COMPLETED: 'Completado',
  FAILED: 'Error',
};

const agentTimelineModifier = (status: AgentStatus): string => {
  if (status === 'COMPLETED') return 'review-view__timeline-item--completed';
  if (status === 'RUNNING') return 'review-view__timeline-item--running';
  if (status === 'FAILED') return 'review-view__timeline-item--failed';
  return 'review-view__timeline-item--pending';
};

export default function ReviewView() {
  const { id: chapterId, jobId } = useParams<{ id: string; jobId: string }>();
  const navigate = useNavigate();
  const [selectedObs, setSelectedObs] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AgentType | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const [pdfLoading, setPdfLoading] = useState(false);
  const markdownRef = useRef<HTMLDivElement>(null);
  const obsListRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = 'Revisión — Thena'; }, []);

  const { data: review, loading, error } = usePolling<ReviewResult>({
    url: `/reviews/${jobId}`,
    interval: 3000,
    shouldStop: shouldStopPolling,
  });

  const handleExportPdf = useCallback(async () => {
    if (!jobId) return;
    setPdfLoading(true);
    try {
      const response = await reviewsApi.exportPdf(jobId);
      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = response.headers['content-disposition'] as string | undefined;
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      a.href = url;
      a.download = filenameMatch?.[1] ?? `thena-reporte.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      void message.error('No se pudo exportar el reporte. Intentá de nuevo.');
    } finally {
      setPdfLoading(false);
    }
  }, [jobId]);

  // Click on document highlight → select obs + scroll obs panel to card
  const handleHighlightClick = useCallback((obsId: string) => {
    setSelectedObs((prev) => {
      const next = prev === obsId ? null : obsId;
      if (next && obsListRef.current) {
        // Use rAF so the DOM has time to re-render the --selected class first
        requestAnimationFrame(() => {
          const card = obsListRef.current?.querySelector(`[data-card-id="${next}"]`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
      return next;
    });
  }, []);

  // Task 5.1: Show skeleton ONLY on initial load (data is null and loading is true)
  if (loading && !review)
    return (
      <div className="review-view">
        <div className="review-view__back-row review-view__back-row--sticky">
          <Skeleton.Button active size="medium" style={{ width: 160 }} />
        </div>
        <div className="review-view__split-wrapper">
          <Allotment defaultSizes={[60, 40]}>
            <Allotment.Pane minSize={300}>
              <div style={{ padding: '24px 32px', height: '100%' }}>
                <Skeleton active paragraph={{ rows: 14 }} />
              </div>
            </Allotment.Pane>
            <Allotment.Pane minSize={320} preferredSize={420}>
              <div className="review-view__obs-panel">
                <div className="review-view__skeleton-card">
                  <Skeleton active paragraph={{ rows: 3 }} />
                </div>
                <div className="review-view__skeleton-card">
                  <Skeleton active paragraph={{ rows: 3 }} />
                </div>
                <div className="review-view__skeleton-card">
                  <Skeleton active paragraph={{ rows: 3 }} />
                </div>
              </div>
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
    );

  if (error)
    return (
      <Alert
        type="error"
        title="Error al cargar la revisión. Intentá de nuevo."
        showIcon
        className="review-view__alert"
      />
    );

  if (!review) return <Alert type="error" title="Revisión no encontrada" />;

  // Vista de procesamiento
  if (review.status === 'QUEUED' || review.status === 'PROCESSING') {
    return (
      <div className="review-view__processing">
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 24 }}>
          Thena está analizando tu documento...
        </Title>
        <Text type="secondary">
          Thena está revisando tu capítulo.
        </Text>
        {review.agents && review.agents.length > 0 && (
          <div className="review-view__processing-steps">
            <div className="review-view__timeline">
              {review.agents.map((agent) => (
                <div
                  key={agent.type}
                  className={`review-view__timeline-item ${agentTimelineModifier(agent.status)}`}
                >
                  <div className="review-view__timeline-dot" />
                  <div className="review-view__timeline-content">
                    <div className="review-view__timeline-label">
                      {AGENT_LABELS[agent.type]}
                    </div>
                    <span className="review-view__timeline-status">
                      {AGENT_STATUS_LABEL[agent.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <Text type="secondary" className="review-view__processing-hint">
          El proceso puede tardar unos minutos.
        </Text>
      </div>
    );
  }

  if (review.status === 'FAILED') {
    return (
      <Alert
        type="error"
        title="La revisión ha fallado"
        description="Ocurrió un error durante el análisis. Intenta subir el documento nuevamente."
        showIcon
        className="review-view__alert"
      />
    );
  }

  // Completado — vista dividida
  const observations = review.observations || [];
  const filtered = observations.filter((o) => {
    if (typeFilter !== 'ALL' && o.type !== typeFilter) return false;
    if (severityFilter !== 'ALL' && o.severity !== severityFilter) return false;
    return true;
  });

  // Click on observation card → select obs + scroll document to highlight
  const handleObsClick = (obs: Observation) => {
    const next = obs.id === selectedObs ? null : obs.id;
    setSelectedObs(next);
    if (next && obs.textFragment && markdownRef.current) {
      const el = markdownRef.current.querySelector(`[data-obs-id="${next}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Task 5.3: Keyboard navigation handler for observation list
  const handleObsKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!filtered.length) return;
    const currentIndex = selectedObs
      ? filtered.findIndex((o) => o.id === selectedObs)
      : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, filtered.length - 1);
      const nextObs = filtered[nextIndex];
      handleObsClick(nextObs);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex <= 0) return;
      const prevObs = filtered[currentIndex - 1];
      handleObsClick(prevObs);
    } else if (e.key === 'Enter') {
      if (selectedObs && markdownRef.current) {
        const el = markdownRef.current.querySelector(`[data-obs-id="${selectedObs}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    } else if (e.key === 'Escape') {
      setSelectedObs(null);
    }
  };

  return (
    <div className="review-view">
      <div className="review-view__back-row review-view__back-row--sticky">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/chapters/${chapterId}`)}
        >
          Volver al capítulo
        </Button>
        <Button
          icon={<FilePdfOutlined />}
          loading={pdfLoading}
          onClick={handleExportPdf}
        >
          Exportar PDF
        </Button>
      </div>
      <div className="review-view__split-wrapper">
        <Allotment defaultSizes={[60, 40]}>
          {/* Panel izquierdo — Documento */}
          <Allotment.Pane minSize={300}>
            <DocumentPreview
            ref={markdownRef}
            submissionId={review.submissionId}
            markdownContent={review.markdownContent}
            observations={filtered}
            selectedObsId={selectedObs}
            onHighlightClick={handleHighlightClick}
          />
        </Allotment.Pane>

        {/* Panel derecho — Observaciones */}
        <Allotment.Pane minSize={320} preferredSize={420}>
          <div className="review-view__obs-panel">
            {/* Resumen */}
            {review.report && <ReviewSummaryCard report={review.report} />}

            {/* Filtros — recibe la lista COMPLETA sin filtrar para los conteos */}
            <ObservationFilters
              observations={observations}
              typeFilter={typeFilter}
              severityFilter={severityFilter}
              onTypeChange={setTypeFilter}
              onSeverityChange={setSeverityFilter}
            />

            {/* Tarjetas de observaciones */}
            <div
              ref={obsListRef}
              className="review-view__obs-list"
              tabIndex={0}
              onKeyDown={handleObsKeyDown}
              aria-label="Lista de observaciones"
            >
              {filtered.length === 0 && observations.length > 0 ? (
                <div className="review-view__empty-state">
                  <span className="review-view__empty-state-icon" role="img" aria-label="Sin resultados">🔍</span>
                  <span className="review-view__empty-state-text">
                    No se encontraron observaciones con los filtros seleccionados
                  </span>
                  <Button
                    type="link"
                    onClick={() => {
                      setTypeFilter('ALL');
                      setSeverityFilter('ALL');
                    }}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <Empty description="No hay observaciones para este capítulo" />
              ) : (
                filtered.map((obs) => (
                  <ObservationCard
                    key={obs.id}
                    observation={obs}
                    isSelected={selectedObs === obs.id}
                    onClick={handleObsClick}
                  />
                ))
              )}
            </div>
          </div>
        </Allotment.Pane>
      </Allotment>
      </div>
    </div>
  );
}
