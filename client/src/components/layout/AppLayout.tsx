import { Layout, Select, Tag, Typography, Alert } from 'antd';
import { Outlet } from 'react-router-dom';
import { useUser } from '../../context/UserContext';

const { Header, Sider, Content, Footer } = Layout;
const { Title } = Typography;

export function AppLayout() {
  const { currentUser, users, switchUser } = useUser();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 24px',
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          THENA
        </Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Tag color={currentUser.role === 'STUDENT' ? 'blue' : 'green'}>
            {currentUser.role === 'STUDENT' ? 'Estudiante' : 'Tutor'}
          </Tag>
          <Select
            value={currentUser.id}
            onChange={switchUser}
            style={{ width: 200 }}
            options={users.map((u) => ({
              value: u.id,
              label: `${u.name} (${u.role === 'STUDENT' ? 'Estudiante' : 'Tutor'})`,
            }))}
          />
        </div>
      </Header>

      <Layout>
        <Sider width={240} style={{ background: '#fff' }}>
          <div style={{ padding: 16, color: '#999', fontSize: 12 }}>
            Navegacion (pendiente)
          </div>
        </Sider>

        <Content style={{ padding: 24, minHeight: 360 }}>
          <Outlet />
        </Content>
      </Layout>

      <Footer style={{ textAlign: 'center', padding: '8px 24px' }}>
        <Alert
          message="Toda retroalimentacion generada es orientacion preliminar, no una correccion definitiva ni una calificacion."
          type="info"
          showIcon
          banner
        />
      </Footer>
    </Layout>
  );
}
