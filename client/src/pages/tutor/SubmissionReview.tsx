import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Typography,
  Spin,
  Alert,
  Button,
  Space,
  App,
  Empty,
  Steps,
} from 'antd';
import { Allotment } from 'allotment';
import { CheckOutlined, CloseOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { usePolling } from '../../hooks/usePolling';
import type { ReviewResult, Observation, AgentType, Severity } from '../../types';
import { AGENT_LABELS } from '../student/components/observation-config';
import ReviewSummaryCard from '../student/components/ReviewSummaryCard';
import ObservationCard from '../student/components/ObservationCard';
import ObservationFilters from '../student/components/ObservationFilters';
import DocumentPreview from '../student/components/DocumentPreview';
import api from '../../services/api';
import { ApiError } from '../../services/api-error';
import './SubmissionReview.css';

const { Title, Text } = Typography;

const shouldStopPolling = (data: ReviewResult) =>
  data.status === 'COMPLETED' || data.status === 'FAILED';

const agentStepStatus = (status: string): 'finish' | 'process' | 'wait' => {
  if (status === 'COMPLETED') return 'finish';
  if (status === 'RUNNING') return 'process';
  return 'wait';
};

export default function SubmissionReview() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('chapterId');
  const navigate = useNavigate();
  const { modal, message } = App.useApp();

  const [selectedObs, setSelectedObs] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AgentType | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const markdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = 'Revisión de Entrega — Thena'; }, []);

  // Use latest review by chapterId if available, otherwise by submissionId reference
  const reviewUrl = chapterId
    ? `/reviews/latest?chapterId=${chapterId}`
    : null;

  const { data: review, loading, error } = usePolling<ReviewResult>({
    url: reviewUrl,
    interval: 3000,
    shouldStop: shouldStopPolling,
  });

  const handleHighlightClick = useCallback((obsId: string) => {
    setSelectedObs((prev) => (prev === obsId ? null : obsId));
  }, []);

  const handleApprove = () => {
    if (!chapterId) return;
    modal.confirm({
      title: 'Aprobar capítulo',
      content:
        '¿Estás seguro de aprobar este capítulo? Esto desbloqueará el siguiente capítulo para el estudiante.',
      okText: 'Aprobar',
      okType: 'primary',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.patch(`/chapters/${chapterId}/approve`);
          message.success('Capítulo aprobado exitosamente');
          navigate('/tutor');
        } catch (err) {
          message.error(
            err instanceof ApiError ? err.message : 'Error al aprobar el capítulo',
          );
        }
      },
    });
  };

  const handleReject = () => {
    if (!chapterId) return;
    modal.confirm({
      title: 'Rechazar capítulo',
      content:
        '¿Estás seguro de rechazar este capítulo? El estudiante deberá subir una nueva versión.',
      okText: 'Rechazar',
      okType: 'default',
      danger: true,
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.patch(`/chapters/${chapterId}/reject`);
          message.success('Capítulo rechazado');
          navigate('/tutor');
        } catch (err) {
          message.error(
            err instanceof ApiError ? err.message : 'Error al rechazar el capítulo',
          );
        }
      },
    });
  };

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
        className="submission-review__alert"
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
        className="submission-review__alert"
      />
    );
  }

  if (review.status === 'QUEUED' || review.status === 'PROCESSING') {
    return (
      <div className="submission-review__processing">
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
          <div className="submission-review__processing-steps">
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

  // Completed — split view with approval actions
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
    <div className="submission-review">
      {/* Barra de acciones superior */}
      <div className="submission-review__action-bar">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/tutor')}
        >
          Volver al panel
        </Button>
        <Space>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={handleApprove}
            disabled={!chapterId}
          >
            Aprobar capítulo
          </Button>
          <Button
            danger
            icon={<CloseOutlined />}
            onClick={handleReject}
            disabled={!chapterId}
          >
            Rechazar capítulo
          </Button>
        </Space>
      </div>

      {/* Vista dividida */}
      <div className="submission-review__split">
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
            <div className="submission-review__obs-panel">
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
              <div className="submission-review__obs-list">
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
