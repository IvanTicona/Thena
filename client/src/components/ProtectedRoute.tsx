import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../contexts/useAuth';
import type { UserRole } from '../contexts/auth.context';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: React.ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to their default page based on role
    const defaultPath =
      user.role === 'STUDENT'
        ? '/dashboard'
        : user.role === 'TUTOR'
          ? '/tutor'
          : '/admin';
    return <Navigate to={defaultPath} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
