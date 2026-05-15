import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ObservationCard from './ObservationCard';
import type { Observation } from '../../../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const baseObs: Observation = {
  id: 'obs-1',
  type: 'STRUCTURE',
  severity: 'WARNING',
  message: 'This needs improvement',
  suggestion: 'Try restructuring the paragraph',
  textFragment: 'Lorem ipsum dolor',
  source: 'SYSTEM',
  isMutable: false,
  escalationLevel: 0,
};

const mutableObs: Observation = {
  ...baseObs,
  id: 'obs-2',
  source: 'TUTOR',
  isMutable: true,
  authorName: 'Prof. García',
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ObservationCard', () => {
  it('should render the observation message', () => {
    render(
      <ObservationCard
        observation={baseObs}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('This needs improvement')).toBeInTheDocument();
  });

  it('should render the suggestion when present', () => {
    render(
      <ObservationCard
        observation={baseObs}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Try restructuring the paragraph')).toBeInTheDocument();
  });

  it('should render textFragment in a blockquote', () => {
    const { container } = render(
      <ObservationCard
        observation={baseObs}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    const blockquote = container.querySelector('blockquote');
    expect(blockquote).not.toBeNull();
    expect(blockquote?.textContent).toBe('Lorem ipsum dolor');
  });

  it('should not render blockquote when textFragment is absent', () => {
    const { container } = render(
      <ObservationCard
        observation={{ ...baseObs, textFragment: null }}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(container.querySelector('blockquote')).toBeNull();
  });

  it('should show "Thena" badge for SYSTEM source observations', () => {
    render(
      <ObservationCard
        observation={baseObs}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Thena')).toBeInTheDocument();
  });

  it('should show author name badge for TUTOR source observations', () => {
    render(
      <ObservationCard
        observation={mutableObs}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Prof. García')).toBeInTheDocument();
    expect(screen.queryByText('Thena')).toBeNull();
  });

  it('should call onClick when card is clicked', () => {
    const handleClick = vi.fn();
    const { container } = render(
      <ObservationCard
        observation={baseObs}
        isSelected={false}
        onClick={handleClick}
      />,
    );

    fireEvent.click(container.querySelector('.observation-card') ?? container.firstElementChild!);
    expect(handleClick).toHaveBeenCalledWith(baseObs);
  });

  it('should apply selected class when isSelected is true', () => {
    const { container } = render(
      <ObservationCard
        observation={baseObs}
        isSelected={true}
        onClick={vi.fn()}
      />,
    );

    // The card wraps in an ant-card — the className is on the outer div
    expect(container.querySelector('.observation-card--selected')).not.toBeNull();
  });

  it('should show edit and delete buttons for mutable observations', () => {
    render(
      <ObservationCard
        observation={mutableObs}
        isSelected={false}
        onClick={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument();
  });

  it('should NOT show action buttons for immutable observations', () => {
    render(
      <ObservationCard
        observation={baseObs}
        isSelected={false}
        onClick={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /editar/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /eliminar/i })).toBeNull();
  });

  it('should call onEdit without propagating to onClick', () => {
    const handleClick = vi.fn();
    const handleEdit = vi.fn();

    render(
      <ObservationCard
        observation={mutableObs}
        isSelected={false}
        onClick={handleClick}
        onEdit={handleEdit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(handleEdit).toHaveBeenCalledWith(mutableObs);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply escalated class when escalationLevel > 0', () => {
    const { container } = render(
      <ObservationCard
        observation={{ ...baseObs, escalationLevel: 1 }}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );

    expect(container.querySelector('.observation-card--escalated')).not.toBeNull();
  });
});
