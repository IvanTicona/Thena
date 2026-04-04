import type { ChapterStatus } from '../types';

/**
 * Canonical chapter status configuration.
 *
 * Single source of truth for status labels, Ant Design Tag preset colors,
 * and hex dot colors used in the sidebar.
 */
export const CHAPTER_STATUS: Record<
  ChapterStatus,
  { label: string; tagColor: string; dotColor: string }
> = {
  LOCKED:    { label: 'Bloqueado',   tagColor: 'default',    dotColor: '#d9d9d9' },
  DRAFT:     { label: 'Borrador',    tagColor: 'blue',       dotColor: '#1677ff' },
  IN_REVIEW: { label: 'En Revisión', tagColor: 'processing', dotColor: '#faad14' },
  APPROVED:  { label: 'Aprobado',    tagColor: 'success',    dotColor: '#52c41a' },
};
