import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'STUDENT' | 'TUTOR';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
