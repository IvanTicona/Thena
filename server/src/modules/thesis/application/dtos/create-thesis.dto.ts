import { IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateThesisDto {
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsUUID()
  tutorId?: string;
}
