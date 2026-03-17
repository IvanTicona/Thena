import { IsIn } from 'class-validator';

export class ApproveChapterDto {
  @IsIn(['APPROVE'])
  action: 'APPROVE';
}

export class RejectChapterDto {
  @IsIn(['REJECT'])
  action: 'REJECT';
}
