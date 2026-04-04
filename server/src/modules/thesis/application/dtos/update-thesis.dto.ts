import { IsOptional, IsUUID, MaxLength } from 'class-validator';

export class UpdateThesisDto {
  @IsOptional()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsUUID()
  tutorId?: string;
}
