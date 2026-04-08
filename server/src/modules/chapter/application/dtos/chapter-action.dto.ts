import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveChapterDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class RejectChapterDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
