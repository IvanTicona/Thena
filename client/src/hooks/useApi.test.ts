import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApi } from './useApi';

// ── Mock api module ──────────────────────────────────────────────────────────

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from '../services/api';

const mockApi = api as { get: ReturnType<typeof vi.fn> };

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start with loading=false and no data when url is null', () => {
    const { result } = renderHook(() => useApi(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should set loading=true initially and data after fetch', async () => {
    mockApi.get.mockResolvedValue({ data: { id: '1', name: 'Test' } });

    const { result } = renderHook(() => useApi<{ id: string; name: string }>('/test'));

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ id: '1', name: 'Test' });
    expect(result.current.error).toBeNull();
  });

  it('should set error when the request fails', async () => {
    const { ApiError } = await import('../services/api-error');
    mockApi.get.mockRejectedValue(new ApiError('Not found', 404));

    const { result } = renderHook(() => useApi('/missing'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Not found');
    expect(result.current.data).toBeNull();
  });

  it('should re-fetch when url changes', async () => {
    mockApi.get
      .mockResolvedValueOnce({ data: 'first' })
      .mockResolvedValueOnce({ data: 'second' });

    let url = '/first';
    const { result, rerender } = renderHook(() => useApi<string>(url));

    await waitFor(() => expect(result.current.data).toBe('first'));

    url = '/second';
    rerender();

    await waitFor(() => expect(result.current.data).toBe('second'));
  });

  it('should expose setData for optimistic updates', async () => {
    mockApi.get.mockResolvedValue({ data: { count: 0 } });

    const { result } = renderHook(() => useApi<{ count: number }>('/test'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setData({ count: 5 });
    });

    expect(result.current.data).toEqual({ count: 5 });
  });
});
