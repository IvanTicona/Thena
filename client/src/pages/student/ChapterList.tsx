import { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Tag, Typography, Spin, Empty, Alert, Button } from 'antd';
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
import { formatDate } from '../../utils/format';
import './ChapterList.css';

const { Title, Text } = Typography;

const STATUS_CONFIG: Record<
  ChapterStatus,
  { color: string; label: string; icon: React.ReactNode }
> = {
  LOCKED: { color: 'default', label: 'Bloqueado', icon: <LockOutlined /> },
  DRAFT: { color: 'blue', label: 'Borrador', icon: <EditOutlined /> },
  IN_REVIEW: {
    color: 'processing',
    label: 'En Revisión',
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
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchChapters = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<Chapter[]>('/chapters')
      .then((res) => setChapters(res.data))
      .catch((err: ApiError) => {
        setError(err.message || 'Error al cargar los capítulos');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);

  useEffect(() => { document.title = 'Mis Capítulos — Thena'; }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  if (error) {
    return (
      <Alert
        type="error"
        message="Error al cargar los capítulos"
        description={error}
        showIcon
        style={{ maxWidth: 600, margin: '60px auto' }}
        action={
          <Button size="small" onClick={fetchChapters}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (!chapters.length) return <Empty description="No se encontraron capítulos para tu proyecto." />;

  return (
    <div>
      <Title level={3} className="font-academic">Mis Capítulos</Title>
      <Row gutter={[16, 16]}>
        {chapters.map((ch) => {
          const cfg = STATUS_CONFIG[ch.status];
          const clickable = ch.status !== 'LOCKED';

          return (
            <Col xs={24} sm={12} lg={8} key={ch.id}>
              <Card
                hoverable={clickable}
                onClick={() => clickable && navigate(`/chapters/${ch.id}`)}
                className={`chapter-list__card${ch.status === 'LOCKED' ? ' chapter-list__card--locked' : ''}`}
                style={{ cursor: clickable ? 'pointer' : 'not-allowed' }}
              >
                <div className="chapter-list__card-header">
                  <Text strong>
                    Capítulo {ch.number}
                  </Text>
                  <Tag icon={cfg.icon} color={cfg.color}>
                    {cfg.label}
                  </Tag>
                </div>
                <Title level={5} style={{ margin: 0 }}>
                  {ch.title}
                </Title>
                {ch.latestSubmission && (
                  <Text type="secondary" className="chapter-list__submission-date">
                    Última entrega: v{ch.latestSubmission.versionNumber} -{' '}
                    {formatDate(ch.latestSubmission.submittedAt)}
                  </Text>
                )}
                <Text type="secondary" className="chapter-list__submission-count">
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
