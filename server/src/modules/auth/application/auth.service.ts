import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { CookieOptions, Response } from 'express';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import { AuthTokens, JwtPayload } from '../domain/auth.types.js';
import { LoginDto, RegisterDto } from './dtos/auth.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.client.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role,
        passwordHash,
      },
    });

    return this.omitPassword(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.omitPassword(user);
  }

  generateTokens(payload: JwtPayload): AuthTokens {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET', 'changeme-access'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRY', '15m'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>(
        'JWT_REFRESH_SECRET',
        'changeme-refresh',
      ),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRY', '7d'),
    });

    return { accessToken, refreshToken };
  }

  async refresh(userId: string): Promise<{ accessToken: string }> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET', 'changeme-access'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRY', '15m'),
    });

    return { accessToken };
  }

  getCookieOptions(type: 'access' | 'refresh'): CookieOptions {
    const isProduction = this.config.get('NODE_ENV') === 'production';
    const maxAge =
      type === 'access'
        ? 15 * 60 * 1000 // 15 minutes
        : 7 * 24 * 60 * 60 * 1000; // 7 days

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge,
    };
  }

  setAuthCookies(res: Response, tokens: AuthTokens): void {
    res.cookie('access_token', tokens.accessToken, this.getCookieOptions('access'));
    res.cookie('refresh_token', tokens.refreshToken, this.getCookieOptions('refresh'));
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
  }

  private omitPassword(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const { passwordHash: _hash, ...rest } = user;
    return rest;
  }
}
