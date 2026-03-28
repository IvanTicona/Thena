import { useState, useRef, useCallback } from 'react';
import {
  Typography,
  Spin,
  Alert,
  Steps,
  Empty,
} from 'antd';
import { Allotment } from 'allotment';
import { useParams } from 'react-router-dom';
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
  const [selectedObs, setSelectedObs] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AgentType | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const markdownRef = useRef<HTMLDivElement>(null);

  // Suppress unused warning — chapterId is available for context if needed
  void chapterId;

  const { data: review, loading } = usePolling<ReviewResult>({
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
  if (!review) return <Alert type="error" message="Revisión no encontrada" />;

  // Vista de procesamiento
  if (review.status === 'QUEUED' || review.status === 'PROCESSING') {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
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
          <div style={{ marginTop: 24, textAlign: 'left' }}>
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
        <Text type="secondary" style={{ marginTop: 16, display: 'block' }}>
          Tiempo estimado: 2-5 minutos
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
        style={{ maxWidth: 600, margin: '60px auto' }}
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
    <div style={{ height: 'calc(100vh - 200px)' }}>
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
          <div
            style={{
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              paddingLeft: 16,
            }}
          >
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
            <div style={{ flex: 1, overflow: 'auto' }}>
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
