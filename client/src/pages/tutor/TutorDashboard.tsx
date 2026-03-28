import { useEffect, useState } from 'react';
import {
  Typography,
  Table,
  Tag,
  Button,
  Spin,
  Modal,
  message,
  Card,
  Space,
  Progress,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ApiError } from '../../services/api-error';
import type { Chapter, ChapterStatus } from '../../types';

const { Title } = Typography;

const STATUS_CONFIG: Record<ChapterStatus, { color: string; label: string }> = {
  LOCKED: { color: 'default', label: 'Bloqueado' },
  DRAFT: { color: 'blue', label: 'Borrador' },
  IN_REVIEW: { color: 'processing', label: 'En Revisión' },
  APPROVED: { color: 'success', label: 'Aprobado' },
};

export default function TutorDashboard() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchChapters = () => {
    setLoading(true);
    api
      .get<Chapter[]>('/chapters')
      .then((res) => setChapters(res.data))
      .catch((err: ApiError) => {
        console.error(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchChapters();
  }, []);

  const handleApprove = (chapterId: string, chapterTitle: string) => {
    Modal.confirm({
      title: 'Aprobar capítulo',
      content: `¿Estás seguro de aprobar "${chapterTitle}"? Esto desbloqueará el siguiente capítulo para el estudiante.`,
      okText: 'Aprobar',
      okType: 'primary',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.patch(`/chapters/${chapterId}/approve`);
          message.success('Capítulo aprobado');
          fetchChapters();
        } catch (err) {
          message.error(err instanceof ApiError ? err.message : 'Error al aprobar el capítulo');
        }
      },
    });
  };

  const handleReject = (chapterId: string, chapterTitle: string) => {
    Modal.confirm({
      title: 'Rechazar capítulo',
      content: `¿Estás seguro de rechazar "${chapterTitle}"? El estudiante deberá subir una nueva versión.`,
      okText: 'Rechazar',
      okType: 'default',
      danger: true,
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.patch(`/chapters/${chapterId}/reject`);
          message.success('Capítulo rechazado');
          fetchChapters();
        } catch (err) {
          message.error(err instanceof ApiError ? err.message : 'Error al rechazar el capítulo');
        }
      },
    });
  };

  const columns: ColumnsType<Chapter> = [
    {
      title: '#',
      dataIndex: 'number',
      key: 'number',
      width: 60,
    },
    {
      title: 'Capítulo',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: ChapterStatus) => {
        const cfg = STATUS_CONFIG[status];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Entregas',
      dataIndex: 'submissionCount',
      key: 'submissions',
    },
    {
      title: 'Última Entrega',
      key: 'latest',
      render: (_, record) => {
        if (!record.latestSubmission) return '-';
        return new Date(record.latestSubmission.submittedAt).toLocaleDateString(
          'es-BO',
          { day: '2-digit', month: 'short', year: 'numeric' },
        );
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status !== 'LOCKED' && record.latestSubmission && (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() =>
                navigate(
                  `/tutor/submissions/${record.latestSubmission!.id}?chapterId=${record.id}`,
                )
              }
            >
              Ver revisión
            </Button>
          )}
          {record.status === 'IN_REVIEW' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record.id, record.title)}
              >
                Aprobar
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => handleReject(record.id, record.title)}
              >
                Rechazar
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const approvedCount = chapters.filter((c) => c.status === 'APPROVED').length;

  return (
    <div>
      <Title level={3}>Panel del Tutor</Title>

      {/* GAP 4: Progreso del estudiante */}
      <Card style={{ marginBottom: 24 }}>
        <Title level={5} style={{ marginBottom: 12 }}>
          Progreso del Estudiante
        </Title>
        {loading ? (
          <Spin size="small" />
        ) : (
          <Progress
            percent={Math.round((approvedCount / 8) * 100)}
            format={() => `${approvedCount}/8 capítulos aprobados`}
          />
        )}
      </Card>

      <Card>
        <Table
          dataSource={chapters}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
}
