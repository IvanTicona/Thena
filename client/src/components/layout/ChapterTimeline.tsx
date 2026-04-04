import {
  CheckCircleFilled,
  EditOutlined,
  LockOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { Typography } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { CHAPTER_STATUS } from '../../utils/status';
import type { Chapter, ChapterStatus } from '../../types';
import './ChapterTimeline.css';

const { Text } = Typography;

const STATUS_ICON: Record<ChapterStatus, React.ReactNode> = {
  LOCKED: <LockOutlined />,
  DRAFT: <EditOutlined />,
  IN_REVIEW: <SyncOutlined spin />,
  APPROVED: <CheckCircleFilled />,
};

interface ChapterTimelineProps {
  chapters: Chapter[];
}

export function ChapterTimeline({ chapters }: ChapterTimelineProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="chapter-timeline" aria-label="Progreso de capítulos">
      {chapters.map((ch, index) => {
        const status = ch.status;
        const cfg = CHAPTER_STATUS[status];
        const isLast = index === chapters.length - 1;
        const isActive = location.pathname.startsWith(`/chapters/${ch.id}`);
        const isClickable = status !== 'LOCKED';

        return (
          <div
            key={ch.id}
            className={[
              'chapter-timeline__item',
              `chapter-timeline__item--${status.toLowerCase().replace('_', '-')}`,
              isActive ? 'chapter-timeline__item--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => isClickable && navigate(`/chapters/${ch.id}`)}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={(e) => {
              if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                navigate(`/chapters/${ch.id}`);
              }
            }}
            aria-current={isActive ? 'step' : undefined}
          >
            {/* Dot node */}
            <div className="chapter-timeline__node">
              <div
                className="chapter-timeline__dot"
                style={{ borderColor: cfg.dotColor, color: cfg.dotColor }}
              >
                {STATUS_ICON[status]}
              </div>
              {/* Connector line to next item */}
              {!isLast && (
                <div
                  className="chapter-timeline__connector"
                  style={{
                    backgroundColor:
                      status === 'APPROVED' ? cfg.dotColor : '#e5e7eb',
                  }}
                />
              )}
            </div>

            {/* Text content */}
            <div className="chapter-timeline__content">
              <Text
                className="chapter-timeline__number"
                type={status === 'LOCKED' ? 'secondary' : undefined}
              >
                Cap. {ch.number}
              </Text>
              <Text
                className="chapter-timeline__title"
                type={status === 'LOCKED' ? 'secondary' : undefined}
                ellipsis={{ tooltip: ch.title }}
              >
                {ch.title}
              </Text>
              <Text className="chapter-timeline__label" style={{ color: cfg.dotColor }}>
                {cfg.label}
              </Text>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
