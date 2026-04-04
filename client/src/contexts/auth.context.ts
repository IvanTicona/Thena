import { createContext } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'TUTOR';
}

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    role: 'STUDENT' | 'TUTOR',
  ) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
