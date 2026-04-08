import { useEffect, useState, useCallback } from 'react';
import { Typography, Spin, Empty, Card, Progress, List, Button, Avatar, Space, Tag } from 'antd';
import { UserOutlined, EyeOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { reviewerApi } from '../../services/api';
import { ApiError } from '../../services/api-error';
import type { ThesisDocument, Chapter } from '../../types';
import { CHAPTER_STATUS } from '../../utils/status';
import './ReviewerDashboard.css';

const { Title, Text } = Typography;

function ReviewerThesisCard({ thesis }: { thesis: ThesisDocument }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const chapters = thesis.chapters ?? [];
  const approvedCount = chapters.filter((c) => c.status === 'APPROVED').length;
  const totalCount = chapters.length;
  const progressPercent = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  const studentName = thesis.student?.name ?? 'Estudiante';
  const studentEmail = thesis.student?.email;

  return (
    <Card className="reviewer-thesis-card" styles={{ body: { padding: '20px 24px' } }}>
      <div className="reviewer-thesis-card__header">
        <Avatar size={48} icon={<UserOutlined />} className="reviewer-thesis-card__avatar" />

        <div className="reviewer-thesis-card__student-info">
          <Title level={5} style={{ margin: 0, color: '#111827' }}>
            {studentName}
          </Title>
          {studentEmail && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              {studentEmail}
            </Text>
          )}
          <div className="reviewer-thesis-card__thesis-title">
            <Text>{thesis.title}</Text>
          </div>
        </div>

        <div className="reviewer-thesis-card__progress">
          <Progress
            percent={progressPercent}
            format={() => `${approvedCount}/${totalCount} aprobados`}
            strokeColor="#06175d"
          />
        </div>

        <Button
          type="text"
          icon={expanded ? <UpOutlined /> : <DownOutlined />}
          onClick={() => setExpanded(!expanded)}
          className="reviewer-thesis-card__toggle-btn"
        >
          {expanded ? 'Ocultar capítulos' : 'Ver capítulos'}
        </Button>
      </div>

      {expanded && (
        <div className="reviewer-thesis-card__chapters">
          {chapters.length === 0 ? (
            <Text type="secondary">No hay capítulos registrados.</Text>
          ) : (
            <List<Chapter>
              dataSource={chapters}
              size="small"
              renderItem={(chapter) => {
                const cfg = CHAPTER_STATUS[chapter.status];
                return (
                  <List.Item
                    actions={[
                      chapter.status !== 'LOCKED' && chapter.latestSubmission ? (
                        <Button
                          key="view"
                          type="link"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() =>
                            navigate(
                              `/reviewer/review/${chapter.latestSubmission!.id}?chapterId=${chapter.id}`,
                            )
                          }
                        >
                          Ver revisión
                        </Button>
                      ) : null,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      title={
                        <Space size="small">
                          <Text className="reviewer-thesis-card__chapter-number">
                            Cap. {chapter.number}
                          </Text>
                          <Text>{chapter.title}</Text>
                          <Tag color={cfg.tagColor}>{cfg.label}</Tag>
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </div>
      )}
    </Card>
  );
}

export default function ReviewerDashboard() {
  const [theses, setTheses] = useState<ThesisDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTheses = useCallback(() => {
    setLoading(true);
    reviewerApi
      .listTheses()
      .then((res) => setTheses(res.data))
      .catch((err: unknown) => {
        if (err instanceof ApiError) console.error(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTheses();
  }, [fetchTheses]);

  useEffect(() => {
    document.title = 'Panel del Revisor — Thena';
  }, []);

  return (
    <div>
      <Title level={3}>Panel del Revisor</Title>

      {loading ? (
        <div className="reviewer-dashboard__loading">
          <Spin size="large" />
        </div>
      ) : theses.length === 0 ? (
        <div className="reviewer-dashboard__empty">
          <Empty description="No tenés proyectos asignados todavía" />
          <Text type="secondary" className="reviewer-dashboard__empty-hint">
            Los estudiantes aparecerán aquí cuando sean asignados a vos como revisor.
          </Text>
        </div>
      ) : (
        theses.map((thesis) => (
          <ReviewerThesisCard key={thesis.id} thesis={thesis} />
        ))
      )}
    </div>
  );
}
