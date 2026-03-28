import { useState, useRef, useCallback } from 'react';
import {
  Typography,
  Spin,
  Alert,
  Button,
  Space,
  Modal,
  message,
  Empty,
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

const { Title, Text } = Typography;

const shouldStopPolling = (data: ReviewResult) =>
  data.status === 'COMPLETED' || data.status === 'FAILED';

export default function SubmissionReview() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('chapterId');
  const navigate = useNavigate();

  const [selectedObs, setSelectedObs] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AgentType | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const markdownRef = useRef<HTMLDivElement>(null);

  // Use latest review by chapterId if available, otherwise by submissionId reference
  const reviewUrl = chapterId
    ? `/reviews/latest?chapterId=${chapterId}`
    : null;

  const { data: review, loading } = usePolling<ReviewResult>({
    url: reviewUrl || `/reviews/latest?chapterId=${submissionId}`,
    interval: 3000,
    shouldStop: shouldStopPolling,
  });

  const handleHighlightClick = useCallback((obsId: string) => {
    setSelectedObs((prev) => (prev === obsId ? null : obsId));
  }, []);

  const handleApprove = () => {
    if (!chapterId) return;
    Modal.confirm({
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
    Modal.confirm({
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

  if (!reviewUrl) {
    return (
      <Alert
        type="error"
        message="Parámetros inválidos"
        description="No se pudo determinar el capítulo asociado a esta entrega."
      />
    );
  }

  if (!review) return <Alert type="error" message="Revisión no encontrada" />;

  if (review.status === 'FAILED') {
    return (
      <Alert
        type="error"
        message="La revisión ha fallado"
        description="Ocurrió un error durante el análisis. El estudiante debe subir el documento nuevamente."
        showIcon
        style={{ maxWidth: 600, margin: '60px auto' }}
      />
    );
  }

  if (review.status === 'QUEUED' || review.status === 'PROCESSING') {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 24 }}>
          {review.status === 'QUEUED'
            ? 'El documento está en cola...'
            : 'Analizando el documento...'}
        </Title>
        <Text type="secondary">
          Los agentes de IA están revisando el capítulo. Esto puede tomar unos minutos.
        </Text>
        {review.agents && review.agents.length > 0 && (
          <div style={{ marginTop: 24, textAlign: 'left' }}>
            {review.agents.map((a) => (
              <div
                key={a.type}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}
              >
                <Text>{AGENT_LABELS[a.type]}</Text>
              </div>
            ))}
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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
      {/* Barra de acciones superior */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          padding: '8px 0',
        }}
      >
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
      <div style={{ flex: 1, overflow: 'hidden' }}>
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
    </div>
  );
}
