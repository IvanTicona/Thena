import { IsEmail, IsEnum, IsNotEmpty, MinLength } from 'class-validator';

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

  @IsEnum(UserRole)
  role: UserRole;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;
}
