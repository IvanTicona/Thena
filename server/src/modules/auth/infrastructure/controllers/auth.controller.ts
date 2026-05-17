import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService } from '../../application/auth.service.js';
import { LoginDto, RegisterDto } from '../../application/dtos/auth.dto.js';
import { Public } from '../decorators/public.decorator.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import type { JwtPayload } from '../../domain/auth.types.js';

/** Strict rate limit for auth endpoints: 5 attempts per 60 seconds */
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } } as const;

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(AUTH_THROTTLE)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.register(dto);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
    };
    const tokens = this.authService.generateTokens(payload);
    this.authService.setAuthCookies(res, tokens);
    return user;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.login(dto);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
    };
    const tokens = this.authService.generateTokens(payload);
    this.authService.setAuthCookies(res, tokens);
    return user;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @UseGuards(AuthGuard('jwt-refresh'))
  async refresh(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken } = await this.authService.refresh(user.sub);
    res.cookie(
      'access_token',
      accessToken,
      this.authService.getCookieOptions('access'),
    );
    return { message: 'ok' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearAuthCookies(res);
    return { message: 'ok' };
  }
}
