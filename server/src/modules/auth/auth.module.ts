import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../shared/prisma/prisma.module.js';
import { AuthService } from './application/auth.service.js';
import { AuthController } from './infrastructure/controllers/auth.controller.js';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy.js';
import { JwtRefreshStrategy } from './infrastructure/strategies/jwt-refresh.strategy.js';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard.js';
import { RolesGuard } from './infrastructure/guards/roles.guard.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    ConfigModule,
    AuditModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET', 'changeme-access'),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_EXPIRY', '15m') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
