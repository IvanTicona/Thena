import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../contexts/useAuth';
import { thesisApi } from '../services/api';

/**
 * StudentThesisGuard — wraps student routes.
 * If the student has no thesis yet, redirects to /onboarding.
 * Only applies when user.role === 'STUDENT'.
 */
export function StudentThesisGuard() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [hasThesis, setHasThesis] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'STUDENT') {
      // Non-student users skip the check
      Promise.resolve().then(() => setChecking(false));
      return;
    }

    thesisApi
      .list()
      .then((res) => {
        setHasThesis(res.data.length > 0);
      })
      .catch(() => {
        // On error, assume no thesis to be safe — will re-check after onboarding
        setHasThesis(false);
      })
      .finally(() => setChecking(false));
  }, [user]);

  if (checking) {
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

  if (user?.role === 'STUDENT' && hasThesis === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
