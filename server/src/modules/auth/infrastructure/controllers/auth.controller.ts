import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from '../../application/auth.service.js';
import { LoginDto, RegisterDto } from '../../application/dtos/auth.dto.js';
import { Public } from '../decorators/public.decorator.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtPayload } from '../../domain/auth.types.js';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.register(dto);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as 'STUDENT' | 'TUTOR',
    };
    const tokens = this.authService.generateTokens(payload);
    this.authService.setAuthCookies(res, tokens);
    return user;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.login(dto);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as 'STUDENT' | 'TUTOR',
    };
    const tokens = this.authService.generateTokens(payload);
    this.authService.setAuthCookies(res, tokens);
    return user;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  async refresh(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken } = await this.authService.refresh(user.sub);
    const payload: JwtPayload = {
      sub: user.sub,
      email: user.email,
      role: user.role,
    };
    const tokens = this.authService.generateTokens(payload);
    res.cookie('access_token', accessToken, this.authService.getCookieOptions('access'));
    void tokens; // refresh endpoint only updates access cookie
    return { message: 'ok' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearAuthCookies(res);
    return { message: 'ok' };
  }
}
