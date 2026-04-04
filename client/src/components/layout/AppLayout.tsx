import { useEffect, useState } from 'react';
import {
  Layout,
  Menu,
  Tag,
  Typography,
  Alert,
  Badge,
  Button,
  Space,
  Dropdown,
} from 'antd';
import {
  BookOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import api from '../../services/api';
import type { Chapter, ChapterStatus } from '../../types';
import './AppLayout.css';

const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;

const STATUS_DOT: Record<ChapterStatus, string> = {
  LOCKED: '#d9d9d9',
  DRAFT: '#1677ff',
  IN_REVIEW: '#faad14',
  APPROVED: '#52c41a',
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isStudent = user?.role === 'STUDENT';

  const [chapters, setChapters] = useState<Chapter[]>([]);

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

  const studentMenuItems =
    chapters.length > 0
      ? chapters.map((ch) => ({
          key: `/chapters/${ch.id}`,
          icon: (
            <Badge
              dot
              color={STATUS_DOT[ch.status]}
              offset={[2, 0]}
            >
              <BookOutlined />
            </Badge>
          ),
          label: `Cap. ${ch.number}: ${ch.title}`,
        }))
      : [
          {
            key: '/chapters',
            icon: <BookOutlined />,
            label: 'Mis Capítulos',
          },
        ];

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

  const menuItems = isStudent ? studentMenuItems : tutorMenuItems;

  const selectedKey =
    menuItems.find((item) => location.pathname.startsWith(item.key))?.key ||
    menuItems[0]?.key;

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
        <Title
          level={4}
          className="app-layout__brand"
          onClick={() => navigate(isStudent ? '/chapters' : '/tutor')}
        >
          Thena
        </Title>

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
        <Sider width={220} className="app-layout__sider">
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            className="app-layout__menu"
          />
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
