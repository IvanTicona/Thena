import type { UserRole } from '../../../auth/domain/auth.types.js';

export class UserListItem {
  id!: string;
  email!: string;
  name!: string;
  role!: UserRole;
  createdAt!: Date;
}

export class PaginatedUsersResponse {
  data!: UserListItem[];
  meta!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
