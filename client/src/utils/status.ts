import React from 'react';
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  EditOutlined,
  LockOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ChapterStatus, JobStatus } from '../types';

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
  DRAFT:     { label: 'Borrador',    tagColor: 'blue',       dotColor: '#06175d' },
  IN_REVIEW: { label: 'En Revisión', tagColor: 'processing', dotColor: '#faad14' },
  APPROVED:  { label: 'Aprobado',    tagColor: 'success',    dotColor: '#52c41a' },
};

/**
 * Canonical chapter status icons.
 *
 * Single source of truth — used in ChapterTimeline, StudentDashboard,
 * and any other place that renders an icon per chapter status.
 */
export const STATUS_ICON: Record<ChapterStatus, React.ReactNode> = {
  LOCKED:    React.createElement(LockOutlined),
  DRAFT:     React.createElement(EditOutlined),
  IN_REVIEW: React.createElement(SyncOutlined, { spin: true }),
  APPROVED:  React.createElement(CheckCircleFilled, { style: { color: '#52c41a' } }),
};

/**
 * Canonical review job status configuration.
 *
 * Single source of truth for job status labels and Ant Design Tag colors.
 */
export const JOB_STATUS: Record<
  JobStatus,
  { label: string; tagColor: string }
> = {
  QUEUED:     { label: 'En Cola',     tagColor: 'default' },
  PROCESSING: { label: 'En Revisión', tagColor: 'processing' },
  COMPLETED:  { label: 'Revisado',    tagColor: 'success' },
  FAILED:     { label: 'Fallido',     tagColor: 'error' },
};

/**
 * Returns display { label, color } for a submission based on its reviewJob status.
 */
export function getSubmissionDisplayStatus(
  reviewJob: { status: JobStatus } | null | undefined,
): { label: string; color: string } {
  if (!reviewJob) {
    return { label: 'Sin revisión', color: 'default' };
  }
  const cfg = JOB_STATUS[reviewJob.status];
  return { label: cfg.label, color: cfg.tagColor };
}
