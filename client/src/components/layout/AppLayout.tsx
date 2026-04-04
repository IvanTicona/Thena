import { useEffect, useState } from 'react';
import {
  Layout,
  Menu,
  Tag,
  Typography,
  Alert,
  Button,
  Space,
  Dropdown,
} from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import api from '../../services/api';
import { ChapterTimeline } from './ChapterTimeline';
import type { Chapter } from '../../types';
import './AppLayout.css';

const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isStudent = user?.role === 'STUDENT';

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [siderCollapsed, setSiderCollapsed] = useState(false);

  useEffect(() => {
    if (isStudent) {
      api
        .get<Chapter[]>('/chapters')
        .then((res) => setChapters(res.data))
        .catch(() => {
          // Silencioso — el sidebar se queda vacío si falla
        });
    }
  }, [isStudent, user?.id]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const tutorMenuItems = [
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

  const tutorSelectedKey =
    tutorMenuItems.find((item) => location.pathname.startsWith(item.key))?.key ||
    tutorMenuItems[0]?.key;

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Cerrar Sesión',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout className="app-layout">
      <Header className="app-layout__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setSiderCollapsed(!siderCollapsed)}
            className="app-layout__menu-toggle"
            aria-label="Abrir menú"
          />
          <img src="/upb_logo.svg" alt="UPB" style={{ height: 24, marginRight: 8 }} />
          <Title
            level={4}
            className="app-layout__brand"
            onClick={() => navigate(isStudent ? '/chapters' : '/tutor')}
          >
            Thena
          </Title>
        </div>

        <Space align="center" size={12}>
          <Tag color={isStudent ? 'blue' : 'green'}>
            {isStudent ? 'Estudiante' : 'Tutor'}
          </Tag>

          <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              icon={<UserOutlined />}
              className="app-layout__user-btn"
            >
              <Text className="app-layout__user-name">
                {user?.name ?? 'Usuario'}
              </Text>
            </Button>
          </Dropdown>
        </Space>
      </Header>

      <Layout>
        <Sider
          width={240}
          className="app-layout__sider"
          breakpoint="lg"
          collapsedWidth={0}
          trigger={null}
          collapsed={siderCollapsed}
          onCollapse={setSiderCollapsed}
        >
          {isStudent ? (
            <ChapterTimeline chapters={chapters} />
          ) : (
            <Menu
              mode="inline"
              selectedKeys={[tutorSelectedKey]}
              items={tutorMenuItems}
              onClick={({ key }) => navigate(key)}
              className="app-layout__menu"
            />
          )}
        </Sider>

        <Content className="app-layout__content">
          <Outlet />
        </Content>
      </Layout>

      <Footer className="app-layout__footer">
        <Alert
          message="Toda retroalimentación generada es orientación preliminar, no una corrección definitiva ni una calificación."
          type="info"
          showIcon
          banner
        />
      </Footer>
    </Layout>
  );
}
