import { Card, Tag, Typography } from 'antd';
import type { ReviewReport, Severity } from '../../../types';
import { SEVERITY_CONFIG } from './observation-config';
import './ReviewSummaryCard.css';

const { Title, Paragraph, Text } = Typography;

interface ReviewSummaryCardProps {
  report: ReviewReport;
}

export default function ReviewSummaryCard({ report }: ReviewSummaryCardProps) {
  return (
    <Card size="small">
      <Title level={5} style={{ marginTop: 0 }}>
        Resumen
      </Title>

      {/* ── Summary text section ── */}
      <div className="review-summary-card__text">
        <Paragraph
          ellipsis={{ rows: 4, expandable: 'collapsible', symbol: (expanded: boolean) => expanded ? 'leer menos' : 'leer más' }}
        >
          {report.summaryText}
        </Paragraph>
      </div>

      <hr className="review-summary-card__divider" />

      {/* ── Severity metrics section ── */}
      <div className="review-summary-card__metrics">
        <Text className="review-summary-card__metrics-label">
          {report.totalObservations} observaciones en total
        </Text>
        <div className="review-summary-card__metrics-tags">
          {(
            Object.entries(report.bySeverity) as [Severity, number][]
          ).map(([sev, count]) => {
            if (!count) return null;
            const cfg = SEVERITY_CONFIG[sev];
            return (
              <Tag key={sev} icon={cfg.icon} color={cfg.color}>
                {cfg.label}: {count}
              </Tag>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
