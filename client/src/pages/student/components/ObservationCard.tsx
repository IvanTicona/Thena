import { Card, Tag, Tooltip, Typography } from 'antd';
import { RobotOutlined, UserOutlined } from '@ant-design/icons';
import type { Observation } from '../../../types';
import { SEVERITY_CONFIG, AGENT_LABELS } from './observation-config';
import './ObservationCard.css';

const { Text, Paragraph } = Typography;

interface ObservationCardProps {
  observation: Observation;
  isSelected: boolean;
  onClick: (obs: Observation) => void;
}

export default function ObservationCard({ observation, isSelected, onClick }: ObservationCardProps) {
  const cfg = SEVERITY_CONFIG[observation.severity];
  const isEscalated = (observation.escalationLevel ?? 0) > 0;
  const isThena = !observation.source || observation.source === 'SYSTEM';

  return (
    <Card
      size="small"
      className={[
        'observation-card',
        isSelected ? 'observation-card--selected' : '',
        isEscalated ? 'observation-card--escalated' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--card-severity-color': cfg.color } as React.CSSProperties}
      data-card-id={observation.id}
      onClick={() => onClick(observation)}
    >
      <div className="observation-card__header">
        <Tag color={cfg.color} icon={cfg.icon}>
          {cfg.label}
        </Tag>
        <Tag>{AGENT_LABELS[observation.type]}</Tag>
        {/* Source badge: Thena (blue) or tutor name (green) */}
        {isThena ? (
          <Tag
            icon={<RobotOutlined />}
            color="blue"
            className="observation-card__source-badge"
          >
            Thena
          </Tag>
        ) : (
          <Tag
            icon={<UserOutlined />}
            color="green"
            className="observation-card__source-badge"
          >
            {observation.authorName ?? 'Tutor'}
          </Tag>
        )}
      </div>
      <Text>{observation.message}</Text>
      {observation.suggestion && (
        <Paragraph
          type="secondary"
          className="observation-card__suggestion"
        >
          {observation.suggestion}
        </Paragraph>
      )}
      {observation.textFragment && (
        <blockquote className="observation-card__quote">
          {observation.textFragment}
        </blockquote>
      )}
      {observation.sourceReference && (
        <Tooltip
          title={`${observation.sourceReference.documentTitle} - ${observation.sourceReference.section}`}
        >
          <Text
            type="secondary"
            className="observation-card__source"
          >
            Fuente: {observation.sourceReference.layer === 'TUTOR' ? 'Tutor' : 'Institucional'} -{' '}
            {observation.sourceReference.section}
          </Text>
        </Tooltip>
      )}
    </Card>
  );
}
