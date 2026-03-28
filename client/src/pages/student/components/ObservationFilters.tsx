import { Select } from 'antd';
import type { AgentType, Severity } from '../../../types';

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
      <Select
        value={typeFilter}
        onChange={onTypeChange}
        style={{ flex: 1 }}
        options={[
          { value: 'ALL', label: 'Todos los tipos' },
          { value: 'STRUCTURE', label: 'Estructura' },
          { value: 'METHODOLOGY', label: 'Metodología' },
          { value: 'COHERENCE', label: 'Coherencia' },
        ]}
      />
      <Select
        value={severityFilter}
        onChange={onSeverityChange}
        style={{ flex: 1 }}
        options={[
          { value: 'ALL', label: 'Todas las severidades' },
          { value: 'ERROR', label: 'Error' },
          { value: 'WARNING', label: 'Advertencia' },
          { value: 'SUGGESTION', label: 'Sugerencia' },
          { value: 'INFO', label: 'Info' },
        ]}
      />
    </div>
  );
}
