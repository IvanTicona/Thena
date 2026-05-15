import { describe, it, expect } from 'vitest';
import { CHAPTER_STATUS, JOB_STATUS } from './status';
import type { ChapterStatus, JobStatus } from '../types';

describe('CHAPTER_STATUS', () => {
  const statuses: ChapterStatus[] = ['LOCKED', 'DRAFT', 'IN_REVIEW', 'APPROVED'];

  it('should have an entry for every ChapterStatus', () => {
    statuses.forEach((status) => {
      expect(CHAPTER_STATUS[status]).toBeDefined();
    });
  });

  it('should have label, tagColor and dotColor for each status', () => {
    statuses.forEach((status) => {
      const cfg = CHAPTER_STATUS[status];
      expect(typeof cfg.label).toBe('string');
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(typeof cfg.tagColor).toBe('string');
      expect(typeof cfg.dotColor).toBe('string');
    });
  });

  it('should have correct label for APPROVED', () => {
    expect(CHAPTER_STATUS.APPROVED.label).toBe('Aprobado');
  });

  it('should have success tagColor for APPROVED', () => {
    expect(CHAPTER_STATUS.APPROVED.tagColor).toBe('success');
  });

  it('should have default tagColor for LOCKED', () => {
    expect(CHAPTER_STATUS.LOCKED.tagColor).toBe('default');
  });

  it('should have all statuses with unique labels', () => {
    const labels = statuses.map((s) => CHAPTER_STATUS[s].label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(statuses.length);
  });
});

describe('JOB_STATUS', () => {
  const statuses: JobStatus[] = ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'];

  it('should have an entry for every JobStatus', () => {
    statuses.forEach((status) => {
      expect(JOB_STATUS[status]).toBeDefined();
    });
  });

  it('should have label and tagColor for each job status', () => {
    statuses.forEach((status) => {
      const cfg = JOB_STATUS[status];
      expect(typeof cfg.label).toBe('string');
      expect(typeof cfg.tagColor).toBe('string');
    });
  });

  it('should have error tagColor for FAILED', () => {
    expect(JOB_STATUS.FAILED.tagColor).toBe('error');
  });

  it('should have success tagColor for COMPLETED', () => {
    expect(JOB_STATUS.COMPLETED.tagColor).toBe('success');
  });
});
