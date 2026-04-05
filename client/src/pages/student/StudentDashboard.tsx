import { useEffect, useState, useMemo } from 'react';
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
  BulbOutlined,
  RocketOutlined,
  SearchOutlined,
  HourglassOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { thesisApi } from '../../services/api';
import type { Chapter, ThesisDocument } from '../../types';
import { CHAPTER_STATUS, STATUS_ICON } from '../../utils/status';
import { timeAgo } from '../../utils/format';
import './StudentDashboard.css';

const { Title, Text } = Typography;

/* ── Helpers ─────────────────────────────────────────────── */

function getFirstName(fullName: string): string {
  return fullName.split(' ')[0];
}

interface Tip {
  icon: React.ReactNode;
  text: React.ReactNode;
}

/**
 * Returns contextual tips based on the student's current chapter states.
 * Tips change dynamically — never generic filler.
 */
function buildContextualTips(chapters: Chapter[]): Tip[] {
  const tips: Tip[] = [];

  const hasEmptyDrafts = chapters.some(
    (c) => c.status === 'DRAFT' && c.submissionCount === 0,
  );
  const hasCompletedReviews = chapters.some(
    (c) => c.status === 'DRAFT' && c.submissionCount > 0,
  );
  const hasInReview = chapters.some((c) => c.status === 'IN_REVIEW');
  const allApproved =
    chapters.length > 0 && chapters.every((c) => c.status === 'APPROVED');

  if (hasEmptyDrafts) {
    tips.push({
      icon: <RocketOutlined />,
      text: (
        <>
          <strong>Empezá subiendo tu DOCX.</strong> No necesitás tenerlo
          perfecto — cada entrega genera retroalimentación que te ayuda a
          mejorar.
        </>
      ),
    });
  }

  if (hasCompletedReviews) {
    tips.push({
      icon: <SearchOutlined />,
      text: (
        <>
          <strong>Revisá las observaciones de Thena</strong> antes de
          solicitar revisión del tutor. Corregir los puntos señalados
          mejora tus chances de aprobación.
        </>
      ),
    });
  }

  if (hasInReview) {
    tips.push({
      icon: <HourglassOutlined />,
      text: (
        <>
          <strong>Mientras esperás al tutor,</strong> podés avanzar con el
          siguiente capítulo o subir correcciones en otros borradores.
        </>
      ),
    });
  }

  if (allApproved) {
    tips.push({
      icon: <RocketOutlined />,
      text: (
        <>
          <strong>¡Todos los capítulos aprobados!</strong> Tu proyecto de
          grado está completo. Felicitaciones.
        </>
      ),
    });
  }

  // ── Fixed tips (always visible, after contextual) ──

  tips.push({
    icon: <SafetyOutlined />,
    text: (
      <>
        <strong>Thena es orientativa.</strong> Las observaciones son
        sugerencias, no calificaciones. Tu tutor tiene la palabra final.
      </>
    ),
  });

  tips.push({
    icon: <RocketOutlined />,
    text: (
      <>
        <strong>Subí siempre archivos DOCX.</strong> Es el único formato
        que Thena puede analizar. Otros formatos como PDF no son compatibles.
      </>
    ),
  });

  tips.push({
    icon: <BulbOutlined />,
    text: (
      <>
        <strong>Podés hacer varias entregas.</strong> Cada nueva versión genera
        una revisión fresca. Iterá hasta que estés conforme antes de pedir
        revisión del tutor.
      </>
    ),
  });

  return tips;
}

/* ── Component ───────────────────────────────────────────── */

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

  const chapters: Chapter[] = thesis?.chapters ?? [];
  const tips = useMemo(() => buildContextualTips(chapters), [chapters]);

  if (loading) {
    return <Spin size="large" className="u-spinner-centered" />;
  }

  const approved = chapters.filter((c) => c.status === 'APPROVED').length;
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
          {/* Project summary card — full width */}
          <div className="student-dashboard__project-card">
            <div className="student-dashboard__project-header">
              <Text className="u-eyebrow-label student-dashboard__project-label">
                PROYECTO DE GRADO
              </Text>
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
                <span className="student-dashboard__project-percent-value">
                  {percent}%
                </span>
                <span className="student-dashboard__project-percent-label">
                  Progreso general
                </span>
              </div>
            </div>
          </div>

          {/* Two-column layout: chapters (main) + tips (aside) */}
          <div className="student-dashboard__body">
            {/* Main — chapter grid */}
            <div className="student-dashboard__main">
              <Title level={5} className="student-dashboard__section-title">
                Estado de Capítulos
              </Title>
              <Row gutter={[16, 16]}>
                {chapters.map((ch) => {
                  const cfg = CHAPTER_STATUS[ch.status];
                  const isLocked = ch.status === 'LOCKED';
                  return (
                    <Col key={ch.id} xs={24} sm={12}>
                      <Card
                        className={[
                          'student-dashboard__chapter-card',
                          isLocked
                            ? 'student-dashboard__chapter-card--locked'
                            : '',
                          !isLocked
                            ? 'student-dashboard__chapter-card--clickable'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        size="small"
                        onClick={() =>
                          !isLocked && navigate(`/chapters/${ch.id}`)
                        }
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
                        <div className="student-dashboard__chapter-card-title">
                          {ch.title}
                        </div>
                        <div className="student-dashboard__chapter-card-meta">
                          {ch.submissionCount > 0 && (
                            <span>
                              {ch.submissionCount}{' '}
                              {ch.submissionCount === 1
                                ? 'entrega'
                                : 'entregas'}
                            </span>
                          )}
                          {ch.latestSubmission && (
                            <span>
                              {ch.submissionCount > 0 ? ' · ' : ''}
                              {timeAgo(ch.latestSubmission.submittedAt)}
                            </span>
                          )}
                        </div>
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

            {/* Aside — contextual tips */}
            <aside className="student-dashboard__aside">
              <div className="student-dashboard__tips">
                <div className="student-dashboard__tips-header">
                  <BulbOutlined className="student-dashboard__tips-header-icon" />
                  <Text strong>Consejos</Text>
                </div>
                {tips.map((tip, i) => (
                  <div key={i} className="student-dashboard__tip">
                    <span className="student-dashboard__tip-icon">
                      {tip.icon}
                    </span>
                    <Text className="student-dashboard__tip-text">
                      {tip.text}
                    </Text>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </>
      ) : (
        <Card className="u-empty-state">
          <Text type="secondary">
            No tenés un proyecto de grado registrado.
          </Text>
        </Card>
      )}
    </div>
  );
}
