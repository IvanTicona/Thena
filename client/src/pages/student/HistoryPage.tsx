import { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Col,
  Row,
  Select,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  FileTextOutlined,
} from '@ant-design/icons';
import { submissionsApi, type SubmissionWithChapter } from '../../services/api';
import { CHAPTER_STATUS, JOB_STATUS, getSubmissionDisplayStatus } from '../../utils/status';
import { formatDate } from '../../utils/format';
import './HistoryPage.css';

const { Title, Text } = Typography;

/* ── Component ───────────────────────────────────────────── */

export default function HistoryPage() {
  const [allSubmissions, setAllSubmissions] = useState<SubmissionWithChapter[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterChapter, setFilterChapter] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    document.title = 'Historial — Thena';

    async function load() {
      try {
        const res = await submissionsApi.listMine();
        setAllSubmissions(res.data);
      } catch {
        // Silencioso — la lista queda vacía
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  /* ── Unique chapters for filter dropdown ─────────────────── */
  const uniqueChapters = useMemo(() => {
    const map = new Map<string, { id: string; number: number; title: string }>();
    allSubmissions.forEach((sub) => {
      if (!map.has(sub.chapter.id)) {
        map.set(sub.chapter.id, sub.chapter);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.number - b.number);
  }, [allSubmissions]);

  /* ── Stats ─────────────────────────────────────────────── */
  const totalCount = allSubmissions.length;
  const reviewedCount = allSubmissions.filter(
    (s) => s.reviewJob?.status === 'COMPLETED',
  ).length;
  const pendingCount = allSubmissions.filter(
    (s) => !s.reviewJob || s.reviewJob.status === 'QUEUED' || s.reviewJob.status === 'PROCESSING',
  ).length;

  /* ── Filtered list ──────────────────────────────────────── */
  const filtered = useMemo(() => {
    return allSubmissions.filter((sub) => {
      if (filterChapter !== 'all' && sub.chapterId !== filterChapter) return false;
      if (filterStatus !== 'all') {
        const jobStatus = sub.reviewJob?.status ?? 'NONE';
        if (filterStatus !== jobStatus) return false;
      }
      return true;
    });
  }, [allSubmissions, filterChapter, filterStatus]);

  /* ── Chapter options for filter ─────────────────────────── */
  const chapterOptions = [
    { value: 'all', label: 'Todos los capítulos' },
    ...uniqueChapters.map((ch) => ({
      value: ch.id,
      label: `Cap. ${ch.number}: ${ch.title}`,
    })),
  ];

  const statusOptions = [
    { value: 'all', label: 'Todos los estados' },
    ...Object.entries(JOB_STATUS).map(([key, cfg]) => ({
      value: key,
      label: cfg.label,
    })),
  ];

  if (loading) {
    return <Spin size="large" className="history-page__spinner" />;
  }

  return (
    <div className="history-page">
      {/* Page header */}
      <div className="history-page__header">
        <Title level={3} className="history-page__title">
          Historial de Revisiones
        </Title>
        <Text type="secondary">
          Todas tus entregas y su retroalimentación generada por IA.
        </Text>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} className="history-page__stats">
        <Col xs={24} sm={8}>
          <Card size="small" className="history-page__stat-card">
            <div className="history-page__stat-inner">
              <div className="history-page__stat-value">{totalCount}</div>
              <div className="history-page__stat-label">Total Entregas</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" className="history-page__stat-card">
            <div className="history-page__stat-inner">
              <div className="history-page__stat-value history-page__stat-value--green">
                {reviewedCount}
              </div>
              <div className="history-page__stat-label">Revisadas</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" className="history-page__stat-card">
            <div className="history-page__stat-inner">
              <div className="history-page__stat-value history-page__stat-value--orange">
                {pendingCount}
              </div>
              <div className="history-page__stat-label">Pendientes</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <div className="history-page__filters">
        <Text className="history-page__filters-label">Filtrar:</Text>
        <Select
          value={filterChapter}
          onChange={setFilterChapter}
          options={chapterOptions}
          className="history-page__filter-select"
        />
        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          options={statusOptions}
          className="history-page__filter-select"
        />
        <Text type="secondary" className="history-page__results-count">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </Text>
      </div>

      {/* Submissions list */}
      {filtered.length === 0 ? (
        <Card className="history-page__empty">
          <Text type="secondary">No hay entregas con los filtros seleccionados.</Text>
        </Card>
      ) : (
        <div className="history-page__list">
          {filtered.map((sub) => {
            const { label, color } = getSubmissionDisplayStatus(sub.reviewJob);
            const chCfg = CHAPTER_STATUS[sub.chapter.status as keyof typeof CHAPTER_STATUS];
            return (
              <Card
                key={sub.id}
                size="small"
                className="history-page__list-item"
              >
                <div className="history-page__list-item-inner">
                  <FileTextOutlined className="history-page__list-item-icon" />
                  <div className="history-page__list-item-info">
                    <Text strong className="history-page__list-item-filename">
                      {sub.fileName}
                    </Text>
                    <Text type="secondary" className="history-page__list-item-meta">
                      Cap. {sub.chapter.number}: {sub.chapter.title} · v{sub.versionNumber}
                    </Text>
                  </div>
                  <div className="history-page__list-item-right">
                    <Tag color={color} className="history-page__list-item-review-tag">
                      {label}
                    </Tag>
                    {chCfg && (
                      <Tag color={chCfg.tagColor} className="history-page__list-item-chapter-tag">
                        {chCfg.label}
                      </Tag>
                    )}
                    <Text type="secondary" className="history-page__list-item-date">
                      {formatDate(sub.submittedAt)}
                    </Text>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
