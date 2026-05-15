import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, formatDateTime, timeAgo } from './format';

describe('formatDate', () => {
  it('should return a formatted date string', () => {
    const result = formatDate('2024-03-15T00:00:00.000Z');
    // Should contain the year
    expect(result).toContain('2024');
    // Should contain a month abbreviation
    expect(result.length).toBeGreaterThan(5);
  });

  it('should handle different dates consistently', () => {
    const jan = formatDate('2024-01-01T00:00:00.000Z');
    const dec = formatDate('2024-12-31T00:00:00.000Z');
    expect(jan).not.toBe(dec);
  });
});

describe('formatDateTime', () => {
  it('should include time in the output', () => {
    const result = formatDateTime('2024-03-15T14:30:00.000Z');
    expect(result).toContain('2024');
    // Should be longer than formatDate (has time component)
    const dateOnly = formatDate('2024-03-15T14:30:00.000Z');
    expect(result.length).toBeGreaterThanOrEqual(dateOnly.length);
  });
});

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "hace un momento" for recent times', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    vi.setSystemTime(now);

    const thirtySecondsAgo = new Date(now.getTime() - 30_000).toISOString();
    expect(timeAgo(thirtySecondsAgo)).toBe('hace un momento');
  });

  it('should return "hace X minutos" for minutes ago', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    vi.setSystemTime(now);

    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('hace 5 minutos');
  });

  it('should return "hace 1 hora" for exactly 1 hour ago', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    vi.setSystemTime(now);

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    expect(timeAgo(oneHourAgo)).toBe('hace 1 hora');
  });

  it('should return "hace X horas" for multiple hours ago', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    vi.setSystemTime(now);

    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe('hace 3 horas');
  });

  it('should return "ayer" for exactly 1 day ago', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    vi.setSystemTime(now);

    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(oneDayAgo)).toBe('ayer');
  });

  it('should return "hace X días" for multiple days ago', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    vi.setSystemTime(now);

    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(fiveDaysAgo)).toBe('hace 5 días');
  });

  it('should fall back to formatDate for dates older than 30 days', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    vi.setSystemTime(now);

    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const result = timeAgo(twoMonthsAgo);
    // Should NOT contain relative phrasing
    expect(result).not.toMatch(/hace/);
    expect(result).toContain('2024');
  });
});
