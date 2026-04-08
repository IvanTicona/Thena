import { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Table,
  Button,
  Select,
  Space,
  Tag,
  DatePicker,
  message,
} from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import {
  auditApi,
  type AuditLogEntry,
  type AuditActionType,
  type GetAuditLogsParams,
} from '../../services/api';
import { formatDateTime } from '../../utils/format';
import './AuditLogViewer.css';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const ACTION_LABELS: Record<AuditActionType, string> = {
  SUBMIT_CHAPTER: 'Envío de Capítulo',
  GENERATE_REVIEW: 'Generar Revisión',
  APPROVE_CHAPTER: 'Aprobar Capítulo',
  REJECT_CHAPTER: 'Rechazar Capítulo',
  CREATE_USER: 'Crear Usuario',
  ASSIGN_TUTOR: 'Asignar Tutor',
  ADD_OBSERVATION: 'Agregar Observación',
  DELETE_OBSERVATION: 'Eliminar Observación',
  UPLOAD_KNOWLEDGE: 'Subir Conocimiento',
  DELETE_KNOWLEDGE: 'Eliminar Conocimiento',
  LOGIN: 'Inicio de Sesión',
};

const ACTION_COLORS: Record<AuditActionType, string> = {
  SUBMIT_CHAPTER: 'blue',
  GENERATE_REVIEW: 'purple',
  APPROVE_CHAPTER: 'green',
  REJECT_CHAPTER: 'red',
  CREATE_USER: 'cyan',
  ASSIGN_TUTOR: 'geekblue',
  ADD_OBSERVATION: 'orange',
  DELETE_OBSERVATION: 'volcano',
  UPLOAD_KNOWLEDGE: 'teal',
  DELETE_KNOWLEDGE: 'magenta',
  LOGIN: 'default',
};

const PAGE_SIZE = 20;

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [actionFilter, setActionFilter] = useState<AuditActionType | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const buildParams = useCallback(
    (p = page): GetAuditLogsParams => ({
      page: p,
      limit: PAGE_SIZE,
      action: actionFilter,
      dateFrom: dateRange?.[0]?.startOf('day').toISOString(),
      dateTo: dateRange?.[1]?.endOf('day').toISOString(),
    }),
    [page, actionFilter, dateRange],
  );

  const fetchLogs = useCallback(
    (p = page) => {
      setLoading(true);
      auditApi
        .getLogs(buildParams(p))
        .then((res) => {
          setLogs(res.data.data);
          setTotal(res.data.total);
        })
        .catch(() => message.error('Error al cargar el registro de auditoría'))
        .finally(() => setLoading(false));
    },
    [buildParams, page],
  );

  useEffect(() => {
    document.title = 'Auditoría — Thena';
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleActionFilterChange = (value: AuditActionType | undefined) => {
    setActionFilter(value);
    setPage(1);
  };

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setDateRange(dates);
    setPage(1);
  };

  const handleSearch = () => {
    setPage(1);
    fetchLogs(1);
  };

  const handleClearFilters = () => {
    setActionFilter(undefined);
    setDateRange(null);
    setPage(1);
    setTimeout(() => fetchLogs(1), 0);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await auditApi.exportCsv({
        action: actionFilter,
        dateFrom: dateRange?.[0]?.startOf('day').toISOString(),
        dateTo: dateRange?.[1]?.endOf('day').toISOString(),
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      message.error('Error al exportar el registro de auditoría');
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnsType<AuditLogEntry> = [
    {
      title: 'Acción',
      dataIndex: 'action',
      key: 'action',
      render: (action: AuditActionType) => (
        <Tag color={ACTION_COLORS[action]}>
          {ACTION_LABELS[action] ?? action}
        </Tag>
      ),
    },
    {
      title: 'Usuario',
      key: 'actor',
      render: (_, record) => (
        <div className="audit-log__actor">
          <Text strong className="audit-log__actor-name">
            {record.actor?.name ?? record.actorId}
          </Text>
          <Text type="secondary" className="audit-log__actor-email">
            {record.actor?.email ?? ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Entidad',
      key: 'entity',
      render: (_, record) => (
        <div className="audit-log__entity">
          <Text code className="audit-log__entity-type">
            {record.entityType}
          </Text>
          <Text type="secondary" className="audit-log__entity-id">
            {record.entityId.slice(0, 8)}…
          </Text>
        </div>
      ),
    },
    {
      title: 'Rol',
      key: 'role',
      render: (_, record) => (
        <Tag>{record.actor?.role ?? '—'}</Tag>
      ),
    },
    {
      title: 'Fecha y Hora',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => formatDateTime(d),
      sorter: false,
    },
  ];

  return (
    <div className="audit-log-viewer">
      <div className="audit-log-viewer__header">
        <div>
          <Title level={3}>Registro de Auditoría</Title>
          <Text type="secondary">
            Historial completo de acciones del sistema. Solo visible para Super Administradores.
          </Text>
        </div>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={exporting}
          onClick={handleExport}
        >
          Exportar CSV
        </Button>
      </div>

      <div className="audit-log-viewer__filters">
        <Space wrap>
          <Select<AuditActionType | undefined>
            allowClear
            placeholder="Filtrar por acción"
            style={{ width: 240 }}
            value={actionFilter}
            onChange={handleActionFilterChange}
          >
            {(Object.keys(ACTION_LABELS) as AuditActionType[]).map((action) => (
              <Option key={action} value={action}>
                {ACTION_LABELS[action]}
              </Option>
            ))}
          </Select>

          <RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            placeholder={['Fecha desde', 'Fecha hasta']}
            format="DD/MM/YYYY"
          />

          <Button type="primary" onClick={handleSearch}>
            Buscar
          </Button>
          <Button onClick={handleClearFilters}>Limpiar</Button>
        </Space>
      </div>

      <Table<AuditLogEntry>
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          onChange: (p) => {
            setPage(p);
            fetchLogs(p);
          },
          showTotal: (t) => `${t} registros en total`,
          showSizeChanger: false,
        }}
        className="audit-log-viewer__table"
        scroll={{ x: 800 }}
      />
    </div>
  );
}
