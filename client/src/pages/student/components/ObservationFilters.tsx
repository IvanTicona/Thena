import { Select, Typography } from 'antd';
import type { AgentType, Observation, Severity } from '../../../types';
import { AGENT_LABELS, SEVERITY_CONFIG } from './observation-config';

const { Text } = Typography;

interface ObservationFiltersProps {
  observations: Observation[];
  typeFilter: AgentType | 'ALL';
  severityFilter: Severity | 'ALL';
  onTypeChange: (value: AgentType | 'ALL') => void;
  onSeverityChange: (value: Severity | 'ALL') => void;
}

export default function ObservationFilters({
  observations,
  typeFilter,
  severityFilter,
  onTypeChange,
  onSeverityChange,
}: ObservationFiltersProps) {
  const totalCount = observations.length;

  const typeOptions = [
    { value: 'ALL' as const, label: `Todos los tipos (${totalCount})` },
    ...(Object.entries(AGENT_LABELS) as [AgentType, string][]).map(([value, label]) => {
      const count = observations.filter((o) => o.type === value).length;
      return { value, label: `${label} (${count})` };
    }),
  ];

  const severityOptions = [
    { value: 'ALL' as const, label: `Todas las severidades (${totalCount})` },
    ...(Object.entries(SEVERITY_CONFIG) as [Severity, { label: string; color: string; icon: React.ReactNode }][]).map(
      ([value, cfg]) => {
        const count = observations.filter((o) => o.severity === value).length;
        return { value, label: `${cfg.label} (${count})` };
      },
    ),
  ];

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>Tipo</Text>
        <Select
          value={typeFilter}
          onChange={onTypeChange}
          aria-label="Filtrar por tipo"
          options={typeOptions}
        />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>Severidad</Text>
        <Select
          value={severityFilter}
          onChange={onSeverityChange}
          aria-label="Filtrar por severidad"
          options={severityOptions}
        />
      </div>
    </div>
  );
}
