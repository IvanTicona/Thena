import { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Upload,
  Button,
  Card,
  Table,
  Tag,
  Tabs,
  Spin,
  message,
  Alert,
  Empty,
} from 'antd';
import {
  FileWordOutlined,
  EyeOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ApiError } from '../../services/api-error';
import type { Chapter, Submission } from '../../types';
import { CHAPTER_STATUS } from '../../utils/status';
import { formatDateTime } from '../../utils/format';
import './ChapterDetail.css';

const { Title, Text } = Typography;
const { Dragger } = Upload;

interface ChapterDetailData extends Chapter {
  submissions?: Submission[];
}

export default function ChapterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState<ChapterDetailData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('upload');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ChapterDetailData>(`/chapters/${id}`);
      setChapter(res.data);
      setSubmissions(res.data.submissions || []);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al cargar el capítulo';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    document.title = chapter ? `${chapter.title} — Thena` : 'Cargando... — Thena';
  }, [chapter]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (!id) return;
    formData.append('chapterId', id);

    try {
      const res = await api.post('/submissions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('Documento subido correctamente');

      const jobId = res.data.reviewJob?.id;
      if (jobId) {
        navigate(`/chapters/${id}/review/${jobId}`);
      } else {
        fetchData();
      }
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al subir el documento');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="Error al cargar el capítulo"
        description={error}
        showIcon
        className="chapter-detail__error-alert"
        action={
          <Button size="small" onClick={fetchData}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (!chapter) return <Alert type="error" message="Capítulo no encontrado" />;

  const canUpload = chapter.status === 'DRAFT';
  const statusCfg = CHAPTER_STATUS[chapter.status];

  const latestCompletedReview = submissions
    .slice()
    .reverse()
    .find((s) => s.reviewJob?.status === 'COMPLETED');

  /* ── Table columns ─────────────────────────────────────── */
  const columns: ColumnsType<Submission> = [
    {
      title: 'Versión',
      dataIndex: 'versionNumber',
      key: 'version',
      render: (v: number) => `v${v}`,
      width: 80,
    },
    {
      title: 'Archivo',
      dataIndex: 'fileName',
      key: 'file',
      render: (name: string) => (
        <span>
          <FileWordOutlined className="chapter-detail__file-icon" />
          {name}
        </span>
      ),
    },
    {
      title: 'Fecha',
      dataIndex: 'submittedAt',
      key: 'date',
      render: (d: string) => formatDateTime(d),
      width: 160,
    },
    {
      title: 'Estado',
      key: 'status',
      width: 140,
      render: (_, record) => {
        const status = record.reviewJob?.status ?? 'QUEUED';
        const colors: Record<string, string> = {
          QUEUED: 'default',
          PROCESSING: 'processing',
          COMPLETED: 'success',
          FAILED: 'error',
        };
        const labels: Record<string, string> = {
          QUEUED: 'En Cola',
          PROCESSING: 'Procesando',
          COMPLETED: 'Completado',
          FAILED: 'Fallido',
        };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 140,
      render: (_, record) => {
        const job = record.reviewJob;
        if (!job) return null;

        if (job.status === 'COMPLETED') {
          return (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/chapters/${id}/review/${job.id}`)}
            >
              Ver Revisión
            </Button>
          );
        }
        if (job.status === 'QUEUED' || job.status === 'PROCESSING') {
          return (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/chapters/${id}/review/${job.id}`)}
            >
              Ver Progreso
            </Button>
          );
        }
        return null;
      },
    },
  ];

  /* ── Tab content ────────────────────────────────────────── */
  const uploadTabContent = (
    <div className="chapter-detail__tab-upload">
      {/* Status alerts */}
      {chapter.status === 'IN_REVIEW' && (
        <Alert
          type="info"
          message="Revisión en progreso"
          description="Hay una revisión en progreso. Esperá el resultado antes de subir una nueva versión."
          showIcon
          className="chapter-detail__status-alert"
        />
      )}
      {chapter.status === 'LOCKED' && (
        <Alert
          type="warning"
          message="Este capítulo está bloqueado"
          description="Debés completar y aprobar el capítulo anterior antes de poder subir este capítulo."
          showIcon
          className="chapter-detail__status-alert"
        />
      )}
      {chapter.status === 'APPROVED' && (
        <Alert
          type="success"
          message="Capítulo aprobado"
          description="Este capítulo ha sido aprobado por tu tutor."
          showIcon
          className="chapter-detail__status-alert"
        />
      )}

      {/* Upload dragger */}
      {canUpload && (
        <Card className="chapter-detail__upload-card">
          <Dragger
            accept=".docx"
            showUploadList={false}
            disabled={uploading}
            beforeUpload={(file) => {
              handleUpload(file);
              return false;
            }}
            className="chapter-detail__dragger"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#06175d', fontSize: 48 }} />
            </p>
            <p className="chapter-detail__dragger-heading">
              Subí tu archivo DOCX
            </p>
            <p className="chapter-detail__dragger-sub">
              Arrastrá y soltá aquí o hacé clic para seleccionar
            </p>
            <Button
              type="primary"
              loading={uploading}
              className="chapter-detail__dragger-btn"
              style={{ background: '#06175d', borderColor: '#06175d' }}
            >
              Seleccionar archivo
            </Button>
            <p className="chapter-detail__dragger-hint">
              Solo archivos .docx · Máx. 20MB
            </p>
          </Dragger>
        </Card>
      )}

      {/* Submissions history table */}
      <Card title="Historial de Entregas" className="chapter-detail__history-card">
        <Table
          dataSource={submissions}
          columns={columns}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: 'No hay entregas para este capítulo' }}
          scroll={{ x: 600 }}
        />
      </Card>
    </div>
  );

  const feedbackTabContent = (
    <div className="chapter-detail__tab-feedback">
      {latestCompletedReview ? (
        <Card className="chapter-detail__feedback-card">
          <Text type="secondary" className="chapter-detail__feedback-hint">
            Última revisión completada — v{latestCompletedReview.versionNumber}
          </Text>
          <div className="chapter-detail__feedback-actions">
            <Button
              type="primary"
              icon={<EyeOutlined />}
              onClick={() =>
                navigate(
                  `/chapters/${id}/review/${latestCompletedReview.reviewJob!.id}`,
                )
              }
              style={{ background: '#06175d', borderColor: '#06175d' }}
            >
              Ver Retroalimentación Completa
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="chapter-detail__feedback-empty">
          <Empty
            description="Aún no hay retroalimentación. Subí un documento para recibir tu primera revisión."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}
    </div>
  );

  const tabItems = [
    {
      key: 'upload',
      label: 'Subir Documento',
      children: uploadTabContent,
    },
    {
      key: 'feedback',
      label: 'Retroalimentación AI',
      children: feedbackTabContent,
    },
  ];

  return (
    <div className="chapter-detail">
      {/* Chapter header */}
      <div className="chapter-detail__header">
        <div className="chapter-detail__header-text">
          <span className="chapter-detail__chapter-label">CAPÍTULO {chapter.number}</span>
          <Title level={3} className="chapter-detail__chapter-title">
            {chapter.title}
          </Title>
        </div>
        <Tag
          color={statusCfg.tagColor}
          className="chapter-detail__status-tag"
        >
          {statusCfg.label}
        </Tag>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="chapter-detail__tabs"
      />
    </div>
  );
}
