import { useEffect, useState } from 'react';
import {
  Card,
  Col,
  Progress,
  Row,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { thesisApi } from '../../services/api';
import type { Chapter, ThesisDocument } from '../../types';
import { CHAPTER_STATUS, STATUS_ICON } from '../../utils/status';
import { StatCard } from '../../components/StatCard';
import './StudentDashboard.css';

const { Title, Text } = Typography;

/* ── Helpers ─────────────────────────────────────────────── */

function getFirstName(fullName: string): string {
  return fullName.split(' ')[0];
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [thesis, setThesis] = useState<ThesisDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Dashboard — Thena';
    thesisApi
      .findMine()
      .then((data) => setThesis(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Spin size="large" className="u-spinner-centered" />;
  }

  const chapters: Chapter[] = thesis?.chapters ?? [];

  const approved = chapters.filter((c) => c.status === 'APPROVED').length;
  const withObservations = chapters.filter((c) => c.status === 'DRAFT' && c.submissionCount > 0).length;
  const inReview = chapters.filter((c) => c.status === 'IN_REVIEW').length;
  const drafts = chapters.filter((c) => c.status === 'DRAFT').length;
  const total = chapters.length;
  const percent = total > 0 ? Math.round((approved / total) * 100) : 0;

  return (
    <div className="student-dashboard">
      {/* Welcome header */}
      <div className="student-dashboard__welcome">
        <Title level={3} className="student-dashboard__welcome-title">
          Bienvenido, {user ? getFirstName(user.name) : 'Estudiante'}
        </Title>
        <Text type="secondary">
          Aquí tenés un resumen del estado de tu proyecto de grado.
        </Text>
      </div>

      {thesis ? (
        <>
          {/* Project summary card */}
          <div className="student-dashboard__project-card">
            <div className="student-dashboard__project-header">
              <Text className="u-eyebrow-label student-dashboard__project-label">PROYECTO DE GRADO</Text>
              <Title level={4} className="student-dashboard__project-title">
                {thesis.title}
              </Title>
              {thesis.tutor && (
                <Text className="student-dashboard__project-tutor">
                  Tutor: {thesis.tutor.name}
                </Text>
              )}
            </div>
            <div className="student-dashboard__project-progress">
              <div className="student-dashboard__project-progress-info">
                <Text className="student-dashboard__project-progress-label">
                  Avance del proyecto
                </Text>
                <Text className="student-dashboard__project-progress-sub">
                  {approved} de {total} capítulos revisados
                </Text>
                <Progress
                  percent={percent}
                  strokeColor="#52c41a"
                  trailColor="rgba(255,255,255,0.3)"
                  showInfo={false}
                  className="student-dashboard__project-bar"
                />
              </div>
              <div className="student-dashboard__project-percent">
                <span className="student-dashboard__project-percent-value">{percent}%</span>
                <span className="student-dashboard__project-percent-label">Progreso general</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <Row gutter={[16, 16]} className="student-dashboard__stats-row">
            <Col xs={12} sm={6}>
              <StatCard
                icon={<CheckCircleOutlined />}
                value={approved}
                label="Capítulos Revisados"
                color="#52c41a"
              />
            </Col>
            <Col xs={12} sm={6}>
              <StatCard
                icon={<WarningOutlined />}
                value={withObservations}
                label="Con Observaciones"
                color="#faad14"
              />
            </Col>
            <Col xs={12} sm={6}>
              <StatCard
                icon={<ClockCircleOutlined />}
                value={inReview}
                label="En Revisión"
                color="#06175d"
              />
            </Col>
            <Col xs={12} sm={6}>
              <StatCard
                icon={<EditOutlined />}
                value={drafts}
                label="Pendientes"
                color="#4b5563"
              />
            </Col>
          </Row>

          {/* Chapter status grid */}
          <div className="student-dashboard__section">
            <Title level={5} className="student-dashboard__section-title">
              Estado de Capítulos
            </Title>
            <Row gutter={[16, 16]}>
              {chapters.map((ch) => {
                const cfg = CHAPTER_STATUS[ch.status];
                const isLocked = ch.status === 'LOCKED';
                return (
                  <Col key={ch.id} xs={24} sm={12} md={6}>
                    <Card
                      className={[
                        'student-dashboard__chapter-card',
                        isLocked ? 'student-dashboard__chapter-card--locked' : '',
                        !isLocked ? 'student-dashboard__chapter-card--clickable' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      size="small"
                      onClick={() => !isLocked && navigate(`/chapters/${ch.id}`)}
                    >
                      <div className="u-eyebrow-label student-dashboard__chapter-card-cap">
                        CAP. {ch.number}
                      </div>
                      <div
                        className="student-dashboard__chapter-card-icon"
                        style={{ color: cfg.dotColor }}
                      >
                        {STATUS_ICON[ch.status]}
                      </div>
                      <div className="student-dashboard__chapter-card-title">{ch.title}</div>
                      <Tag
                        color={cfg.tagColor}
                        className="student-dashboard__chapter-card-tag"
                      >
                        {cfg.label}
                      </Tag>
                      {ch.status === 'APPROVED' && (
                        <Progress
                          percent={100}
                          size="small"
                          strokeColor="#52c41a"
                          showInfo={false}
                          className="student-dashboard__chapter-card-bar"
                        />
                      )}
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>

          {/* Tips card */}
          <div className="student-dashboard__section">
            <Title level={5} className="student-dashboard__section-title">
              Consejos
            </Title>
            <Card className="student-dashboard__tips-card">
              <div className="student-dashboard__tip">
                <Text strong>Subí versiones frecuentes</Text>
                <Text type="secondary">
                  {' '}
                  — Cada entrega genera nueva retroalimentación. No esperes a tener el capítulo
                  terminado.
                </Text>
              </div>
              <div className="student-dashboard__tip">
                <Text strong>La IA es orientativa</Text>
                <Text type="secondary">
                  {' '}
                  — Las observaciones son sugerencias, no calificaciones. Tu tutor tiene la
                  palabra final.
                </Text>
              </div>
              <div className="student-dashboard__tip">
                <Text strong>Formato DOCX requerido</Text>
                <Text type="secondary">
                  {' '}
                  — Asegurate de exportar tu documento como .docx antes de subir.
                </Text>
              </div>
            </Card>
          </div>
        </>
      ) : (
        <Card className="u-empty-state">
          <Text type="secondary">No tenés un proyecto de grado registrado.</Text>
        </Card>
      )}
    </div>
  );
}
