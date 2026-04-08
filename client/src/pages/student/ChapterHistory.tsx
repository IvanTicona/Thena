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
} from 'antd';
import {
  ArrowLeftOutlined,
  FileWordOutlined,
  DownloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useParams, useNavigate } from 'react-router-dom';
import { chaptersApi, submissionsApi, type ChapterDetailData } from '../../services/api';
import { ApiError } from '../../services/api-error';
import type { Submission } from '../../types';
import { CHAPTER_STATUS, JOB_STATUS } from '../../utils/status';
import { formatDateTime } from '../../utils/format';
import './ChapterHistory.css';

const { Title, Text } = Typography;

export default function ChapterHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState<ChapterDetailData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    </div>
  );
}
