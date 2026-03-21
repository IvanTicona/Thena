import { useEffect, useState } from 'react';
import { Card, Row, Col, Tag, Typography, Spin, Empty } from 'antd';
import {
  LockOutlined,
  EditOutlined,
  SyncOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ApiError } from '../../services/api-error';
import type { Chapter, ChapterStatus } from '../../types';

const { Title, Text } = Typography;

const STATUS_CONFIG: Record<
  ChapterStatus,
  { color: string; label: string; icon: React.ReactNode }
> = {
  LOCKED: { color: 'default', label: 'Bloqueado', icon: <LockOutlined /> },
  DRAFT: { color: 'blue', label: 'Borrador', icon: <EditOutlined /> },
  IN_REVIEW: {
    color: 'processing',
    label: 'En Revision',
    icon: <SyncOutlined spin />,
  },
  APPROVED: {
    color: 'success',
    label: 'Aprobado',
    icon: <CheckCircleOutlined />,
  },
};

export default function ChapterList() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<Chapter[]>('/chapters')
      .then((res) => setChapters(res.data))
      .catch((err: ApiError) => {
        console.error(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!chapters.length) return <Empty description="No hay capitulos asignados" />;

  return (
    <div>
      <Title level={3}>Mis Capitulos</Title>
      <Row gutter={[16, 16]}>
        {chapters.map((ch) => {
          const cfg = STATUS_CONFIG[ch.status];
          const clickable = ch.status !== 'LOCKED';

          return (
            <Col xs={24} sm={12} lg={8} key={ch.id}>
              <Card
                hoverable={clickable}
                onClick={() => clickable && navigate(`/chapters/${ch.id}`)}
                style={{
                  opacity: ch.status === 'LOCKED' ? 0.6 : 1,
                  cursor: clickable ? 'pointer' : 'not-allowed',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Text strong>
                    Capitulo {ch.number}
                  </Text>
                  <Tag icon={cfg.icon} color={cfg.color}>
                    {cfg.label}
                  </Tag>
                </div>
                <Title level={5} style={{ margin: 0 }}>
                  {ch.title}
                </Title>
                {ch.latestSubmission && (
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                    Ultima entrega: v{ch.latestSubmission.versionNumber} -{' '}
                    {new Date(ch.latestSubmission.submittedAt).toLocaleDateString('es-BO')}
                  </Text>
                )}
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                  {ch.submissionCount} entrega{ch.submissionCount !== 1 ? 's' : ''}
                </Text>
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}
