import { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Upload,
  Button,
  Table,
  Tag,
  Card,
  message,
  Popconfirm,
  Empty,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  FileOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../../services/api';
import { ApiError } from '../../services/api-error';
import type { KnowledgeDoc } from '../../types';
import { formatDate } from '../../utils/format';
import './KnowledgeBase.css';

const { Title, Text } = Typography;

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchDocs = useCallback(() => {
    setLoading(true);
    api
      .get<KnowledgeDoc[]>('/knowledge')
      .then((res) => setDocs(res.data))
      .catch((err: ApiError) => {
        console.error(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  useEffect(() => { document.title = 'Base de Conocimiento — Thena'; }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/knowledge/upload?layer=TUTOR', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 min — embedding can be slow
      });
      message.success('Documento procesado e indexado correctamente');
      fetchDocs();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al procesar el documento');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (sourceDocument: string) => {
    try {
      await api.delete(`/knowledge/${encodeURIComponent(sourceDocument)}`);
      message.success('Documento eliminado');
      fetchDocs();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al eliminar el documento');
    }
  };

  const columns: ColumnsType<KnowledgeDoc> = [
    {
      title: 'Documento',
      dataIndex: 'sourceDocument',
      key: 'doc',
      render: (name: string) => (
        <span>
          <FileOutlined className="knowledge-base__file-icon" />
          {name}
        </span>
      ),
    },
    {
      title: 'Capa',
      dataIndex: 'layer',
      key: 'layer',
      render: (layer: string) => (
        <Tag color={layer === 'TUTOR' ? 'green' : 'blue'}>
          {layer === 'TUTOR' ? 'Tutor' : 'Institucional'}
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
      render: (d: string) => d ? formatDate(d) : '-',
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="¿Eliminar este documento?"
          description="Se eliminarán todos los fragmentos indexados."
          onConfirm={() => handleDelete(record.sourceDocument)}
          okText="Eliminar"
          cancelText="Cancelar"
        >
          <Button danger icon={<DeleteOutlined />} size="small">
            Eliminar
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Title level={3} className="font-academic">Base de Conocimiento</Title>

      <Card className="knowledge-base__upload-card">
        <Title level={5}>Subir Criterios de Evaluación</Title>
        <Text type="secondary" className="knowledge-base__upload-hint">
          Sube documentos PDF o DOCX con tus criterios de evaluación. El sistema
          los procesará y usará como referencia al revisar los capítulos.
        </Text>
        <Upload
          accept=".pdf,.docx"
          showUploadList={false}
          beforeUpload={(file) => {
            handleUpload(file);
            return false;
          }}
        >
          <Button icon={<UploadOutlined />} loading={uploading} type="primary">
            Subir Documento
          </Button>
        </Upload>
      </Card>

      <Card title="Documentos Indexados">
        <Table
          dataSource={docs}
          columns={columns}
          rowKey="sourceDocument"
          loading={loading}
          pagination={false}
          locale={{ emptyText: <Empty description="No hay documentos indexados" /> }}
        />
      </Card>
    </div>
  );
}
