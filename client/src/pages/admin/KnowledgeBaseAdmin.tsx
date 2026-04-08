import { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Table,
  Button,
  Popconfirm,
  message,
  Tag,
  Card,
  Upload,
  Empty,
} from 'antd';
import {
  DeleteOutlined,
  FileOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminKnowledgeApi, knowledgeApi, type AdminKnowledgeChunk } from '../../services/api';
import type { KnowledgeDoc } from '../../types';
import { formatDate } from '../../utils/format';
import './KnowledgeBaseAdmin.css';

const { Title, Text } = Typography;

type LayerType = 'INSTITUTIONAL' | 'TUTOR' | 'BIBLIOGRAPHY';

const LAYER_LABELS: Record<LayerType, string> = {
  INSTITUTIONAL: 'Institucional',
  TUTOR: 'Tutor',
  BIBLIOGRAPHY: 'Bibliografía',
};

const LAYER_COLORS: Record<LayerType, string> = {
  INSTITUTIONAL: 'blue',
  TUTOR: 'green',
  BIBLIOGRAPHY: 'purple',
};

export default function KnowledgeBaseAdmin() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [chunks, setChunks] = useState<AdminKnowledgeChunk[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    document.title = 'Base de Conocimiento (Admin) — Thena';
  }, []);

  const fetchDocs = useCallback(() => {
    setLoadingDocs(true);
    knowledgeApi
      .list()
      .then((res) => setDocs(res.data))
      .catch(() => message.error('Error al cargar los documentos'))
      .finally(() => setLoadingDocs(false));
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const fetchChunks = useCallback(() => {
    adminKnowledgeApi
      .listAll()
      .then((res) => setChunks(res.data))
      .catch(() => {
        // El endpoint puede no existir aún — degradación silenciosa
        setChunks([]);
      });
  }, []);

  useEffect(() => {
    fetchChunks();
  }, [fetchChunks]);

  const handleUploadBibliography = async (file: File) => {
    setUploading(true);
    try {
      await adminKnowledgeApi.uploadBibliography(file);
      message.success('Documento bibliográfico procesado e indexado correctamente');
      fetchDocs();
      fetchChunks();
    } catch {
      message.error('Error al procesar el documento');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (sourceDocument: string) => {
    try {
      await knowledgeApi.delete(sourceDocument);
      message.success('Documento eliminado correctamente');
      fetchDocs();
      fetchChunks();
    } catch {
      message.error('Error al eliminar el documento');
    }
  };

  const handleDeleteChunk = async (id: string) => {
    try {
      await adminKnowledgeApi.deleteChunk(id);
      message.success('Fragmento eliminado correctamente');
      fetchChunks();
    } catch {
      message.error('Error al eliminar el fragmento');
    }
  };

  const docColumns: ColumnsType<KnowledgeDoc> = [
    {
      title: 'Documento',
      dataIndex: 'sourceDocument',
      key: 'doc',
      render: (name: string) => (
        <span>
          <FileOutlined className="knowledge-base-admin__file-icon" />
          {name}
        </span>
      ),
    },
    {
      title: 'Capa',
      dataIndex: 'layer',
      key: 'layer',
      render: (layer: LayerType) => (
        <Tag color={LAYER_COLORS[layer] ?? 'default'}>
          {LAYER_LABELS[layer] ?? layer}
        </Tag>
      ),
    },
    {
      title: 'Fragmentos',
      dataIndex: 'chunkCount',
      key: 'chunks',
    },
    {
      title: 'Actualizado',
      dataIndex: 'lastUpdated',
      key: 'updated',
      render: (d: string) => (d ? formatDate(d) : '—'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="¿Eliminar este documento?"
          description="Se eliminarán todos los fragmentos indexados de este documento."
          onConfirm={() => handleDeleteDoc(record.sourceDocument)}
          okText="Eliminar"
          cancelText="Cancelar"
          okButtonProps={{ danger: true }}
        >
          <Button danger icon={<DeleteOutlined />} size="small">
            Eliminar
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const chunkColumns: ColumnsType<AdminKnowledgeChunk> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: string) => (
        <Text type="secondary" className="knowledge-base-admin__chunk-id">
          {id.slice(0, 8)}…
        </Text>
      ),
    },
    {
      title: 'Documento',
      dataIndex: 'sourceDocument',
      key: 'sourceDocument',
      ellipsis: true,
    },
    {
      title: 'Capa',
      dataIndex: 'layer',
      key: 'layer',
      render: (layer: LayerType) => (
        <Tag color={LAYER_COLORS[layer] ?? 'default'}>
          {LAYER_LABELS[layer] ?? layer}
        </Tag>
      ),
    },
    {
      title: 'Contenido',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content: string) => (
        <Text type="secondary" className="knowledge-base-admin__chunk-content">
          {content}
        </Text>
      ),
    },
    {
      title: 'Creado',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => (d ? formatDate(d) : '—'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="¿Eliminar este fragmento?"
          description="Esta acción no se puede deshacer."
          onConfirm={() => handleDeleteChunk(record.id)}
          okText="Eliminar"
          cancelText="Cancelar"
          okButtonProps={{ danger: true }}
        >
          <Button danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="knowledge-base-admin">
      <Title level={3}>Base de Conocimiento — Administración</Title>

      {/* Upload bibliography */}
      <Card className="knowledge-base-admin__upload-card">
        <Title level={5}>Subir Documento Bibliográfico</Title>
        <Text type="secondary" className="knowledge-base-admin__upload-hint">
          Subí documentos PDF o DOCX con bibliografía de referencia institucional. Se
          indexarán en la capa de bibliografía y estarán disponibles para todas las revisiones.
        </Text>
        <Upload
          accept=".pdf,.docx"
          showUploadList={false}
          beforeUpload={(file) => {
            handleUploadBibliography(file);
            return false;
          }}
        >
          <Button icon={<UploadOutlined />} loading={uploading} type="primary">
            Subir Bibliografía
          </Button>
        </Upload>
      </Card>

      {/* All documents (grouped view) */}
      <Card
        title="Documentos Indexados"
        className="knowledge-base-admin__docs-card"
      >
        <Table<KnowledgeDoc>
          dataSource={docs}
          columns={docColumns}
          rowKey="sourceDocument"
          loading={loadingDocs}
          pagination={false}
          locale={{
            emptyText: <Empty description="No hay documentos indexados" />,
          }}
        />
      </Card>

      {/* Individual chunks view — only shown if chunks endpoint responds */}
      {chunks.length > 0 && (
        <Card
          title="Fragmentos Individuales"
          className="knowledge-base-admin__chunks-card"
        >
          <Table<AdminKnowledgeChunk>
            dataSource={chunks}
            columns={chunkColumns}
            rowKey="id"
            pagination={{ pageSize: 20, showSizeChanger: false }}
            scroll={{ x: true }}
          />
        </Card>
      )}
    </div>
  );
}
