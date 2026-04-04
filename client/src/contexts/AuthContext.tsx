import {
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import api from '../services/api';
import { ApiError } from '../services/api-error';
import { AuthContext } from './auth.context';
import type { AuthUser } from './auth.context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate user from server on mount (relies on httpOnly cookie)
  useEffect(() => {
    api
      .get<AuthUser>('/users/me')
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => {
        // 401 o error de red — usuario no autenticado
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthUser>('/auth/login', { email, password });
    setUser(res.data);
  }, []);

  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      role: 'STUDENT' | 'TUTOR',
    ) => {
      const res = await api.post<AuthUser>('/auth/register', {
        name,
        email,
        password,
        role,
      });
      setUser(res.data);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Ignorar errores de logout — limpiar estado de todas formas
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
