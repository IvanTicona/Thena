import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../../auth/domain/auth.types.js';

export type AdminCreatableRole = 'TUTOR' | 'REVIEWER' | 'ADMIN';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(['TUTOR', 'REVIEWER', 'ADMIN'])
  role!: AdminCreatableRole;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(['STUDENT', 'TUTOR', 'REVIEWER', 'ADMIN', 'SUPER_ADMIN'])
  role?: UserRole;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class UserListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['STUDENT', 'TUTOR', 'REVIEWER', 'ADMIN', 'SUPER_ADMIN'])
  role?: UserRole;
}
