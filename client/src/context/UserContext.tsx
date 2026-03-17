import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { setCurrentUserId } from '../services/api';
import api from '../services/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'TUTOR';
}

// Fallback mock users — replaced by API call
const FALLBACK_USERS: User[] = [
  {
    id: 'student-001',
    name: 'Ivan Torres',
    email: 'student@thena.dev',
    role: 'STUDENT',
  },
  {
    id: 'tutor-001',
    name: 'Dr. Tutor',
    email: 'tutor@thena.dev',
    role: 'TUTOR',
  },
];

interface UserContextType {
  currentUser: User;
  users: User[];
  switchUser: (userId: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(FALLBACK_USERS);
  const [currentUser, setCurrentUser] = useState<User>(FALLBACK_USERS[0]);

  // Fetch real users from API
  useEffect(() => {
    setCurrentUserId(currentUser.id);
    api
      .get<User[]>('/users')
      .then((res) => {
        if (res.data.length > 0) {
          setUsers(res.data);
          // Keep current selection if user exists in new list, otherwise pick first
          const existing = res.data.find((u) => u.id === currentUser.id);
          if (!existing) {
            setCurrentUser(res.data[0]);
            setCurrentUserId(res.data[0].id);
          }
        }
      })
      .catch(() => {
        // API not available — keep fallback users
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const switchUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setCurrentUser(user);
      setCurrentUserId(user.id);
    }
  };

  return (
    <UserContext.Provider value={{ currentUser, users, switchUser }}>
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
