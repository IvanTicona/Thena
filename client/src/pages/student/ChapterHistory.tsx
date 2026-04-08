import { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Button,
  Spin,
  Alert,
  Statistic,
  Row,
  Col,
  Select,
  Collapse,
  List,
  Empty,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  FileWordOutlined,
  DownloadOutlined,
  EyeOutlined,
  DiffOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useParams, useNavigate } from 'react-router-dom';
import {
  chaptersApi,
  submissionsApi,
  reviewsApi,
  type ChapterDetailData,
  type ReviewDiffResult,
} from '../../services/api';
import { ApiError } from '../../services/api-error';
import type { Submission, Observation } from '../../types';
import { CHAPTER_STATUS, JOB_STATUS } from '../../utils/status';
import { formatDateTime } from '../../utils/format';
import './ChapterHistory.css';

const { Title, Text } = Typography;

const SEVERITY_LABELS: Record<string, string> = {
  ERROR: 'Error',
  WARNING: 'Advertencia',
  SUGGESTION: 'Sugerencia',
  INFO: 'Info',
};

const SEVERITY_COLORS: Record<string, string> = {
  ERROR: 'red',
  WARNING: 'orange',
  SUGGESTION: 'blue',
  INFO: 'green',
};

const AGENT_LABELS: Record<string, string> = {
  STRUCTURE: 'Estructura',
  METHODOLOGY: 'Metodología',
  COHERENCE: 'Coherencia',
  CITATIONS: 'Citas',
  FORMAT: 'Formato',
  INTEGRITY: 'Integridad',
};

/* ── Observation item component ──────────────────────────────── */
function ObservationItem({ obs }: { obs: Observation }) {
  return (
    <div className="chapter-history-diff__obs-item">
      <div className="chapter-history-diff__obs-badges">
        <Tag color={SEVERITY_COLORS[obs.severity] ?? 'default'}>
          {SEVERITY_LABELS[obs.severity] ?? obs.severity}
        </Tag>
        <Tag color="default" className="chapter-history-diff__agent-tag">
          {AGENT_LABELS[obs.type] ?? obs.type}
        </Tag>
        {obs.source === 'TUTOR' && <Tag color="purple">Tutor</Tag>}
      </div>
      <Text className="chapter-history-diff__obs-message">{obs.message}</Text>
      {obs.suggestion && (
        <Text type="secondary" className="chapter-history-diff__obs-suggestion">
          → {obs.suggestion}
        </Text>
      )}
    </div>
  );
}

/* ── Diff section component ──────────────────────────────────── */
interface DiffSectionProps {
  title: string;
  observations: Observation[];
  colorClass: string;
  emptyText: string;
  defaultOpen?: boolean;
}

function DiffSection({ title, observations, colorClass, emptyText, defaultOpen }: DiffSectionProps) {
  return (
    <Collapse
      defaultActiveKey={defaultOpen ? ['section'] : []}
      className={`chapter-history-diff__section ${colorClass}`}
      items={[
        {
          key: 'section',
          label: (
            <span className="chapter-history-diff__section-label">
              {title}
              <Tag className="chapter-history-diff__count-tag">
                {observations.length}
              </Tag>
            </span>
          ),
          children:
            observations.length === 0 ? (
              <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                dataSource={observations}
                renderItem={(obs) => (
                  <List.Item className="chapter-history-diff__obs-row">
                    <ObservationItem obs={obs} />
                  </List.Item>
                )}
                split={false}
              />
            ),
        },
      ]}
    />
  );
}

