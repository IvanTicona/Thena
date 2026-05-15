import {
  forwardRef,
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { Empty, Tooltip, Skeleton } from 'antd';
import mammoth from 'mammoth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { submissionsApi } from '../../../services/api';
import type { Observation, Severity } from '../../../types';
import './DocumentPreview.css';

interface DocumentPreviewProps {
  submissionId?: string | null;
  markdownContent: string | null;
  observations?: Observation[];
  selectedObsId?: string | null;
  onHighlightClick?: (obsId: string) => void;
}

// ─── Markdown fallback: inject highlight markers into markdown ─────────────────

/**
 * Injects <obs-highlight> markers into markdown for each observation with a textFragment.
 * Longest-first to avoid double-wrapping substrings.
 */
function injectHighlightsIntoMarkdown(
  markdown: string,
  observations: Observation[],
): string {
  const toHighlight = observations
    .filter((o) => o.textFragment && o.textFragment.trim().length > 0)
    .sort((a, b) => (b.textFragment?.length ?? 0) - (a.textFragment?.length ?? 0));

  if (toHighlight.length === 0) return markdown;

  let result = markdown;

  for (const obs of toHighlight) {
    const fragment = obs.textFragment!;
    const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, '');

    if (!regex.test(result)) continue;

    const openTag = `<obs-highlight data-obs-id="${obs.id}" data-severity="${obs.severity}">`;
    const closeTag = `</obs-highlight>`;
    result = result.replace(regex, `${openTag}${fragment}${closeTag}`);
  }

  return result;
}

// ─── HTML rendering: inject highlights via DOM walk after render ────────────────

/**
 * Walks the DOM tree of a container and wraps first-occurrence text fragments
 * in <mark> elements with the correct obs-id / severity classes.
 * Returns a cleanup function that removes all injected marks.
 */
function applyHighlightsToDOM(
  container: HTMLDivElement,
  observations: Observation[],
  selectedObsId: string | null,
  onHighlightClick?: (obsId: string) => void,
): () => void {
  // Remove any previously injected marks first
  const existingMarks = container.querySelectorAll('mark[data-obs-id]');
  existingMarks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });

  const toHighlight = observations
    .filter((o) => o.textFragment && o.textFragment.trim().length > 0)
    .sort((a, b) => (b.textFragment?.length ?? 0) - (a.textFragment?.length ?? 0));

  const cleanupFns: Array<() => void> = [];

  for (const obs of toHighlight) {
    const fragment = obs.textFragment!;
    const markEl = injectTextMark(container, fragment, obs.id, obs.severity, selectedObsId, onHighlightClick);
    if (markEl) {
      cleanupFns.push(() => {
        markEl.removeEventListener('click', markEl._obsClickHandler as EventListener);
      });
    }
  }

  return () => cleanupFns.forEach((fn) => fn());
}

// Augment HTMLElement to store the click handler reference for cleanup
declare global {
  interface HTMLElement {
    _obsClickHandler?: (e: Event) => void;
  }
}

/**
 * Searches for the first occurrence of `text` inside the text nodes of `container`,
 * splits the text node, and inserts a <mark> element with the appropriate classes.
 */
