import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ChapterStatusFilter {
  LOCKED = 'LOCKED',
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
}

export class TutorDashboardQueryDto {
  @IsOptional()
  @IsString()
  studentName?: string;

  @IsOptional()
  @IsEnum(ChapterStatusFilter)
  chapterStatus?: ChapterStatusFilter;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
