import { useState } from 'react';
import {
  Card,
  Progress,
  Tag,
  Typography,
  List,
  Button,
  Avatar,
  Space,
} from 'antd';
import { UserOutlined, EyeOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ThesisDocument, ChapterStatus, Chapter } from '../types';
import './ThesisCard.css';

const { Text, Title } = Typography;

const STATUS_CONFIG: Record<ChapterStatus, { color: string; label: string }> = {
  LOCKED: { color: 'default', label: 'Bloqueado' },
  DRAFT: { color: 'blue', label: 'Borrador' },
  IN_REVIEW: { color: 'processing', label: 'En Revisión' },
  APPROVED: { color: 'success', label: 'Aprobado' },
};

interface ThesisCardProps {
  thesis: ThesisDocument;
  onApprove?: (chapterId: string, chapterTitle: string) => void;
  onReject?: (chapterId: string, chapterTitle: string) => void;
}

export function ThesisCard({ thesis, onApprove, onReject }: ThesisCardProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const chapters = thesis.chapters ?? [];
  const approvedCount = chapters.filter((c) => c.status === 'APPROVED').length;
  const totalCount = chapters.length;
  const progressPercent = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  const studentName = thesis.student?.name ?? 'Estudiante';
  const studentEmail = thesis.student?.email;

  return (
    <Card
      className="thesis-card"
      styles={{ body: { padding: '20px 24px' } }}
    >
      {/* Header row — student info + progress */}
      <div className="thesis-card__header">
        <Avatar size={48} icon={<UserOutlined />} className="thesis-card__avatar" />

        <div className="thesis-card__student-info">
          <Title level={5} style={{ margin: 0, color: '#111827' }}>
            {studentName}
          </Title>
          {studentEmail && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              {studentEmail}
            </Text>
          )}
          <div className="thesis-card__thesis-title">
            <Text>{thesis.title}</Text>
          </div>
        </div>

        <div className="thesis-card__progress">
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
          className="thesis-card__toggle-btn"
        >
          {expanded ? 'Ocultar capítulos' : 'Ver capítulos'}
        </Button>
      </div>

      {/* Expandable chapter list */}
      {expanded && (
        <div className="thesis-card__chapters">
          {chapters.length === 0 ? (
            <Text type="secondary">No hay capítulos registrados.</Text>
          ) : (
            <List<Chapter>
              dataSource={chapters}
              size="small"
              renderItem={(chapter) => {
                const cfg = STATUS_CONFIG[chapter.status];
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
                              `/tutor/submissions/${chapter.latestSubmission!.id}?chapterId=${chapter.id}`,
                            )
                          }
                        >
                          Ver revisión
                        </Button>
                      ) : null,
                      chapter.status === 'IN_REVIEW' && onApprove ? (
                        <Button
                          key="approve"
                          type="primary"
                          size="small"
                          onClick={() => onApprove(chapter.id, chapter.title)}
                        >
                          Aprobar
                        </Button>
                      ) : null,
                      chapter.status === 'IN_REVIEW' && onReject ? (
                        <Button
                          key="reject"
                          danger
                          size="small"
                          onClick={() => onReject(chapter.id, chapter.title)}
                        >
                          Rechazar
                        </Button>
                      ) : null,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      title={
                        <Space size="small">
                          <Text className="thesis-card__chapter-number">
                            Cap. {chapter.number}
                          </Text>
                          <Text>{chapter.title}</Text>
                          <Tag color={cfg.color}>{cfg.label}</Tag>
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
