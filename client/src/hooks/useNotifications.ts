import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationsApi } from '../services/api';
import type { Notification } from '../services/api';
import { useAuth } from '../contexts/useAuth';

const POLL_INTERVAL_MS = 8_000; // 8 seconds

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const { isAuthenticated } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const res = await notificationsApi.getAll(1, 20);
      if (!mountedRef.current) return;

      setNotifications(res.data.data);
      setUnreadCount(res.data.unreadCount);
    } catch {
      // Notifications must never crash the app — silently ignore errors
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Schedules the next poll only when the tab is visible.
   * Uses the Page Visibility API to suspend polling in background tabs.
   */
  const scheduleNextPoll = useCallback(() => {
    clearTimer();
    if (!isAuthenticated) return;

    timerRef.current = setTimeout(async () => {
      if (document.visibilityState === 'visible') {
        await fetchNotifications();
      }
      scheduleNextPoll();
    }, POLL_INTERVAL_MS);
  }, [isAuthenticated, clearTimer, fetchNotifications]);

  // Re-poll immediately when the tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        void fetchNotifications();
        scheduleNextPoll();
      } else {
        clearTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, fetchNotifications, scheduleNextPoll, clearTimer]);

  // Bootstrap: initial fetch + start polling when authenticated
  useEffect(() => {
    mountedRef.current = true;

    if (!isAuthenticated) {
      clearTimer();
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    void fetchNotifications();
    scheduleNextPoll();

    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [isAuthenticated, fetchNotifications, scheduleNextPoll, clearTimer]);

  const markAsRead = useCallback(
    async (id: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await notificationsApi.markAsRead(id);
      } catch {
        // Revert on error by re-fetching
        await fetchNotifications();
      }
    },
    [fetchNotifications],
  );

  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await notificationsApi.markAllAsRead();
    } catch {
      // Revert on error by re-fetching
      await fetchNotifications();
    }
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
