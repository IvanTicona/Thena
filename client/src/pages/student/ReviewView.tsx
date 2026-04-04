import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Typography,
  Spin,
  Alert,
  Steps,
  Empty,
  Button,
} from 'antd';
import { Allotment } from 'allotment';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { usePolling } from '../../hooks/usePolling';
import type {
  ReviewResult,
  Observation,
  AgentType,
  Severity,
} from '../../types';
import { AGENT_LABELS } from './components/observation-config';
import ReviewSummaryCard from './components/ReviewSummaryCard';
import ObservationCard from './components/ObservationCard';
import ObservationFilters from './components/ObservationFilters';
import DocumentPreview from './components/DocumentPreview';
import './ReviewView.css';

const { Title, Text } = Typography;

const shouldStopPolling = (data: ReviewResult) =>
  data.status === 'COMPLETED' || data.status === 'FAILED';

const agentStepStatus = (status: string): 'finish' | 'process' | 'wait' => {
  if (status === 'COMPLETED') return 'finish';
  if (status === 'RUNNING') return 'process';
  return 'wait';
};

export default function ReviewView() {
  const { id: chapterId, jobId } = useParams<{ id: string; jobId: string }>();
  const navigate = useNavigate();
  const [selectedObs, setSelectedObs] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AgentType | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const markdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = 'Revisión — Thena'; }, []);

  const { data: review, loading, error } = usePolling<ReviewResult>({
    url: `/reviews/${jobId}`,
    interval: 3000,
    shouldStop: shouldStopPolling,
  });

  const handleHighlightClick = useCallback((obsId: string) => {
    setSelectedObs((prev) => (prev === obsId ? null : obsId));
  }, []);

  if (loading)
    return (
      <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
    );

  if (error)
    return (
      <Alert
        type="error"
        message="Error al cargar la revisión. Intentá de nuevo."
        showIcon
        className="review-view__alert"
      />
    );

  if (!review) return <Alert type="error" message="Revisión no encontrada" />;

  // Vista de procesamiento
  if (review.status === 'QUEUED' || review.status === 'PROCESSING') {
    return (
      <div className="review-view__processing">
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 24 }}>
          {review.status === 'QUEUED'
            ? 'Tu documento está en cola...'
            : 'Analizando tu documento...'}
        </Title>
        <Text type="secondary">
          Los agentes de IA están revisando tu capítulo.
        </Text>
        {review.agents && review.agents.length > 0 && (
          <div className="review-view__processing-steps">
            <Steps
              direction="vertical"
              current={-1}
              items={review.agents.map((a) => ({
                title: AGENT_LABELS[a.type],
                status: agentStepStatus(a.status),
                description:
                  a.status === 'COMPLETED'
                    ? 'Completado'
                    : a.status === 'RUNNING'
                      ? 'En proceso...'
                      : 'Pendiente',
              }))}
            />
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
        message="La revisión ha fallado"
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

  const handleObsClick = (obs: Observation) => {
    setSelectedObs(obs.id === selectedObs ? null : obs.id);
    if (obs.textFragment && markdownRef.current) {
      const el = markdownRef.current.querySelector(`[data-obs-id="${obs.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <div className="review-view">
      <div className="review-view__back-row">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/chapters/${chapterId}`)}
        >
          Volver al capítulo
        </Button>
      </div>
      <Allotment defaultSizes={[60, 40]}>
        {/* Panel izquierdo — Documento Markdown */}
        <Allotment.Pane minSize={300}>
          <DocumentPreview
            ref={markdownRef}
            markdownContent={review.markdownContent}
            observations={filtered}
            onHighlightClick={handleHighlightClick}
          />
        </Allotment.Pane>

        {/* Panel derecho — Observaciones */}
        <Allotment.Pane minSize={320} preferredSize={420}>
          <div className="review-view__obs-panel">
            {/* Resumen */}
            {review.report && <ReviewSummaryCard report={review.report} />}

            {/* Filtros */}
            <ObservationFilters
              typeFilter={typeFilter}
              severityFilter={severityFilter}
              onTypeChange={setTypeFilter}
              onSeverityChange={setSeverityFilter}
            />

            {/* Tarjetas de observaciones */}
            <div className="review-view__obs-list">
              {filtered.length === 0 ? (
                <Empty description="No hay observaciones con estos filtros" />
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
  );
}
