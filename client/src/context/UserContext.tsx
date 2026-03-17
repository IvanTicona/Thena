import { createContext, useContext, useState, type ReactNode } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'TUTOR';
}

// Mock users — will be replaced by API call to GET /users
const MOCK_USERS: User[] = [
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
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]);

  const switchUser = (userId: string) => {
    const user = MOCK_USERS.find((u) => u.id === userId);
    if (user) setCurrentUser(user);
  };

  return (
    <UserContext.Provider
      value={{ currentUser, users: MOCK_USERS, switchUser }}
    >
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
