import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Typography,
  Spin,
  Alert,
  Button,
  Empty,
  Steps,
} from 'antd';
import { Allotment } from 'allotment';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { usePolling } from '../../hooks/usePolling';
import type { ReviewResult, Observation, AgentType, Severity } from '../../types';
import { AGENT_LABELS } from '../student/components/observation-config';
import ReviewSummaryCard from '../student/components/ReviewSummaryCard';
import ObservationCard from '../student/components/ObservationCard';
import ObservationFilters from '../student/components/ObservationFilters';
import DocumentPreview from '../student/components/DocumentPreview';
import './ReviewerReviewView.css';

const { Title, Text } = Typography;

const shouldStopPolling = (data: ReviewResult) =>
  data.status === 'COMPLETED' || data.status === 'FAILED';

const agentStepStatus = (status: string): 'finish' | 'process' | 'wait' => {
  if (status === 'COMPLETED') return 'finish';
  if (status === 'RUNNING') return 'process';
  return 'wait';
};

export default function ReviewerReviewView() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('chapterId');
  const navigate = useNavigate();

  const [selectedObs, setSelectedObs] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AgentType | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const markdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Revisión (Solo lectura) — Thena';
  }, []);

  // Use latest review by chapterId
  const reviewUrl = chapterId ? `/reviews/latest?chapterId=${chapterId}` : null;

  const { data: review, loading, error } = usePolling<ReviewResult>({
    url: reviewUrl,
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

  if (error) {
    return (
      <Alert
        type="error"
        title="Error al cargar la revisión. Intentá de nuevo."
        showIcon
        className="reviewer-review-view__alert"
      />
    );
  }

  if (!reviewUrl) {
    return (
      <Alert
        type="error"
        title="Parámetros inválidos"
        description="No se pudo determinar el capítulo asociado a esta entrega."
      />
    );
  }

  if (!review) return <Alert type="error" title="Revisión no encontrada" />;

  if (review.status === 'FAILED') {
    return (
      <Alert
        type="error"
        title="La revisión ha fallado"
        description="Ocurrió un error durante el análisis. El estudiante debe subir el documento nuevamente."
        showIcon
        className="reviewer-review-view__alert"
      />
    );
  }

  if (review.status === 'QUEUED' || review.status === 'PROCESSING') {
    return (
      <div className="reviewer-review-view__processing">
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 24 }}>
          {review.status === 'QUEUED'
            ? 'El documento está en cola...'
            : 'Analizando el documento...'}
        </Title>
        <Text type="secondary">
          Thena está revisando el capítulo. Esto puede tomar unos minutos.
        </Text>
        {review.agents && review.agents.length > 0 && (
          <div className="reviewer-review-view__processing-steps">
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
      </div>
    );
  }

  // Vista completada — solo lectura, sin acciones de aprobación
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
    <div className="reviewer-review-view">
      {/* Barra superior — solo navegación, sin acciones de aprobación */}
      <div className="reviewer-review-view__action-bar">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/reviewer')}
        >
          Volver al panel
        </Button>
      </div>

      {/* Vista dividida — solo lectura */}
      <div className="reviewer-review-view__split">
        <Allotment defaultSizes={[60, 40]}>
          {/* Panel izquierdo — Documento */}
          <Allotment.Pane minSize={300}>
            <DocumentPreview
              ref={markdownRef}
              submissionId={submissionId}
              markdownContent={review.markdownContent}
              observations={filtered}
              selectedObsId={selectedObs}
              onHighlightClick={handleHighlightClick}
            />
          </Allotment.Pane>

          {/* Panel derecho — Observaciones (solo lectura) */}
          <Allotment.Pane minSize={320} preferredSize={420}>
            <div className="reviewer-review-view__obs-panel">
              {/* Resumen */}
              {review.report && <ReviewSummaryCard report={review.report} />}

              {/* Filtros */}
              <ObservationFilters
                observations={observations}
                typeFilter={typeFilter}
                severityFilter={severityFilter}
                onTypeChange={setTypeFilter}
                onSeverityChange={setSeverityFilter}
              />

              {/* Tarjetas de observaciones */}
              <div className="reviewer-review-view__obs-list">
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
    </div>
  );
}
