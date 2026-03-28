import { useEffect, useState } from 'react';
import { Layout, Menu, Select, Tag, Typography, Alert, Badge } from 'antd';
import {
  BookOutlined,
  DashboardOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import api from '../../services/api';
import type { Chapter, ChapterStatus } from '../../types';

const { Header, Sider, Content, Footer } = Layout;
const { Title } = Typography;

const STATUS_DOT: Record<ChapterStatus, string> = {
  LOCKED: '#d9d9d9',
  DRAFT: '#1677ff',
  IN_REVIEW: '#faad14',
  APPROVED: '#52c41a',
};

export function AppLayout() {
  const { currentUser, users, switchUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const isStudent = currentUser.role === 'STUDENT';

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
  }, [isStudent, currentUser.id]);

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
          message="Toda retroalimentación generada es orientación preliminar, no una corrección definitiva ni una calificación."
          type="info"
          showIcon
          banner
        />
      </Footer>
    </Layout>
  );
}
