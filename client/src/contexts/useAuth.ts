import { useContext } from 'react';
import { AuthContext } from './auth.context';
import type { AuthContextType } from './auth.context';

export type { AuthContextType };

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