/* ── Main component ──────────────────────────────────────────── */
export default function ChapterHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState<ChapterDetailData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Diff state
  const [diffV1, setDiffV1] = useState<string | null>(null);
  const [diffV2, setDiffV2] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<ReviewDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await chaptersApi.getById(id!);
      setChapter(res.data);
      setSubmissions(res.data.submissions || []);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al cargar el historial';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    document.title = chapter
      ? `Historial — ${chapter.title} — Thena`
      : 'Historial — Thena';
  }, [chapter]);

  // Reset diff result when selection changes
  useEffect(() => {
    setDiffResult(null);
    setDiffError(null);
  }, [diffV1, diffV2]);

  const handleDownload = async (submission: Submission) => {
    setDownloadingId(submission.id);
    try {
      const res = await submissionsApi.downloadFile(submission.id);
      const blob = new Blob([res.data as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = submission.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail — user can retry
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCompareDiff = async () => {
    if (!diffV1 || !diffV2) return;
    setDiffLoading(true);
    setDiffError(null);
    setDiffResult(null);
    try {
      const res = await reviewsApi.getDiff(diffV1, diffV2);
      setDiffResult(res.data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al comparar versiones';
      setDiffError(msg);
    } finally {
      setDiffLoading(false);
    }
  };

  const handleClearDiff = () => {
    setDiffV1(null);
    setDiffV2(null);
    setDiffResult(null);
    setDiffError(null);
  };

  if (loading) {
    return <Spin size="large" className="u-spinner-centered" />;
  }

  if (error) {
    return (
      <Alert
        type="error"
        title="Error al cargar el historial"
        description={error}
        showIcon
        className="chapter-history__alert"
        action={
          <Button size="small" onClick={fetchData}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (!chapter) return <Alert type="error" title="Capítulo no encontrado" />;

  const statusCfg = CHAPTER_STATUS[chapter.status];
  const completedCount = submissions.filter(
    (s) => s.reviewJob?.status === 'COMPLETED',
  ).length;
  const latestSubmission = submissions[0] ?? null;

  // Only submissions with a COMPLETED review can be compared
  const completedSubmissions = submissions.filter(
    (s) => s.reviewJob?.status === 'COMPLETED',
  );

  /* ── Table columns ─────────────────────────────────────── */
  const columns: ColumnsType<Submission> = [
    {
      title: 'Versión',
      dataIndex: 'versionNumber',
      key: 'version',
      render: (v: number) => (
        <Text strong>v{v}</Text>
      ),
      width: 80,
    },
    {
      title: 'Archivo',
      dataIndex: 'fileName',
      key: 'file',
      render: (name: string) => (
        <span className="chapter-history__file-cell">
          <FileWordOutlined className="chapter-history__file-icon" />
          <span className="chapter-history__file-name">{name}</span>
        </span>
      ),
    },
    {
      title: 'Fecha de entrega',
      dataIndex: 'submittedAt',
      key: 'date',
      render: (d: string) => formatDateTime(d),
      width: 200,
    },
    {
      title: 'Revisión',
      key: 'reviewStatus',
      width: 140,
      render: (_, record) => {
        const status = record.reviewJob?.status ?? null;
        if (!status) return <Tag color="default">Sin revisión</Tag>;
        const cfg = JOB_STATUS[status];
        return <Tag color={cfg.tagColor}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 200,
      render: (_, record) => {
        const job = record.reviewJob;
        return (
          <div className="chapter-history__actions-cell">
            {job && job.status === 'COMPLETED' && (
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/chapters/${id}/review/${job.id}`)}
              >
                Ver revisión
              </Button>
            )}
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              loading={downloadingId === record.id}
              onClick={() => handleDownload(record)}
            >
              Descargar
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="chapter-history">
      {/* Back button */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/chapters/${id}`)}
        className="chapter-history__back-btn"
      >
        Volver al capítulo
      </Button>

      {/* Chapter header */}
      <div className="chapter-history__header">
        <div className="chapter-history__header-text">
          <span className="u-eyebrow-label">CAPÍTULO {chapter.number}</span>
          <Title level={3} className="chapter-history__chapter-title">
            {chapter.title}
          </Title>
        </div>
        <Tag
          color={statusCfg.tagColor}
          className="chapter-history__status-tag"
        >
          {statusCfg.label}
        </Tag>
      </div>

      {/* Summary stats */}
      <Row gutter={[16, 16]} className="chapter-history__stats">
        <Col xs={12} sm={8}>
          <Card size="small" className="chapter-history__stat-card">
            <Statistic
              title="Total de entregas"
              value={submissions.length}
              suffix="versiones"
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" className="chapter-history__stat-card">
            <Statistic
              title="Revisiones completadas"
              value={completedCount}
              valueStyle={{ color: completedCount > 0 ? '#52c41a' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" className="chapter-history__stat-card">
            <Statistic
              title="Última entrega"
              value={
                latestSubmission
                  ? formatDateTime(latestSubmission.submittedAt)
                  : '—'
              }
              valueStyle={{ fontSize: 14 }}
            />
          </Card>
        </Col>
      </Row>

      {/* History table */}
      <Card
        title="Historial de versiones"
        className="chapter-history__table-card"
      >
        <Table
          dataSource={submissions}
          columns={columns}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: 'No hay entregas para este capítulo' }}
          scroll={{ x: 600 }}
          rowClassName={(record) =>
            record.id === latestSubmission?.id
              ? 'chapter-history__row--latest'
              : ''
          }
        />
      </Card>

      {/* Cross-version diff */}
      {completedSubmissions.length >= 2 && (
        <Card
          title={
            <span className="chapter-history-diff__card-title">
              <DiffOutlined />
              <span>Comparar versiones</span>
            </span>
          }
          className="chapter-history-diff__card"
        >
          <div className="chapter-history-diff__selectors">
            <div className="chapter-history-diff__selector-group">
              <Text type="secondary" className="chapter-history-diff__selector-label">
                Versión base (anterior)
              </Text>
              <Select
                placeholder="Seleccioná una versión"
                value={diffV1 ?? undefined}
                onChange={(val) => setDiffV1(val)}
                className="chapter-history-diff__select"
                options={completedSubmissions.map((s) => ({
                  value: s.id,
                  label: `v${s.versionNumber} — ${formatDateTime(s.submittedAt)}`,
                  disabled: s.id === diffV2,
                }))}
              />
            </div>

            <div className="chapter-history-diff__arrow">→</div>

            <div className="chapter-history-diff__selector-group">
              <Text type="secondary" className="chapter-history-diff__selector-label">
                Versión nueva (comparar con)
              </Text>
              <Select
                placeholder="Seleccioná una versión"
                value={diffV2 ?? undefined}
                onChange={(val) => setDiffV2(val)}
                className="chapter-history-diff__select"
                options={completedSubmissions.map((s) => ({
                  value: s.id,
                  label: `v${s.versionNumber} — ${formatDateTime(s.submittedAt)}`,
                  disabled: s.id === diffV1,
                }))}
              />
            </div>
          </div>

          <div className="chapter-history-diff__actions">
            <Button
              type="primary"
              icon={<DiffOutlined />}
              disabled={!diffV1 || !diffV2 || diffV1 === diffV2}
              loading={diffLoading}
              onClick={handleCompareDiff}
            >
              Comparar observaciones
            </Button>
            {(diffResult || diffError) && (
              <Button
                icon={<CloseOutlined />}
                onClick={handleClearDiff}
              >
                Limpiar
              </Button>
            )}
          </div>

          {diffError && (
            <Alert
              type="error"
              message={diffError}
              showIcon
              className="chapter-history-diff__error"
            />
          )}

          {diffResult && (
            <>
              <Divider className="chapter-history-diff__divider" />

              {/* Summary badges */}
              <div className="chapter-history-diff__summary">
                <Tag color="green" className="chapter-history-diff__summary-tag">
                  ✓ Resueltas: {diffResult.resolved.length}
                </Tag>
                <Tag color="orange" className="chapter-history-diff__summary-tag">
                  ~ Persisten: {diffResult.persisting.length}
                </Tag>
                <Tag color="red" className="chapter-history-diff__summary-tag">
                  + Nuevas: {diffResult.new.length}
                </Tag>
              </div>

              <div className="chapter-history-diff__results">
                <DiffSection
                  title="Resueltas"
                  observations={diffResult.resolved}
                  colorClass="chapter-history-diff__section--resolved"
                  emptyText="No hay observaciones resueltas"
                  defaultOpen={diffResult.resolved.length > 0}
                />
                <DiffSection
                  title="Persisten"
                  observations={diffResult.persisting}
                  colorClass="chapter-history-diff__section--persisting"
                  emptyText="No hay observaciones que persisten"
                  defaultOpen={diffResult.persisting.length > 0}
                />
                <DiffSection
                  title="Nuevas"
                  observations={diffResult.new}
                  colorClass="chapter-history-diff__section--new"
                  emptyText="No hay observaciones nuevas"
                  defaultOpen={diffResult.new.length > 0}
                />
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
