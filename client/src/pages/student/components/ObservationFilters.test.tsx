import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ObservationFilters from './ObservationFilters';
import type { Observation } from '../../../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeObs = (type: Observation['type'], severity: Observation['severity']): Observation => ({
  id: `${type}-${severity}`,
  type,
  severity,
  message: 'Test',
  source: 'SYSTEM',
  isMutable: false,
  escalationLevel: 0,
});

const observations: Observation[] = [
  makeObs('STRUCTURE', 'WARNING'),
  makeObs('STRUCTURE', 'ERROR'),
  makeObs('CITATIONS', 'INFO'),
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ObservationFilters', () => {
  it('should render both filter selects', () => {
    render(
      <ObservationFilters
        observations={observations}
        typeFilter="ALL"
        severityFilter="ALL"
        onTypeChange={vi.fn()}
        onSeverityChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Filtrar por tipo')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtrar por severidad')).toBeInTheDocument();
  });

  it('should display total count in "Todos los tipos" option', () => {
    render(
      <ObservationFilters
        observations={observations}
        typeFilter="ALL"
        severityFilter="ALL"
        onTypeChange={vi.fn()}
        onSeverityChange={vi.fn()}
      />,
    );

    // The selected value for "ALL" type shows the count
    expect(screen.getByText(`Todos los tipos (${observations.length})`)).toBeInTheDocument();
  });

  it('should display total count in "Todas las severidades" option', () => {
    render(
      <ObservationFilters
        observations={observations}
        typeFilter="ALL"
        severityFilter="ALL"
        onTypeChange={vi.fn()}
        onSeverityChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(`Todas las severidades (${observations.length})`),
    ).toBeInTheDocument();
  });

  it('should show Tipo and Severidad labels', () => {
    render(
      <ObservationFilters
        observations={observations}
        typeFilter="ALL"
        severityFilter="ALL"
        onTypeChange={vi.fn()}
        onSeverityChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Severidad')).toBeInTheDocument();
  });

  it('should work with empty observations array', () => {
    render(
      <ObservationFilters
        observations={[]}
        typeFilter="ALL"
        severityFilter="ALL"
        onTypeChange={vi.fn()}
        onSeverityChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Todos los tipos (0)')).toBeInTheDocument();
    expect(screen.getByText('Todas las severidades (0)')).toBeInTheDocument();
  });
});
