import { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Upload,
  Button,
  Card,
  Table,
  Tag,
  Spin,
  message,
  Alert,
  Breadcrumb,
} from 'antd';
import {
  UploadOutlined,
  FileWordOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ApiError } from '../../services/api-error';
import type { Chapter, Submission } from '../../types';
import { formatDateTime } from '../../utils/format';
import './ChapterDetail.css';

const { Title, Text } = Typography;

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [chRes] = await Promise.all([
        api.get<ChapterDetailData>(`/chapters/${id}`),
      ]);
      setChapter(chRes.data);
      setSubmissions(chRes.data.submissions || []);
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

      // Navigate to review view if job was created
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

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

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

  const columns: ColumnsType<Submission> = [
    {
      title: 'Versión',
      dataIndex: 'versionNumber',
      key: 'version',
      render: (v: number) => `v${v}`,
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
    },
    {
      title: 'Estado',
      key: 'status',
      render: (_, record) => {
        const status = record.reviewJob?.status || 'QUEUED';
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
      render: (_, record) => {
        const job = record.reviewJob;
        if (!job) return null;

        if (job.status === 'COMPLETED') {
          return (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() =>
                navigate(`/chapters/${id}/review/${job.id}`)
              }
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
              onClick={() =>
                navigate(`/chapters/${id}/review/${job.id}`)
              }
            >
              Ver Progreso
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div>
      <Breadcrumb
        className="chapter-detail__breadcrumb"
        items={[
          { title: 'Mis Capítulos' },
          { title: `Capítulo ${chapter.number}: ${chapter.title}` },
        ]}
      />
      <Title level={3}>
        Capítulo {chapter.number}: {chapter.title}
      </Title>

      {canUpload && (
        <Card className="chapter-detail__upload-card">
          <Title level={5}>Subir Documento</Title>
          <Text type="secondary" className="chapter-detail__upload-hint">
            Sube tu archivo DOCX para recibir retroalimentación.
          </Text>
          <Upload
            accept=".docx"
            showUploadList={false}
            beforeUpload={(file) => {
              handleUpload(file);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />} loading={uploading} type="primary">
              Subir DOCX
            </Button>
          </Upload>
        </Card>
      )}

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
          description="Debes completar y aprobar el capítulo anterior antes de poder subir este capítulo."
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

      <Card title="Historial de Entregas">
        <Table
          dataSource={submissions}
          columns={columns}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: 'No hay entregas para este capítulo' }}
        />
      </Card>
    </div>
  );
}
