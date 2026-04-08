import { Card, Col, Row, Typography, Button } from 'antd';
import { AuditOutlined, DashboardOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './SuperAdminDashboard.css';

const { Title, Text } = Typography;

export default function SuperAdminDashboard() {
  const navigate = useNavigate();

  return (
    <div className="superadmin-dashboard">
      <div className="superadmin-dashboard__header">
        <DashboardOutlined className="superadmin-dashboard__header-icon" />
        <div>
          <Title level={3}>Panel de Super Administrador</Title>
          <Text type="secondary">
            Herramientas de auditoría y supervisión del sistema Thena.
          </Text>
        </div>
      </div>

      <Row gutter={[16, 16]} className="superadmin-dashboard__cards">
        <Col xs={24} sm={12} lg={8}>
          <Card
            className="superadmin-dashboard__quick-card"
            onClick={() => navigate('/superadmin/audit')}
            hoverable
          >
            <AuditOutlined className="superadmin-dashboard__quick-icon" />
            <Text strong>Registro de Auditoría</Text>
            <Text type="secondary" className="superadmin-dashboard__quick-desc">
              Ver y filtrar todos los eventos del sistema. Exportar a CSV.
            </Text>
            <Button type="link" className="superadmin-dashboard__quick-btn">
              Ver Auditoría →
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
