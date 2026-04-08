import { UserRole } from '../../../auth/domain/auth.types.js';

export class UserResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export class UserListItem {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export class PaginatedUsersResponse {
  data: UserListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
