import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { setCurrentUserId } from '../services/api';
import api from '../services/api';
import type { ApiError } from '../services/api-error';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'TUTOR';
}

interface UserContextType {
  currentUser: User;
  users: User[];
  switchUser: (userId: string) => void;
  ready: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Fetch real users from API on mount
  useEffect(() => {
    api
      .get<User[]>('/users')
      .then((res) => {
        if (res.data.length > 0) {
          setUsers(res.data);
          const student = res.data.find((u) => u.role === 'STUDENT') || res.data[0];
          setCurrentUser(student);
          setCurrentUserId(student.id);
        }
      })
      .catch((err: ApiError) => {
        console.error('Failed to fetch users:', err.message);
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  const switchUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setCurrentUser(user);
      setCurrentUserId(user.id);
    }
  };

  if (!ready || !currentUser) {
    return null; // Don't render until users are loaded
  }

  return (
    <UserContext.Provider value={{ currentUser, users, switchUser, ready }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}
