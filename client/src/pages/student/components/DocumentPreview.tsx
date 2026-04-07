import { forwardRef, useMemo } from 'react';
import { Empty, Tooltip } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Observation, Severity } from '../../../types';
import './DocumentPreview.css';

interface DocumentPreviewProps {
  markdownContent: string | null;
  observations?: Observation[];
  selectedObsId?: string | null;
  onHighlightClick?: (obsId: string) => void;
}

/**
 * Injects highlight markers into markdown content for each observation that has a textFragment.
 * Each match is wrapped with a custom <obs-highlight> element that carries the obs id and severity.
 * Overlapping/nested fragments are handled by processing longest-first to avoid double-wrapping.
 */
function injectHighlights(markdown: string, observations: Observation[]): string {
  // Only process observations that have a textFragment
  const toHighlight = observations
    .filter((o) => o.textFragment && o.textFragment.trim().length > 0)
    // Sort longest-first so longer matches wrap before shorter ones that might be substrings
    .sort((a, b) => (b.textFragment?.length ?? 0) - (a.textFragment?.length ?? 0));

  if (toHighlight.length === 0) return markdown;

  let result = markdown;

  for (const obs of toHighlight) {
    const fragment = obs.textFragment!;

    // Escape any regex special chars in the fragment for safe matching
    const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Only replace the FIRST occurrence to avoid false positives in repeated text
    const regex = new RegExp(escaped, '');

    if (!regex.test(result)) {
      // textFragment not found — skip gracefully
      continue;
    }

    const openTag = `<obs-highlight data-obs-id="${obs.id}" data-severity="${obs.severity}">`;
    const closeTag = `</obs-highlight>`;

    result = result.replace(regex, `${openTag}${fragment}${closeTag}`);
  }

  return result;
}

const DocumentPreview = forwardRef<HTMLDivElement, DocumentPreviewProps>(
  ({ markdownContent, observations = [], selectedObsId, onHighlightClick }, ref) => {
    const processedContent = useMemo(() => {
      if (!markdownContent) return null;
      return injectHighlights(markdownContent, observations);
    }, [markdownContent, observations]);

    return (
      <div ref={ref} className="document-preview">
        {processedContent ? (
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                'obs-highlight': ({ node, children, ...props }: any) => {
                  const obsId = props['data-obs-id'] as string;
                  const severity = props['data-severity'] as Severity;
                  const obs = observations.find((o) => o.id === obsId);
                  const isSelected = selectedObsId === obsId;

                  const tooltipTitle = obs
                    ? obs.suggestion
                      ? `${obs.message} → ${obs.suggestion}`
                      : obs.message
                    : undefined;

                  const severityClass = `document-preview__highlight--${severity.toLowerCase()}`;
                  const selectedClass = isSelected ? 'document-preview__highlight--selected' : '';

                  return (
                    <Tooltip title={tooltipTitle} placement="top">
                      <mark
                        data-obs-id={obsId}
                        onClick={() => onHighlightClick?.(obsId)}
                        className={`document-preview__highlight ${severityClass} ${selectedClass}`.trim()}
                      >
                        {children}
                      </mark>
                    </Tooltip>
                  );
                },
              }}
            >
              {processedContent}
            </ReactMarkdown>
          </div>
        ) : (
          <Empty description="No se pudo cargar el contenido del documento" />
        )}
      </div>
    );
  },
);

DocumentPreview.displayName = 'DocumentPreview';

export default DocumentPreview;
