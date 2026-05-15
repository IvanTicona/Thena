import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReviewSummaryCard from './ReviewSummaryCard';
import type { ReviewReport } from '../../../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const baseReport: ReviewReport = {
  id: 'report-1',
  summaryText: 'El capítulo tiene buena estructura general pero necesita mejorar las citas.',
  totalObservations: 5,
  bySeverity: {
    INFO: 1,
    SUGGESTION: 2,
    WARNING: 2,
    ERROR: 0,
  },
  createdAt: '2024-06-01T00:00:00Z',
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewSummaryCard', () => {
  it('should render the summary text', () => {
    render(<ReviewSummaryCard report={baseReport} />);

    expect(
      screen.getByText(/El capítulo tiene buena estructura general/),
    ).toBeInTheDocument();
  });

  it('should display total observation count', () => {
    render(<ReviewSummaryCard report={baseReport} />);

    expect(screen.getByText(/5 observaciones en total/)).toBeInTheDocument();
  });

  it('should render severity tags for non-zero counts', () => {
    render(<ReviewSummaryCard report={baseReport} />);

    // INFO: 1, SUGGESTION: 2, WARNING: 2 should appear
    expect(screen.getByText(/Info: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Sugerencia: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Advertencia: 2/)).toBeInTheDocument();
  });

  it('should NOT render a severity tag when count is 0', () => {
    render(<ReviewSummaryCard report={baseReport} />);

    // ERROR count is 0 — should not appear
    expect(screen.queryByText(/Error: 0/)).toBeNull();
  });

  it('should render "Resumen" heading', () => {
    render(<ReviewSummaryCard report={baseReport} />);

    expect(screen.getByText('Resumen')).toBeInTheDocument();
  });

  it('should handle all-zero severity counts gracefully', () => {
    const emptyReport: ReviewReport = {
      ...baseReport,
      totalObservations: 0,
      bySeverity: { INFO: 0, SUGGESTION: 0, WARNING: 0, ERROR: 0 },
    };

    render(<ReviewSummaryCard report={emptyReport} />);

    expect(screen.getByText(/0 observaciones en total/)).toBeInTheDocument();
    // No severity tags should be visible
    expect(screen.queryByText(/Info:/)).toBeNull();
  });
});
