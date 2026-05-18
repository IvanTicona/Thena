import { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Upload,
  Button,
  Card,
  Table,
  Tag,
  Spin,
  message,
  Alert,
  Modal,
} from 'antd';
import {
  FileWordOutlined,
  EyeOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useParams, useNavigate } from 'react-router-dom';
import {
  chaptersApi,
  submissionsApi,
  type ChapterDetailData,
  type ChapterDetectionResponse,
} from '../../services/api';
import { ApiError } from '../../services/api-error';
import type { Submission } from '../../types';
import { CHAPTER_STATUS, JOB_STATUS } from '../../utils/status';
import { formatDateTime } from '../../utils/format';
import './ChapterDetail.css';

const { Title } = Typography;
const { Dragger } = Upload;

export default function ChapterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState<ChapterDetailData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ChapterDetectionResponse | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [requestingReview, setRequestingReview] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await chaptersApi.getById(id!);
      setChapter(res.data);
      setSubmissions(res.data.submissions || []);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al cargar el capítulo';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    document.title = chapter ? `${chapter.title} — Thena` : 'Cargando... — Thena';
  }, [chapter]);

  const handleUpload = async (file: File) => {
    if (!id) return;
    setAnalyzing(true);
    try {
      const res = await submissionsApi.analyzeDocument(id, file);
      setAnalysisResult(res.data);
      setConfirmModalVisible(true);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al analizar el documento');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    if (!id || !analysisResult) return;
    setConfirming(true);
    try {
      const res = await submissionsApi.confirmFromFullDocument(id, analysisResult.tempFileKey);
      setConfirmModalVisible(false);
      setAnalysisResult(null);
      message.success('Entrega realizada correctamente');
      const jobId = res.data.reviewJob?.id;
      if (jobId) {
        navigate(`/chapters/${id}/review/${jobId}`);
      } else {
        fetchData();
      }
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al confirmar la entrega');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelConfirm = () => {
    setConfirmModalVisible(false);
    setAnalysisResult(null);
  };

  const handleRequestTutorReview = async () => {
    if (!id) return;
    setRequestingReview(true);
    try {
      await chaptersApi.requestTutorReview(id);
      message.success('Revisión del tutor solicitada correctamente');
      fetchData();
    } catch (err) {
      message.error(
        err instanceof ApiError
          ? err.message
          : 'Error al solicitar revisión del tutor',
      );
    } finally {
      setRequestingReview(false);
    }
  };

  const handleDownload = async (submission: Submission) => {
    setDownloadingId(submission.id);
    try {
      const res = await submissionsApi.downloadFile(submission.id);
      const blob = new Blob([res.data as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = submission.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      void message.error('No se pudo descargar el archivo. Intentá de nuevo.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return <Spin size="large" className="u-spinner-centered" />;
  }

  if (error) {
    return (
      <Alert
        type="error"
        title="Error al cargar el capítulo"
        description={error}
        showIcon
        className="chapter-detail__error-alert"
        action={
          <Button size="small" onClick={fetchData}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (!chapter) return <Alert type="error" title="Capítulo no encontrado" />;

  // Derived state for the new chapter flow
  const hasActiveAiReview = submissions.some(
    (s) =>
      s.reviewJob?.status === 'QUEUED' || s.reviewJob?.status === 'PROCESSING',
  );
  const hasCompletedReview = submissions.some(
    (s) => s.reviewJob?.status === 'COMPLETED',
  );

  // Student can upload when: DRAFT + no active AI review running
  const canUpload = chapter.status === 'DRAFT' && !hasActiveAiReview;

  // "Solicitar Revisión del Tutor" visible when: DRAFT + has completed review + no active AI review
  const canRequestTutorReview =
    chapter.status === 'DRAFT' && hasCompletedReview && !hasActiveAiReview;

  const statusCfg = CHAPTER_STATUS[chapter.status];

  /* ── Table columns ─────────────────────────────────────── */
  const columns: ColumnsType<Submission> = [
    {
      title: 'Versión',
      dataIndex: 'versionNumber',
      key: 'version',
      render: (v: number) => `v${v}`,
      width: 80,
    },
    {
      title: 'Archivo',
      dataIndex: 'fileName',
      key: 'file',
      render: (name: string) => (
        <span>
          <FileWordOutlined className="chapter-detail__file-icon" />
          {name}
        </span>
      ),
    },
    {
      title: 'Fecha',
      dataIndex: 'submittedAt',
      key: 'date',
      render: (d: string) => formatDateTime(d),
      width: 200,
    },
    {
      title: 'Estado',
      key: 'status',
      width: 140,
      render: (_, record) => {
        const status = record.reviewJob?.status ?? 'QUEUED';
        const cfg = JOB_STATUS[status];
        return <Tag color={cfg.tagColor}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 200,
      render: (_, record) => {
        const job = record.reviewJob;
        return (
          <div className="chapter-detail__actions-cell">
            {job && (job.status === 'COMPLETED' || job.status === 'QUEUED' || job.status === 'PROCESSING') && (
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/chapters/${id}/review/${job.id}`)}
              >
                {job.status === 'COMPLETED' ? 'Ver revisión' : 'Ver progreso'}
              </Button>
            )}
            <Button
              type="link"
              icon={<DownloadOutlined />}
              loading={downloadingId === record.id}
              onClick={() => handleDownload(record)}
            >
              Descargar
            </Button>
          </div>
        );
      },
    },
  ];

  /* ── Page content (upload + submissions table) ──────────── */
  const pageContent = (
    <div className="chapter-detail__content">
      {/* Request tutor review — action banner */}
      {canRequestTutorReview && (
        <div className="chapter-detail__review-banner">
          <div className="chapter-detail__review-banner-content">
            <CheckCircleOutlined className="chapter-detail__review-banner-icon" />
            <div className="chapter-detail__review-banner-text">
              <strong>Revisión de Thena disponible</strong>
              <span>
                Ya podés enviar este capítulo a tu tutor para su aprobación, o
                subir una nueva versión si querés hacer correcciones.
              </span>
            </div>
          </div>
          <Button
            type="primary"
            loading={requestingReview}
            onClick={handleRequestTutorReview}
            className="chapter-detail__review-banner-btn"
          >
            Solicitar Revisión del Tutor
          </Button>
        </div>
      )}

      {/* Status alerts */}
      {hasActiveAiReview && chapter.status === 'DRAFT' && (
        <Alert
          type="info"
          title="Thena está revisando tu capítulo"
          description="Thena está analizando tu documento. Esperá a que termine antes de subir una nueva versión."
          showIcon
          className="chapter-detail__status-alert"
        />
      )}
      {chapter.status === 'IN_REVIEW' && (
        <Alert
          type="info"
          title="Esperando revisión del tutor"
          description="Este capítulo fue enviado a tu tutor para revisión. No podés subir nuevas versiones hasta que el tutor lo apruebe o rechace."
          showIcon
          className="chapter-detail__status-alert"
        />
      )}
      {chapter.status === 'LOCKED' && (
        <Alert
          type="warning"
          title="Este capítulo está bloqueado"
          description="Debés completar y aprobar el capítulo anterior antes de poder subir este capítulo."
          showIcon
          className="chapter-detail__status-alert"
        />
      )}
      {chapter.status === 'APPROVED' && (
        <Alert
          type="success"
          title="Capítulo aprobado"
          description="Este capítulo ha sido aprobado por tu tutor."
          showIcon
          className="chapter-detail__status-alert"
        />
      )}

      {/* Upload dragger */}
      {canUpload && (
        <Card className="chapter-detail__upload-card">
          <Dragger
            accept=".docx"
            showUploadList={false}
            disabled={analyzing}
            beforeUpload={(file) => {
              handleUpload(file);
              return false;
            }}
            className="chapter-detail__dragger"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#06175d', fontSize: 48 }} />
            </p>
            <p className="chapter-detail__dragger-heading">
              Subí tu tesis completa en .docx
            </p>
            <p className="chapter-detail__dragger-sub">
              Arrastrá y soltá aquí o hacé clic para seleccionar
            </p>
            <Button
              type="primary"
              loading={analyzing}
              className="chapter-detail__dragger-btn"
              style={{ background: '#06175d', borderColor: '#06175d' }}
            >
              Seleccionar archivo
            </Button>
            <p className="chapter-detail__dragger-hint">
              Solo archivos .docx · Máx. 20MB · Thena extrae el capítulo automáticamente
            </p>
          </Dragger>
        </Card>
      )}

      {/* Chapter detection confirmation modal */}
      {analysisResult && (
        <Modal
          open={confirmModalVisible}
          title="Confirmar entrega"
          onCancel={handleCancelConfirm}
          footer={
            analysisResult.found
              ? [
                  <Button key="cancel" onClick={handleCancelConfirm}>
                    Cancelar
                  </Button>,
                  <Button
                    key="confirm"
                    type="primary"
                    loading={confirming}
                    onClick={handleConfirm}
                    style={{ background: '#06175d', borderColor: '#06175d' }}
                  >
                    Confirmar entrega
                  </Button>,
                ]
              : [
                  <Button key="close" onClick={handleCancelConfirm}>
                    Cerrar
                  </Button>,
                ]
          }
        >
          {analysisResult.found ? (
            <div className="chapter-detail__confirm-modal-body">
              <p>
                Encontramos el{' '}
                <strong>
                  Capítulo {analysisResult.chapterNumber}: {analysisResult.chapterTitle}
                </strong>{' '}
                en tu documento.
              </p>
              {analysisResult.headingTitle && (
                <p>
                  Título detectado: <em>{analysisResult.headingTitle}</em>
                </p>
              )}
              {analysisResult.preview && (
                <div className="chapter-detail__confirm-preview">
                  <p>
                    <strong>Vista previa del contenido:</strong>
                  </p>
                  <blockquote className="chapter-detail__confirm-blockquote">
                    {analysisResult.preview}…
                  </blockquote>
                </div>
              )}
              <p>¿Confirmás que este es el capítulo que querés entregar?</p>
            </div>
          ) : (
            <Alert
              type="error"
              message="Capítulo no encontrado"
              description={`No encontramos el Capítulo ${analysisResult.chapterNumber} en tu documento. Asegurate de que los capítulos estén marcados con estilo "Título 1" (Heading 1) en Word.`}
              showIcon
            />
          )}
        </Modal>
      )}

      {/* Submissions history table */}
      <Card title="Historial de Entregas" className="chapter-detail__history-card">
        <Table
          dataSource={submissions}
          columns={columns}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: 'No hay entregas para este capítulo' }}
          scroll={{ x: 600 }}
        />
      </Card>
    </div>
  );

  return (
    <div className="chapter-detail">
      {/* Chapter header */}
      <div className="chapter-detail__header">
        <div className="chapter-detail__header-text">
          <span className="u-eyebrow-label">CAPÍTULO {chapter.number}</span>
          <Title level={3} className="chapter-detail__chapter-title">
            {chapter.title}
          </Title>
        </div>
        <div className="chapter-detail__header-actions">
          <Tag
            color={statusCfg.tagColor}
            className="chapter-detail__status-tag"
          >
            {statusCfg.label}
          </Tag>
          {submissions.length > 0 && (
            <Button
              type="text"
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => navigate(`/chapters/${id}/history`)}
              className="chapter-detail__history-btn"
            >
              Historial
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {pageContent}
    </div>
  );
}
