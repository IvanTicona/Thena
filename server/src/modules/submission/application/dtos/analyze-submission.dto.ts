import { IsUUID, IsString, IsNotEmpty } from 'class-validator';

export class AnalyzeSubmissionDto {
  @IsUUID()
  chapterId!: string;
}

export class ConfirmSubmissionDto {
  @IsUUID()
  chapterId!: string;

  @IsString()
  @IsNotEmpty()
  tempFileKey!: string;
}
