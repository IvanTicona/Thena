import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Spin, Alert, Button } from 'antd';
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
  const [error, setError] = useState<boolean>(false);

  const checkThesis = () => {
    if (!user || user.role !== 'STUDENT') {
      Promise.resolve().then(() => setChecking(false));
      return;
    }

    setChecking(true);
    setError(false);

    thesisApi
      .list()
      .then((res) => {
        // findMine returns a single object or null (not an array)
        setHasThesis(res.data !== null && res.data !== undefined);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => setChecking(false));
  };

  useEffect(() => {
    checkThesis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Alert
          type="error"
          message="Hubo un error al verificar tu proyecto. Intentá de nuevo."
          showIcon
          style={{ maxWidth: 480 }}
          action={
            <Button size="small" onClick={checkThesis}>
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  if (user?.role === 'STUDENT' && hasThesis === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
