import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Tag,
  Typography,
  Space,
  Spin,
  Empty,
  App,
} from 'antd';
import { WarningOutlined, CheckOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { alertsApi, type Alert } from '../../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';

dayjs.extend(relativeTime);
dayjs.locale('es');

const { Title, Text } = Typography;

export default function AlertsPage() {
  const { message } = App.useApp();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await alertsApi.getActive();
      setAlerts(res.data);
    } catch {
      message.error('No se pudieron cargar las alertas');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    document.title = 'Alertas — Thena';
    fetchAlerts();
  }, [fetchAlerts]);

  const handleResolve = async (id: string) => {
    setResolving(id);
    try {
      await alertsApi.resolve(id);
      message.success('Alerta resuelta');
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      message.error('No se pudo resolver la alerta');
    } finally {
      setResolving(null);
    }
  };

  const columns: ColumnsType<Alert> = [
    {
      title: 'Estudiante',
      key: 'student',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.thesis.student.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.thesis.student.email}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Tesis',
      dataIndex: ['thesis', 'title'],
      key: 'thesis',
      ellipsis: true,
    },
    {
      title: 'Tipo',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'INACTIVITY' ? 'orange' : 'red'} icon={<WarningOutlined />}>
          {type === 'INACTIVITY' ? 'Inactividad' : type}
        </Tag>
      ),
      width: 140,
    },
    {
      title: 'Generada',
      dataIndex: 'triggeredAt',
      key: 'triggeredAt',
      render: (date: string) => (
        <Text type="secondary" title={dayjs(date).format('DD/MM/YYYY HH:mm')}>
          {dayjs(date).fromNow()}
        </Text>
      ),
      width: 150,
      sorter: (a, b) =>
        new Date(a.triggeredAt).getTime() - new Date(b.triggeredAt).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<CheckOutlined />}
          loading={resolving === record.id}
          onClick={() => handleResolve(record.id)}
        >
          Resolver
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 8px' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>Alertas activas</Title>
        <Text type="secondary">
          Alertas de inactividad y escalamiento que requieren atención.
        </Text>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : alerts.length === 0 ? (
        <Empty description="No hay alertas activas" />
      ) : (
        <Table<Alert>
          columns={columns}
          dataSource={alerts}
          rowKey="id"
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          scroll={{ x: 600 }}
        />
      )}
    </div>
  );
}
