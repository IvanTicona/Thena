import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  name!: string;

  @MinLength(8)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  password!: string;
}
