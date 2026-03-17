import { Layout, Menu, Select, Tag, Typography, Alert } from 'antd';
import {
  BookOutlined,
  DashboardOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../context/UserContext';

const { Header, Sider, Content, Footer } = Layout;
const { Title } = Typography;

export function AppLayout() {
  const { currentUser, users, switchUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const isStudent = currentUser.role === 'STUDENT';

  const menuItems = isStudent
    ? [
        {
          key: '/chapters',
          icon: <BookOutlined />,
          label: 'Mis Capitulos',
        },
      ]
    : [
        {
          key: '/tutor',
          icon: <DashboardOutlined />,
          label: 'Panel de Tutor',
        },
        {
          key: '/tutor/knowledge',
          icon: <DatabaseOutlined />,
          label: 'Base de Conocimiento',
        },
      ];

  const selectedKey =
    menuItems.find((item) => location.pathname.startsWith(item.key))?.key ||
    menuItems[0]?.key;

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
        <Title
          level={4}
          style={{ margin: 0, cursor: 'pointer' }}
          onClick={() => navigate(isStudent ? '/chapters' : '/tutor')}
        >
          THENA
        </Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Tag color={isStudent ? 'blue' : 'green'}>
            {isStudent ? 'Estudiante' : 'Tutor'}
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
        <Sider width={220} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: 0, paddingTop: 8 }}
          />
        </Sider>

        <Content style={{ padding: 24, minHeight: 360, background: '#f5f5f5' }}>
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
