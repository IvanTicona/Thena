import { IsEmail, IsEnum, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export enum UserRole {
  STUDENT = 'STUDENT',
  TUTOR = 'TUTOR',
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  name: string;

  @MinLength(8)
  password: string;

  /**
   * Optional role field — if provided and not STUDENT, the controller will
   * reject with 403. Always forced to STUDENT for self-registration.
   */
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;
}
