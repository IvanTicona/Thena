import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../contexts/useAuth';

/**
 * Wrapper for public-only routes (login, register).
 * Redirects authenticated users to their default page.
 */
export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    const defaultPath =
      user.role === 'STUDENT' ? '/dashboard'
      : user.role === 'TUTOR' ? '/tutor'
      : user.role === 'REVIEWER' ? '/reviewer'
      : user.role === 'SUPER_ADMIN' ? '/superadmin'
      : '/admin';
    return <Navigate to={defaultPath} replace />;
  }

  return <Outlet />;
}
