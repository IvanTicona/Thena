import { forwardRef } from 'react';
import { Empty } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DocumentPreviewProps {
  markdownContent: string | null;
}

const DocumentPreview = forwardRef<HTMLDivElement, DocumentPreviewProps>(
  ({ markdownContent }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#fff',
          padding: 24,
          borderRadius: 8,
          border: '1px solid #f0f0f0',
        }}
      >
        {markdownContent ? (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdownContent}
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
