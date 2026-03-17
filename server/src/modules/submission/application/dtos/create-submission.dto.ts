import { IsUUID } from 'class-validator';

export class CreateSubmissionDto {
  @IsUUID()
  chapterId: string;
}
