import { Card, Tag, Tooltip, Typography } from 'antd';
import type { Observation } from '../../../types';
import { SEVERITY_CONFIG, AGENT_LABELS } from './observation-config';

const { Text, Paragraph } = Typography;

interface ObservationCardProps {
  observation: Observation;
  isSelected: boolean;
  onClick: (obs: Observation) => void;
}

export default function ObservationCard({ observation, isSelected, onClick }: ObservationCardProps) {
  const cfg = SEVERITY_CONFIG[observation.severity];

  return (
    <Card
      size="small"
      style={{
        marginBottom: 8,
        cursor: 'pointer',
        borderColor: isSelected ? cfg.color : undefined,
        borderWidth: isSelected ? 2 : 1,
      }}
      onClick={() => onClick(observation)}
    >
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 4,
          alignItems: 'center',
        }}
      >
        <Tag color={cfg.color} icon={cfg.icon}>
          {cfg.label}
        </Tag>
        <Tag>{AGENT_LABELS[observation.type]}</Tag>
      </div>
      <Text>{observation.message}</Text>
      {observation.suggestion && (
        <Paragraph
          type="secondary"
          style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }}
        >
          {observation.suggestion}
        </Paragraph>
      )}
      {observation.textFragment && (
        <blockquote
          style={{
            marginTop: 8,
            padding: '4px 8px',
            background: '#fafafa',
            borderLeft: `3px solid ${cfg.color}`,
            fontSize: 12,
            color: '#666',
            margin: '8px 0 0 0',
          }}
        >
          {observation.textFragment}
        </blockquote>
      )}
      {observation.sourceReference && (
        <Tooltip
          title={`${observation.sourceReference.documentTitle} - ${observation.sourceReference.section}`}
        >
          <Text
            type="secondary"
            style={{
              fontSize: 11,
              display: 'block',
              marginTop: 4,
            }}
          >
            Fuente: {observation.sourceReference.layer === 'TUTOR' ? 'Tutor' : 'Institucional'} -{' '}
            {observation.sourceReference.section}
          </Text>
        </Tooltip>
      )}
    </Card>
  );
}
