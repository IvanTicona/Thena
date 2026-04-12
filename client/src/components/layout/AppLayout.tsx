import { useState } from 'react';
import {
  Layout,
  Menu,
  Typography,
  Button,
  Dropdown,
} from 'antd';
import { ChangePasswordModal } from './ChangePasswordModal';
import {
  DashboardOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  LockOutlined,
  MenuOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  LinkOutlined,
  BookOutlined,
  AuditOutlined,
  EyeOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { ChaptersProvider, useChapters } from '../../contexts/ChaptersContext';
import { ChapterTimeline } from './ChapterTimeline';
import { NotificationBell } from '../NotificationBell';
import type { Chapter } from '../../types';
import './AppLayout.css';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const STUDENT_NAV = [
  { key: '/dashboard', label: 'Dashboard' },
  { key: '/chapters', label: 'Revisión' },
];

function AppLayoutInner({ chapters }: { chapters: Chapter[] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isStudent = user?.role === 'STUDENT';
  const isReviewer = user?.role === 'REVIEWER';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const showSidebar = isStudent && location.pathname.startsWith('/chapters');

  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const reviewerMenuItems = [
    { key: '/reviewer', icon: <EyeOutlined />, label: 'Panel de Revisor' },
  ];

  const tutorMenuItems = [
    { key: '/tutor', icon: <DashboardOutlined />, label: 'Panel de Tutor' },
    { key: '/tutor/knowledge', icon: <DatabaseOutlined />, label: 'Base de Conocimiento' },
  ];

  const adminMenuItems = [
    { key: '/admin', icon: <DashboardOutlined />, label: 'Panel Admin' },
    { key: '/admin/users', icon: <UsergroupAddOutlined />, label: 'Usuarios' },
    { key: '/admin/assignments', icon: <LinkOutlined />, label: 'Asignaciones' },
    { key: '/admin/knowledge', icon: <BookOutlined />, label: 'Base de Conocimiento' },
    { key: '/admin/metrics', icon: <BarChartOutlined />, label: 'Métricas' },
  ];

  const superAdminMenuItems = [
    { key: '/superadmin', icon: <DashboardOutlined />, label: 'Panel Super Admin' },
    { key: '/admin/users', icon: <UsergroupAddOutlined />, label: 'Usuarios' },
    { key: '/admin/assignments', icon: <LinkOutlined />, label: 'Asignaciones' },
    { key: '/admin/knowledge', icon: <BookOutlined />, label: 'Base de Conocimiento' },
    { key: '/admin/metrics', icon: <BarChartOutlined />, label: 'Métricas' },
    { key: '/superadmin/audit', icon: <AuditOutlined />, label: 'Auditoría' },
  ];

  const activeMenuItems = isSuperAdmin
    ? superAdminMenuItems
    : isAdmin
      ? adminMenuItems
      : isReviewer
        ? reviewerMenuItems
        : tutorMenuItems;

  // For admin: match longest prefix to handle /admin vs /admin/users etc
  const nonAdminSelectedKey =
    tutorMenuItems.find((item) => location.pathname.startsWith(item.key))?.key ||
    tutorMenuItems[0]?.key;

  const adminSelectedKey =
    [...adminMenuItems].reverse().find((item) => location.pathname.startsWith(item.key))?.key ||
    adminMenuItems[0]?.key;

  const superAdminSelectedKey =
    [...superAdminMenuItems].reverse().find((item) => location.pathname.startsWith(item.key))?.key ||
    superAdminMenuItems[0]?.key;

  const reviewerSelectedKey =
    reviewerMenuItems.find((item) => location.pathname.startsWith(item.key))?.key ||
    reviewerMenuItems[0]?.key;

  const selectedKey = isSuperAdmin
    ? superAdminSelectedKey
    : isAdmin
      ? adminSelectedKey
      : isReviewer
        ? reviewerSelectedKey
        : nonAdminSelectedKey;

  const userMenuItems = [
    {
      key: 'change-password',
      icon: <LockOutlined />,
      label: 'Cambiar contraseña',
      onClick: () => setChangePasswordOpen(true),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Cerrar Sesión',
      danger: true,
      onClick: handleLogout,
    },
  ];

  const brandTarget = isStudent ? '/dashboard' : isSuperAdmin ? '/superadmin' : isAdmin ? '/admin' : isReviewer ? '/reviewer' : '/tutor';

  /* ── "Revisión" smart navigation ────────────────────────── */
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
        {/* Top row: hamburger + logo + brand */}
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
            onClick={() => navigate(brandTarget)}
          >
            THENA
          </Title>
        </div>

        {/* Center: student nav tabs (separate element for mobile wrapping) */}
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
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Right: notification bell + user dropdown */}
        <div className="app-layout__header-right">
          <NotificationBell />
          <Dropdown
            menu={{ items: userMenuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button type="text" icon={<UserOutlined />} className="app-layout__user-btn">
              <Text className="app-layout__user-name">{user?.name ?? 'Usuario'}</Text>
            </Button>
          </Dropdown>
        </div>
      </Header>

      <Layout>
        {/* Sidebar: ChapterTimeline for students (always mounted, width transitions),
            standard Menu for tutors and admins */}
        {isStudent ? (
          <>
            {/* Backdrop overlay for mobile sidebar */}
            {showSidebar && (
              <div
                className={[
                  'app-layout__sider-backdrop',
                  siderCollapsed ? 'app-layout__sider-backdrop--hidden' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => setSiderCollapsed(true)}
              />
            )}
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
          </>
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
              selectedKeys={[selectedKey]}
              items={activeMenuItems}
              onClick={({ key }) => navigate(key)}
              className="app-layout__menu"
            />
          </Sider>
        )}

        <Content className="app-layout__content">
          <Outlet />
        </Content>
      </Layout>

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </Layout>
  );
}

function StudentAppLayout() {
  const { chapters } = useChapters();
  return <AppLayoutInner chapters={chapters} />;
}

function NonStudentAppLayout() {
  return <AppLayoutInner chapters={[]} />;
}

/**
 * AppLayout wraps the inner layout with ChaptersProvider for students.
 * Tutors and admins skip the provider since they don't need shared chapter state.
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

  return <NonStudentAppLayout />;
}
