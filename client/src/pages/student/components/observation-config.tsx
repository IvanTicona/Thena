import {
  InfoCircleOutlined,
  BulbOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { Severity, AgentType } from '../../../types';

export const SEVERITY_CONFIG: Record<
  Severity,
  { color: string; icon: React.ReactNode; label: string }
> = {
  INFO: { color: 'blue', icon: <InfoCircleOutlined />, label: 'Info' },
  SUGGESTION: { color: 'cyan', icon: <BulbOutlined />, label: 'Sugerencia' },
  WARNING: { color: 'orange', icon: <WarningOutlined />, label: 'Advertencia' },
  ERROR: { color: 'red', icon: <CloseCircleOutlined />, label: 'Error' },
};

export const AGENT_LABELS: Record<AgentType, string> = {
  STRUCTURE: 'Estructura',
  METHODOLOGY: 'Metodologia',
  COHERENCE: 'Coherencia',
};
