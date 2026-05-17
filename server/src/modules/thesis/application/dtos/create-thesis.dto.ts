import {
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateThesisDto {
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @IsNotEmpty()
  @IsUUID()
  tutorId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  chapterCount?: number;
}
