import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography, Spin } from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  metricsApi,
  type MetricsSummary,
  type ObservationsBySeverity,
  type ObservationsByAgent,
  type ReviewsOverTime,
} from '../../services/api';
import './MetricsDashboard.css';

const { Title, Text } = Typography;

const SEVERITY_COLORS: Record<string, string> = {
  ERROR: '#ff4d4f',
  WARNING: '#faad14',
  SUGGESTION: '#1890ff',
  INFO: '#52c41a',
};

const SEVERITY_LABELS: Record<string, string> = {
  ERROR: 'Error',
  WARNING: 'Advertencia',
  SUGGESTION: 'Sugerencia',
  INFO: 'Info',
};

const AGENT_COLORS = [
  '#06175d',
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#722ed1',
  '#13c2c2',
];

const AGENT_LABELS: Record<string, string> = {
  STRUCTURE: 'Estructura',
  METHODOLOGY: 'Metodología',
  COHERENCE: 'Coherencia',
  CITATIONS: 'Citas',
  FORMAT: 'Formato',
  INTEGRITY: 'Integridad',
};

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatDateShort(dateStr: string): string {
  // dateStr: "2026-04-01" → "01/04"
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

export default function MetricsDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [bySeverity, setBySeverity] = useState<ObservationsBySeverity[]>([]);
  const [byAgent, setByAgent] = useState<ObservationsByAgent[]>([]);
  const [reviewsOverTime, setReviewsOverTime] = useState<ReviewsOverTime[]>([]);

  useEffect(() => {
    document.title = 'Métricas del Sistema — Thena';

    Promise.all([
      metricsApi.getSummary(),
      metricsApi.getObservationsBySeverity(),
      metricsApi.getObservationsByAgent(),
      metricsApi.getReviewsOverTime(),
    ])
      .then(([summaryRes, severityRes, agentRes, reviewsRes]) => {
        setSummary(summaryRes.data);
        setBySeverity(severityRes.data);
        setByAgent(agentRes.data);
        setReviewsOverTime(reviewsRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="metrics-dashboard__loading">
        <Spin size="large" />
      </div>
    );
  }

  const severityChartData = bySeverity.map((row) => ({
    name: SEVERITY_LABELS[row.severity] ?? row.severity,
    count: row.count,
    fill: SEVERITY_COLORS[row.severity] ?? '#8c8c8c',
  }));

  const agentChartData = byAgent.map((row) => ({
    name: AGENT_LABELS[row.agent] ?? row.agent,
    value: row.count,
  }));

  const reviewsChartData = reviewsOverTime.map((row) => ({
    date: formatDateShort(row.date),
    count: row.count,
  }));

  return (
    <div className="metrics-dashboard">
      <div className="metrics-dashboard__header">
        <Title level={3}>Métricas del Sistema</Title>
        <Text type="secondary">
          Resumen de actividad y analíticas de revisión de Thena.
        </Text>
      </div>

      {/* ── Summary Cards ── */}
      <Row gutter={[16, 16]} className="metrics-dashboard__summary">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total de Tesis"
              value={summary?.totalTheses ?? 0}
              prefix={<FileTextOutlined />}
               styles={{ content: { color: '#06175d' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Revisiones Completadas"
              value={summary?.totalReviews ?? 0}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tiempo Promedio de Revisión"
              value={formatSeconds(summary?.avgReviewTimeSeconds ?? 0)}
              prefix={<ClockCircleOutlined />}
              styles={{ content: { color: '#faad14' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Estudiantes Activos (mes)"
              value={summary?.activeStudentsThisMonth ?? 0}
              prefix={<TeamOutlined />}
              styles={{ content: { color: '#1890ff' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Charts ── */}
      <Title level={5} className="metrics-dashboard__section-title">
        Observaciones por severidad
      </Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title="Observaciones por Severidad"
            className="metrics-dashboard__chart-card"
          >
            {severityChartData.length === 0 ? (
              <div className="metrics-dashboard__empty">
                Sin datos disponibles
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={severityChartData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [value, 'Observaciones']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {severityChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title="Observaciones por Agente Thena"
            className="metrics-dashboard__chart-card"
          >
            {agentChartData.length === 0 ? (
              <div className="metrics-dashboard__empty">
                Sin datos disponibles
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={agentChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {agentChartData.map((_entry, index) => (
                      <Cell
                        key={index}
                        fill={AGENT_COLORS[index % AGENT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(value) => (
                      <span style={{ fontSize: 12 }}>{value}</span>
                    )}
                  />
                  <Tooltip
                    formatter={(value: number) => [value, 'Observaciones']}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      <Title level={5} className="metrics-dashboard__section-title">
        Revisiones completadas — últimos 30 días
      </Title>
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card
            title="Revisiones Completadas por Día"
            className="metrics-dashboard__chart-card"
          >
            {reviewsChartData.every((d) => d.count === 0) ? (
              <div className="metrics-dashboard__empty">
                Sin actividad en los últimos 30 días
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={reviewsChartData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    interval={4}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [value, 'Revisiones']}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#06175d"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
