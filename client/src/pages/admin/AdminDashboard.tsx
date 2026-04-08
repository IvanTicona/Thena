import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography, Button, Spin } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  LinkOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminUsersApi, adminAssignmentsApi } from '../../services/api';
import './AdminDashboard.css';

const { Title, Text } = Typography;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAssignments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Panel Admin — Thena';

    Promise.all([
      adminUsersApi.list({ limit: 1 }),
      adminAssignmentsApi.list({ limit: 1 }),
    ])
      .then(([usersRes, assignmentsRes]) => {
        setStats({
          totalUsers: usersRes.data.meta.total,
          totalAssignments: assignmentsRes.data.meta.total,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="admin-dashboard__loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard__header">
        <Title level={3}>Panel de Administración</Title>
        <Text type="secondary">
          Resumen general del sistema Thena.
        </Text>
      </div>

      <Row gutter={[16, 16]} className="admin-dashboard__stats">
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Total de Usuarios"
              value={stats.totalUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#06175d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Total de Asignaciones"
              value={stats.totalAssignments}
              prefix={<LinkOutlined />}
              valueStyle={{ color: '#06175d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Tesis Registradas"
              value="—"
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
      </Row>

      <Title level={5} className="admin-dashboard__section-title">
        Accesos rápidos
      </Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="admin-dashboard__quick-card"
            onClick={() => navigate('/admin/users')}
            hoverable
          >
            <UserOutlined className="admin-dashboard__quick-icon" />
            <Text strong>Gestión de Usuarios</Text>
            <Text type="secondary" className="admin-dashboard__quick-desc">
              Crear, editar y eliminar usuarios del sistema.
            </Text>
            <Button type="link" className="admin-dashboard__quick-btn">
              Ir a Usuarios →
            </Button>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="admin-dashboard__quick-card"
            onClick={() => navigate('/admin/assignments')}
            hoverable
          >
            <LinkOutlined className="admin-dashboard__quick-icon" />
            <Text strong>Asignaciones</Text>
            <Text type="secondary" className="admin-dashboard__quick-desc">
              Gestionar asignaciones de tutores y revisores.
            </Text>
            <Button type="link" className="admin-dashboard__quick-btn">
              Ir a Asignaciones →
            </Button>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="admin-dashboard__quick-card"
            onClick={() => navigate('/admin/knowledge')}
            hoverable
          >
            <BookOutlined className="admin-dashboard__quick-icon" />
            <Text strong>Base de Conocimiento</Text>
            <Text type="secondary" className="admin-dashboard__quick-desc">
              Administrar documentos y fragmentos indexados.
            </Text>
            <Button type="link" className="admin-dashboard__quick-btn">
              Ir a Base de Conocimiento →
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
