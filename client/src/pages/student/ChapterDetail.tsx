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

  const fetchData = useCallback(async () => {
    try {
      const [chRes] = await Promise.all([
        api.get<ChapterDetailData>(`/chapters/${id}`),
      ]);
      setChapter(chRes.data);
      setSubmissions(chRes.data.submissions || []);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al cargar el capítulo';
      console.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
  if (!chapter) return <Alert type="error" message="Capítulo no encontrado" />;

  const canUpload = chapter.status === 'DRAFT' || chapter.status === 'IN_REVIEW';

  const columns: ColumnsType<Submission> = [
    {
      title: 'Version',
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
          <FileWordOutlined style={{ marginRight: 4 }} />
          {name}
        </span>
      ),
    },
    {
      title: 'Fecha',
      dataIndex: 'submittedAt',
      key: 'date',
      render: (d: string) =>
        new Date(d).toLocaleDateString('es-BO', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
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
              Ver Revision
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
      <Title level={3}>
        Capítulo {chapter.number}: {chapter.title}
      </Title>

      {canUpload && (
        <Card style={{ marginBottom: 24 }}>
          <Title level={5}>Subir Documento</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
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

      {chapter.status === 'LOCKED' && (
        <Alert
          type="warning"
          message="Este capítulo está bloqueado"
          description="Debes completar y aprobar el capítulo anterior antes de poder subir este capítulo."
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {chapter.status === 'APPROVED' && (
        <Alert
          type="success"
          message="Capítulo aprobado"
          description="Este capítulo ha sido aprobado por tu tutor."
          showIcon
          style={{ marginBottom: 24 }}
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
