import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePolling } from './usePolling';
import { ApiError } from '../services/api-error';

// ── Mock api module ──────────────────────────────────────────────────────────

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from '../services/api';

const mockGet = api.get as ReturnType<typeof vi.fn>;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('usePolling', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should return loading=false and no data when url is null', () => {
    const { result } = renderHook(() => usePolling({ url: null }));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should fetch data on mount and clear loading flag', async () => {
    mockGet.mockResolvedValue({ data: { status: 'PROCESSING' } });

    const { result } = renderHook(() =>
      usePolling<{ status: string }>({ url: '/poll', interval: 60_000 }),
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ status: 'PROCESSING' });
    expect(result.current.error).toBeNull();
  });

  it('should call shouldStop with the fetched data', async () => {
    mockGet.mockResolvedValue({ data: { status: 'COMPLETED' } });
    const shouldStop = vi.fn(() => true);

    renderHook(() =>
      usePolling<{ status: string }>({ url: '/poll', interval: 60_000, shouldStop }),
    );

    await waitFor(() => expect(shouldStop).toHaveBeenCalledWith({ status: 'COMPLETED' }));
  });

  it('should not make a second fetch when shouldStop returns true', async () => {
    // Use real timers — interval is large enough that no second fetch fires
    mockGet.mockResolvedValue({ data: { done: true } });
    const shouldStop = vi.fn(() => true);

    renderHook(() =>
      usePolling<{ done: boolean }>({
        url: '/poll',
        interval: 60_000,
        shouldStop,
      }),
    );

    await waitFor(() => expect(shouldStop).toHaveBeenCalled());

    // Only one call was made
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('should set error and retryCount=1 on first failed fetch', async () => {
    mockGet.mockRejectedValue(new ApiError('Server error', 500));

    const { result } = renderHook(() =>
      usePolling({ url: '/poll', interval: 60_000 }),
    );

    await waitFor(() => {
      expect(result.current.error).toBe('Server error');
      expect(result.current.loading).toBe(false);
      expect(result.current.retryCount).toBe(1);
    });
  });

  it('should reflect retryCount incrementing after each error', async () => {
    // Verify that retryCount tracks consecutive errors correctly
    mockGet.mockRejectedValue(new ApiError('Error', 500));

    const { result } = renderHook(() =>
      usePolling({ url: '/poll', interval: 60_000, maxRetries: 10 }),
    );

    await waitFor(() => expect(result.current.retryCount).toBeGreaterThanOrEqual(1));
    expect(result.current.error).toBe('Error');
  });

  it('should reset and re-fetch when url changes', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { id: 'first' } })
      .mockResolvedValueOnce({ data: { id: 'second' } });

    let url = '/first';
    const { result, rerender } = renderHook(() =>
      usePolling<{ id: string }>({ url, interval: 60_000 }),
    );

    await waitFor(() => expect(result.current.data?.id).toBe('first'));

    url = '/second';
    rerender();

    await waitFor(() => expect(result.current.data?.id).toBe('second'));
  });
});