function injectTextMark(
  container: Element,
  text: string,
  obsId: string,
  severity: Severity,
  selectedObsId: string | null,
  onHighlightClick?: (obsId: string) => void,
): HTMLElement | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

  let node: Text | null = null;
  while ((node = walker.nextNode() as Text | null)) {
    const idx = node.nodeValue?.indexOf(text) ?? -1;
    if (idx === -1) continue;

    // Skip if already inside an obs mark
    if ((node.parentElement?.closest('mark[data-obs-id]'))) continue;

    const before = node.nodeValue!.slice(0, idx);
    const after = node.nodeValue!.slice(idx + text.length);

    const mark = document.createElement('mark');
    mark.dataset.obsId = obsId;
    mark.textContent = text;

    const severityClass = `document-preview__highlight--${severity.toLowerCase()}`;
    const selectedClass = selectedObsId === obsId ? 'document-preview__highlight--selected' : '';
    mark.className = `document-preview__highlight ${severityClass} ${selectedClass}`.trim();

    const handler = () => onHighlightClick?.(obsId);
    mark._obsClickHandler = handler;
    mark.addEventListener('click', handler);

    const parent = node.parentNode!;
    if (before) parent.insertBefore(document.createTextNode(before), node);
    parent.insertBefore(mark, node);
    if (after) parent.insertBefore(document.createTextNode(after), node);
    parent.removeChild(node);

    return mark;
  }

  return null;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const DocumentPreview = forwardRef<HTMLDivElement, DocumentPreviewProps>(
  (
    { submissionId, markdownContent, observations = [], selectedObsId, onHighlightClick },
    ref,
  ) => {
    const [docxHtml, setDocxHtml] = useState<string | null>(null);
    const [loadingDocx, setLoadingDocx] = useState(false);
    const [docxFailed, setDocxFailed] = useState(false);

    // Internal ref for the HTML container — needed for DOM highlight injection
    const htmlContainerRef = useRef<HTMLDivElement>(null);

    // ── Fetch + convert DOCX ──────────────────────────────────────────────────
    useEffect(() => {
      if (!submissionId) return;

      let cancelled = false;
      setLoadingDocx(true);
      setDocxFailed(false);
      setDocxHtml(null);

      submissionsApi
        .downloadFile(submissionId)
        .then((res) => {
          if (cancelled) return;
          return mammoth.convertToHtml(
            { arrayBuffer: res.data as ArrayBuffer },
            {
              styleMap: [
                "p[style-name='Heading 1'] => h1",
                "p[style-name='Heading 2'] => h2",
                "p[style-name='Heading 3'] => h3",
                "p[style-name='Heading 4'] => h4",
                "p[style-name='Heading 5'] => h5",
                "p[style-name='Heading 6'] => h6",
                "p[style-name='Title'] => h1.document-title",
                "b => strong",
                "i => em",
                "u => u",
              ],
            },
          );
        })
        .then((result) => {
          if (cancelled || !result) return;
          setDocxHtml(result.value);
          setLoadingDocx(false);
        })
        .catch(() => {
          if (cancelled) return;
          setDocxFailed(true);
          setLoadingDocx(false);
        });

      return () => {
        cancelled = true;
      };
    }, [submissionId]);

    // ── Apply DOM highlights after HTML renders ───────────────────────────────
    const applyHighlights = useCallback(() => {
      const container = htmlContainerRef.current;
      if (!container || !docxHtml) return;
      // Apply with null selectedObsId — selection is handled separately below
      applyHighlightsToDOM(container, observations, null, onHighlightClick);
    }, [docxHtml, observations, onHighlightClick]);

    useEffect(() => {
      applyHighlights();
    }, [applyHighlights]);

    // ── Update selected class without full re-injection ───────────────────────
    useEffect(() => {
      const container = htmlContainerRef.current;
      if (!container || !docxHtml) return;

      container.querySelectorAll('mark[data-obs-id]').forEach((mark) => {
        const el = mark as HTMLElement;
        const isSelected = el.dataset.obsId === selectedObsId;
        el.classList.toggle('document-preview__highlight--selected', isSelected);
      });
    }, [selectedObsId, docxHtml]);

    // ── Markdown fallback: inject highlights into markdown string ─────────────
    const processedMarkdown = useMemo(() => {
      if (!markdownContent) return null;
      return injectHighlightsIntoMarkdown(markdownContent, observations);
    }, [markdownContent, observations]);

    // ── Render ────────────────────────────────────────────────────────────────

    // Loading skeleton while fetching DOCX
    if (loadingDocx) {
      return (
        <div ref={ref} className="document-preview document-preview--loading">
          <Skeleton active paragraph={{ rows: 18 }} />
        </div>
      );
    }

    // DOCX rendered successfully
    if (docxHtml && !docxFailed) {
      return (
        <div ref={ref} className="document-preview">
          <div
            ref={htmlContainerRef}
            className="docx-body"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: docxHtml }}
          />
        </div>
      );
    }

    // Markdown fallback (DOCX failed or no submissionId)
    if (processedMarkdown) {
      return (
        <div ref={ref} className="document-preview">
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                // @ts-expect-error — custom element not in react-markdown's Components type
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
                  const selectedClass = isSelected
                    ? 'document-preview__highlight--selected'
                    : '';

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
              {processedMarkdown}
            </ReactMarkdown>
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} className="document-preview">
        <Empty description="No se pudo cargar el contenido del documento" />
      </div>
    );
  },
);

DocumentPreview.displayName = 'DocumentPreview';

export default DocumentPreview;
