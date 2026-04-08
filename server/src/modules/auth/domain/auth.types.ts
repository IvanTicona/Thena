import { Request } from 'express';

export type UserRole = 'STUDENT' | 'TUTOR' | 'REVIEWER' | 'ADMIN' | 'SUPER_ADMIN';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
