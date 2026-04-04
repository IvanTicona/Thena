import { Select, Typography } from 'antd';
import type { AgentType, Severity } from '../../../types';

const { Text } = Typography;

interface ObservationFiltersProps {
  typeFilter: AgentType | 'ALL';
  severityFilter: Severity | 'ALL';
  onTypeChange: (value: AgentType | 'ALL') => void;
  onSeverityChange: (value: Severity | 'ALL') => void;
}

export default function ObservationFilters({
  typeFilter,
  severityFilter,
  onTypeChange,
  onSeverityChange,
}: ObservationFiltersProps) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>Tipo</Text>
        <Select
          value={typeFilter}
          onChange={onTypeChange}
          aria-label="Filtrar por tipo"
          options={[
            { value: 'ALL', label: 'Todos los tipos' },
            { value: 'STRUCTURE', label: 'Estructura' },
            { value: 'METHODOLOGY', label: 'Metodología' },
            { value: 'COHERENCE', label: 'Coherencia' },
          ]}
        />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>Severidad</Text>
        <Select
          value={severityFilter}
          onChange={onSeverityChange}
          aria-label="Filtrar por severidad"
          options={[
            { value: 'ALL', label: 'Todas las severidades' },
            { value: 'ERROR', label: 'Error' },
            { value: 'WARNING', label: 'Advertencia' },
            { value: 'SUGGESTION', label: 'Sugerencia' },
            { value: 'INFO', label: 'Info' },
          ]}
        />
      </div>
    </div>
  );
}
