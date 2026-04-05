import { IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class CreateThesisDto {
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @IsNotEmpty()
  @IsUUID()
  tutorId: string;
}
