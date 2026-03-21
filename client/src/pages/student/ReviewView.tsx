import { useState, useRef, useCallback } from 'react';
import {
  Typography,
  Spin,
  Alert,
  Tag,
  Empty,
} from 'antd';
import { useParams } from 'react-router-dom';
import { usePolling } from '../../hooks/usePolling';
import type {
  ReviewResult,
  Observation,
  AgentType,
  Severity,
  ReviewAgentStatus,
} from '../../types';
import { AGENT_LABELS } from './components/observation-config';
import ReviewSummaryCard from './components/ReviewSummaryCard';
import ObservationCard from './components/ObservationCard';
import ObservationFilters from './components/ObservationFilters';
import DocumentPreview from './components/DocumentPreview';

const { Title, Text } = Typography;

const shouldStopPolling = (data: ReviewResult) =>
  data.status === 'COMPLETED' || data.status === 'FAILED';

export default function ReviewView() {
  const { id: chapterId, jobId } = useParams<{ id: string; jobId: string }>();
  const [selectedObs, setSelectedObs] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AgentType | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const markdownRef = useRef<HTMLDivElement>(null);

  const { data: review, loading } = usePolling<ReviewResult>({
    url: `/reviews/${jobId}`,
    interval: 3000,
    shouldStop: shouldStopPolling,
  });

  if (loading)
    return (
      <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
    );
  if (!review) return <Alert type="error" message="Revision no encontrada" />;

  // Processing view
  if (review.status === 'QUEUED' || review.status === 'PROCESSING') {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 24 }}>
          {review.status === 'QUEUED'
            ? 'Tu documento esta en cola...'
            : 'Analizando tu documento...'}
        </Title>
        <Text type="secondary">
          Los agentes de IA estan revisando tu capitulo. Esto puede tomar unos
          minutos.
        </Text>
        {review.agents && review.agents.length > 0 && (
          <div style={{ marginTop: 24, textAlign: 'left' }}>
            {review.agents.map(
              (a: ReviewAgentStatus) => (
                <div
                  key={a.type}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                  }}
                >
                  <Text>{AGENT_LABELS[a.type]}</Text>
                  <Tag
                    color={
                      a.status === 'COMPLETED'
                        ? 'success'
                        : a.status === 'RUNNING'
                          ? 'processing'
                          : 'default'
                    }
                  >
                    {a.status === 'COMPLETED'
                      ? 'Completado'
                      : a.status === 'RUNNING'
                        ? 'En proceso'
                        : 'Pendiente'}
                  </Tag>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    );
  }

  if (review.status === 'FAILED') {
    return (
      <Alert
        type="error"
        message="La revision ha fallado"
        description="Ocurrio un error durante el analisis. Intenta subir el documento nuevamente."
        showIcon
        style={{ maxWidth: 600, margin: '60px auto' }}
      />
    );
  }

  // Completed — split view
  const observations = review.observations || [];
  const filtered = observations.filter((o) => {
    if (typeFilter !== 'ALL' && o.type !== typeFilter) return false;
    if (severityFilter !== 'ALL' && o.severity !== severityFilter) return false;
    return true;
  });

  const handleObsClick = (obs: Observation) => {
    setSelectedObs(obs.id === selectedObs ? null : obs.id);

    // Scroll to highlight in markdown
    if (obs.textFragment && markdownRef.current) {
      const el = markdownRef.current.querySelector(
        `[data-obs-id="${obs.id}"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)' }}>
      {/* Left panel — Markdown document */}
      <DocumentPreview ref={markdownRef} markdownContent={review.markdownContent} />

      {/* Right panel — Observations */}
      <div
        style={{
          width: 420,
          minWidth: 380,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Summary */}
        {review.report && <ReviewSummaryCard report={review.report} />}

        {/* Filters */}
        <ObservationFilters
          typeFilter={typeFilter}
          severityFilter={severityFilter}
          onTypeChange={setTypeFilter}
          onSeverityChange={setSeverityFilter}
        />

        {/* Observation cards */}
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
    </div>
  );
}
