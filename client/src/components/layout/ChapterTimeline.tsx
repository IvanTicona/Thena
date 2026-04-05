import { Typography } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { CHAPTER_STATUS, STATUS_ICON } from '../../utils/status';
import type { Chapter } from '../../types';
import './ChapterTimeline.css';

const { Text } = Typography;

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
        const isFirst = index === 0;
        const isLast = index === chapters.length - 1;
        const isActive = location.pathname.startsWith(`/chapters/${ch.id}`);
        const isClickable = status !== 'LOCKED';

        // Previous chapter's connector color (for the top-half line)
        const prevStatus = !isFirst ? chapters[index - 1].status : null;
        const prevCfg = prevStatus ? CHAPTER_STATUS[prevStatus] : null;
        const topConnectorColor = prevStatus === 'APPROVED' && prevCfg
          ? prevCfg.dotColor
          : '#e5e7eb';

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
            {/* Top half connector (from previous item) */}
            {!isFirst && (
              <div
                className="chapter-timeline__connector-top"
                style={{ backgroundColor: topConnectorColor }}
              />
            )}

            {/* Bottom half connector (to next item) */}
            {!isLast && (
              <div
                className="chapter-timeline__connector"
                style={{
                  backgroundColor:
                    status === 'APPROVED' ? cfg.dotColor : '#e5e7eb',
                }}
              />
            )}

            {/* Dot */}
            <div
              className="chapter-timeline__dot"
              style={{ backgroundColor: cfg.dotColor, color: '#ffffff' }}
            >
              {STATUS_ICON[status]}
            </div>

            {/* Text content — compact: number + title only */}
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
                ellipsis
              >
                {ch.title}
              </Text>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
