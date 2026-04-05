import { useState } from 'react';
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
  HistoryOutlined,
  LogoutOutlined,
  MenuOutlined,
  SafetyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { ChaptersProvider, useChapters } from '../../contexts/ChaptersContext';
import { ChapterTimeline } from './ChapterTimeline';
import type { Chapter } from '../../types';
import './AppLayout.css';

const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;

const STUDENT_NAV = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/chapters', icon: <SafetyOutlined />, label: 'Revisión AI' },
  { key: '/history', icon: <HistoryOutlined />, label: 'Historial' },
];

function AppLayoutInner({ chapters }: { chapters: Chapter[] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isStudent = user?.role === 'STUDENT';
  const showSidebar = isStudent && location.pathname.startsWith('/chapters');

  const [siderCollapsed, setSiderCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const tutorMenuItems = [
    { key: '/tutor', icon: <DashboardOutlined />, label: 'Panel de Tutor' },
    { key: '/tutor/knowledge', icon: <DatabaseOutlined />, label: 'Base de Conocimiento' },
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

  /* ── "Revisión AI" smart navigation ───────────────────── */
  const handleNavClick = (key: string) => {
    if (key === '/chapters' && chapters.length > 0) {
      // Navigate directly to first actionable chapter, skip ChapterList redirect
      const actionable = chapters.find(
        (ch) => ch.status === 'DRAFT' || ch.status === 'IN_REVIEW',
      );
      const target = actionable || chapters[0];
      navigate(`/chapters/${target.id}`);
    } else {
      navigate(key);
    }
  };

  return (
    <Layout className="app-layout">
      <Header className="app-layout__header">
        {/* Left: hamburger (only when sidebar is visible, mobile only) + logo + brand */}
        <div className="app-layout__header-left">
          {showSidebar && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setSiderCollapsed(!siderCollapsed)}
              className="app-layout__menu-toggle"
              aria-label="Abrir menú"
            />
          )}
          <img src="/upb_logo.svg" alt="UPB" className="app-layout__logo" />
          <Title
            level={4}
            className="app-layout__brand"
            onClick={() => navigate(isStudent ? '/dashboard' : '/tutor')}
          >
            Thena
          </Title>
        </div>

        {/* Center: student horizontal nav tabs */}
        {isStudent && (
          <nav className="app-layout__nav" aria-label="Navegación principal">
            {STUDENT_NAV.map((item) => {
              const isActive =
                item.key === '/chapters'
                  ? location.pathname.startsWith('/chapters')
                  : location.pathname === item.key ||
                    location.pathname.startsWith(item.key + '/');
              return (
                <button
                  key={item.key}
                  type="button"
                  className={[
                    'app-layout__nav-item',
                    isActive ? 'app-layout__nav-item--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleNavClick(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Right: role tag + user dropdown */}
        <Space align="center" size={12}>
          <Tag color={isStudent ? 'blue' : 'green'}>
            {isStudent ? 'Estudiante' : 'Tutor'}
          </Tag>
          <Dropdown
            menu={{ items: userMenuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button type="text" icon={<UserOutlined />} className="app-layout__user-btn">
              <Text className="app-layout__user-name">{user?.name ?? 'Usuario'}</Text>
            </Button>
          </Dropdown>
        </Space>
      </Header>

      <Layout>
        {/* Sidebar: ChapterTimeline for students (always mounted, width transitions),
            standard Menu for tutors */}
        {isStudent ? (
          <Sider
            width={showSidebar ? 240 : 0}
            className={[
              'app-layout__sider',
              showSidebar ? '' : 'app-layout__sider--hidden',
            ].filter(Boolean).join(' ')}
            trigger={null}
            collapsed={showSidebar ? siderCollapsed : true}
            collapsedWidth={0}
            onCollapse={setSiderCollapsed}
          >
            <ChapterTimeline chapters={chapters} />
          </Sider>
        ) : (
          <Sider
            width={240}
            className="app-layout__sider"
            breakpoint="lg"
            collapsedWidth={0}
            trigger={null}
            collapsed={siderCollapsed}
            onCollapse={setSiderCollapsed}
          >
            <Menu
              mode="inline"
              selectedKeys={[tutorSelectedKey]}
              items={tutorMenuItems}
              onClick={({ key }) => navigate(key)}
              className="app-layout__menu"
            />
          </Sider>
        )}

        <Content className="app-layout__content">
          <Outlet />
        </Content>
      </Layout>

      <Footer className="app-layout__footer">
        <Alert
          title="Toda retroalimentación generada es orientación preliminar, no una corrección definitiva ni una calificación."
          type="info"
          showIcon
          banner
        />
      </Footer>
    </Layout>
  );
}

function StudentAppLayout() {
  const { chapters } = useChapters();
  return <AppLayoutInner chapters={chapters} />;
}

function TutorAppLayout() {
  return <AppLayoutInner chapters={[]} />;
}

/**
 * AppLayout wraps the inner layout with ChaptersProvider for students.
 * Tutors skip the provider since they don't need shared chapter state.
 */
export function AppLayout() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';

  if (isStudent) {
    return (
      <ChaptersProvider enabled>
        <StudentAppLayout />
      </ChaptersProvider>
    );
  }

  return <TutorAppLayout />;
}
