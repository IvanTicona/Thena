import { IsEnum, IsOptional, IsString } from 'class-validator';

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
}
