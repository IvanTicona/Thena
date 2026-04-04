import { Card, Tag, Typography } from 'antd';
import type { ReviewReport, Severity } from '../../../types';
import { SEVERITY_CONFIG } from './observation-config';

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
      <Paragraph
        ellipsis={{ rows: 4, expandable: true, symbol: 'leer más' }}
      >
        {report.summaryText}
      </Paragraph>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        {report.totalObservations} observaciones en total
      </Text>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
    </Card>
  );
}
