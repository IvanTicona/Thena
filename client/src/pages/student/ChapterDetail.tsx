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
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
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
      console.error(err);
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
    formData.append('chapterId', id!);

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
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al subir el documento';
      message.error(msg);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!chapter) return <Alert type="error" message="Capitulo no encontrado" />;

  const canUpload = chapter.status === 'DRAFT' || chapter.status === 'IN_REVIEW';

  const columns = [
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
      render: (_: unknown, record: Submission) => {
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
      render: (_: unknown, record: Submission) => {
        if (record.reviewJob?.status === 'COMPLETED') {
          return (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() =>
                navigate(`/chapters/${id}/review/${record.reviewJob!.id}`)
              }
            >
              Ver Revision
            </Button>
          );
        }
        if (
          record.reviewJob?.status === 'QUEUED' ||
          record.reviewJob?.status === 'PROCESSING'
        ) {
          return (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() =>
                navigate(`/chapters/${id}/review/${record.reviewJob!.id}`)
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
        Capitulo {chapter.number}: {chapter.title}
      </Title>

      {canUpload && (
        <Card style={{ marginBottom: 24 }}>
          <Title level={5}>Subir Documento</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Sube tu archivo DOCX para recibir retroalimentacion.
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
          message="Este capitulo esta bloqueado"
          description="Debes completar y aprobar el capitulo anterior antes de poder subir este capitulo."
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {chapter.status === 'APPROVED' && (
        <Alert
          type="success"
          message="Capitulo aprobado"
          description="Este capitulo ha sido aprobado por tu tutor."
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
          locale={{ emptyText: 'No hay entregas para este capitulo' }}
        />
      </Card>
    </div>
  );
}
