import { useState, useCallback } from 'react';
import { Badge, Popover, List, Typography, Button, Space, Empty } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import type { Notification, NotificationType } from '../services/api';
import './NotificationBell.css';

const { Text, Paragraph } = Typography;

// ── Relative time helper ──────────────────────────────────────────────────────

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'hace un momento';
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  if (diffDays < 30) return `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

// ── Navigation resolver ────────────────────────────────────────────────────────

function getNavigationPath(type: NotificationType, metadata: Record<string, unknown> | null): string | null {
  switch (type) {
    case 'NEW_SUBMISSION':
      return '/tutor';
    case 'REVIEW_COMPLETE': {
      const chapterId = metadata?.chapterId as string | undefined;
      return chapterId ? `/chapters/${chapterId}` : '/chapters';
    }
    case 'CHAPTER_APPROVED':
    case 'CHAPTER_REJECTED': {
      const chapterId = metadata?.chapterId as string | undefined;
      return chapterId ? `/chapters/${chapterId}` : '/chapters';
    }
    case 'INACTIVITY_ALERT':
    case 'ESCALATION_ALERT':
      return '/dashboard';
    default:
      return null;
  }
}

// ── Single notification item ───────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string, path: string | null) => void;
}

function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const navPath = getNavigationPath(notification.type, notification.metadata);

  return (
    <List.Item
      className={[
        'notification-item',
        !notification.read ? 'notification-item--unread' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onRead(notification.id, navPath)}
    >
      <div className="notification-item__content">
        <div className="notification-item__header">
          <Text strong className="notification-item__title">
            {notification.title}
          </Text>
          <Text type="secondary" className="notification-item__time">
            {getRelativeTime(notification.createdAt)}
          </Text>
        </div>
        <Paragraph
          className="notification-item__body"
          ellipsis={{ rows: 2 }}
        >
          {notification.body}
        </Paragraph>
      </div>
    </List.Item>
  );
}

// ── NotificationBell ──────────────────────────────────────────────────────────

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotifications();

  const [open, setOpen] = useState(false);

  const handleRead = useCallback(
    async (id: string, path: string | null) => {
      await markAsRead(id);
      setOpen(false);
      if (path) {
        navigate(path);
      }
    },
    [markAsRead, navigate],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead();
  }, [markAllAsRead]);

  const content = (
    <div className="notification-bell__panel">
      {notifications.length === 0 && !loading ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No tenés notificaciones"
          className="notification-bell__empty"
        />
      ) : (
        <List
          className="notification-bell__list"
          dataSource={notifications}
          loading={loading}
          renderItem={(item) => (
            <NotificationItem
              key={item.id}
              notification={item}
              onRead={handleRead}
            />
          )}
        />
      )}

      {notifications.length > 0 && (
        <div className="notification-bell__footer">
          <Button
            type="link"
            size="small"
            disabled={unreadCount === 0}
            onClick={handleMarkAllAsRead}
            className="notification-bell__mark-all"
          >
            Marcar todas como leídas
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      title={
        <Space className="notification-bell__popover-title">
          <span>Notificaciones</span>
          {unreadCount > 0 && (
            <Badge count={unreadCount} size="small" color="#06175d" />
          )}
        </Space>
      }
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      overlayClassName="notification-bell__overlay"
      arrow={false}
    >
      <button
        type="button"
        className="notification-bell__trigger"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} notificaciones sin leer`
            : 'Notificaciones'
        }
      >
        <Badge count={unreadCount} size="small" overflowCount={99} color="#06175d">
          <BellOutlined className="notification-bell__icon" />
        </Badge>
      </button>
    </Popover>
  );
}
