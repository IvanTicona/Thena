import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Typography,
  Spin,
  Alert,
  Tag,
  Card,
  Select,
  Empty,
  Collapse,
  Tooltip,
  Progress,
} from 'antd';
import {
  InfoCircleOutlined,
  BulbOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../../services/api';
import type {
  ReviewResult,
  Observation,
  AgentType,
  Severity,
} from '../../types';

const { Title, Text, Paragraph } = Typography;

const SEVERITY_CONFIG: Record<
  Severity,
  { color: string; icon: React.ReactNode; label: string }
> = {
  INFO: { color: 'blue', icon: <InfoCircleOutlined />, label: 'Info' },
  SUGGESTION: { color: 'cyan', icon: <BulbOutlined />, label: 'Sugerencia' },
  WARNING: { color: 'orange', icon: <WarningOutlined />, label: 'Advertencia' },
  ERROR: { color: 'red', icon: <CloseCircleOutlined />, label: 'Error' },
};

const AGENT_LABELS: Record<AgentType, string> = {
  STRUCTURE: 'Estructura',
  METHODOLOGY: 'Metodologia',
  COHERENCE: 'Coherencia',
};

const POLL_INTERVAL = 3000;

export default function ReviewView() {
  const { id: chapterId, jobId } = useParams<{ id: string; jobId: string }>();
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedObs, setSelectedObs] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AgentType | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');
  const markdownRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchReview = useCallback(async () => {
    try {
      const res = await api.get<ReviewResult>(`/reviews/${jobId}`);
      setReview(res.data);

      // Stop polling when done
      if (res.data.status === 'COMPLETED' || res.data.status === 'FAILED') {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = undefined;
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchReview();
    pollRef.current = setInterval(fetchReview, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchReview]);

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
        {(review as any).agents && (
          <div style={{ marginTop: 24, textAlign: 'left' }}>
            {(review as any).agents.map(
              (a: { type: AgentType; status: string }) => (
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
      <div
        ref={markdownRef}
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#fff',
          padding: 24,
          borderRadius: 8,
          border: '1px solid #f0f0f0',
        }}
      >
        {review.markdownContent ? (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {review.markdownContent}
            </ReactMarkdown>
          </div>
        ) : (
          <Empty description="No se pudo cargar el contenido del documento" />
        )}
      </div>

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
        {review.report && (
          <Card size="small">
            <Title level={5} style={{ marginTop: 0 }}>
              Resumen
            </Title>
            <Paragraph
              ellipsis={{ rows: 4, expandable: true, symbol: 'leer mas' }}
            >
              {review.report.summaryText}
            </Paragraph>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(
                Object.entries(review.report.bySeverity) as [Severity, number][]
              ).map(([sev, count]) => {
                if (!count) return null;
                const cfg = SEVERITY_CONFIG[sev];
                return (
                  <Tag key={sev} icon={cfg.icon} color={cfg.color}>
                    {cfg.label}: {count}
                  </Tag>
                );
              })}
            </div>
          </Card>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ flex: 1 }}
            options={[
              { value: 'ALL', label: 'Todos los tipos' },
              { value: 'STRUCTURE', label: 'Estructura' },
              { value: 'METHODOLOGY', label: 'Metodologia' },
              { value: 'COHERENCE', label: 'Coherencia' },
            ]}
          />
          <Select
            value={severityFilter}
            onChange={setSeverityFilter}
            style={{ flex: 1 }}
            options={[
              { value: 'ALL', label: 'Todas las severidades' },
              { value: 'ERROR', label: 'Error' },
              { value: 'WARNING', label: 'Advertencia' },
              { value: 'SUGGESTION', label: 'Sugerencia' },
              { value: 'INFO', label: 'Info' },
            ]}
          />
        </div>

        {/* Observation cards */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <Empty description="No hay observaciones con estos filtros" />
          ) : (
            filtered.map((obs) => {
              const cfg = SEVERITY_CONFIG[obs.severity];
              const isSelected = selectedObs === obs.id;

              return (
                <Card
                  key={obs.id}
                  size="small"
                  style={{
                    marginBottom: 8,
                    cursor: 'pointer',
                    borderColor: isSelected ? cfg.color : undefined,
                    borderWidth: isSelected ? 2 : 1,
                  }}
                  onClick={() => handleObsClick(obs)}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginBottom: 4,
                      alignItems: 'center',
                    }}
                  >
                    <Tag color={cfg.color} icon={cfg.icon}>
                      {cfg.label}
                    </Tag>
                    <Tag>{AGENT_LABELS[obs.type]}</Tag>
                  </div>
                  <Text>{obs.message}</Text>
                  {obs.suggestion && (
                    <Paragraph
                      type="secondary"
                      style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }}
                    >
                      {obs.suggestion}
                    </Paragraph>
                  )}
                  {obs.textFragment && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '4px 8px',
                        background: '#fafafa',
                        borderLeft: `3px solid ${cfg.color}`,
                        fontSize: 12,
                        color: '#666',
                      }}
                    >
                      "{obs.textFragment}"
                    </div>
                  )}
                  {obs.sourceReference && (
                    <Tooltip
                      title={`${obs.sourceReference.documentTitle} - ${obs.sourceReference.section}`}
                    >
                      <Text
                        type="secondary"
                        style={{
                          fontSize: 11,
                          display: 'block',
                          marginTop: 4,
                        }}
                      >
                        Fuente: {obs.sourceReference.layer === 'TUTOR' ? 'Tutor' : 'Institucional'} -{' '}
                        {obs.sourceReference.section}
                      </Text>
                    </Tooltip>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
