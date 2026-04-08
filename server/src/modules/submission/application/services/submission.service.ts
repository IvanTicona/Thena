import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { StorageService } from '../../../../shared/storage/storage.service.js';
import { AuditService } from '../../../audit/application/audit.service.js';
import { AuditAction } from '../../../audit/domain/audit.constants.js';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@Injectable()
export class SubmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue('review') private readonly reviewQueue: Queue,
    private readonly auditService: AuditService,
  ) {}

  async findAllForStudent(studentId: string) {
    const submissions = await this.prisma.client.submission.findMany({
      where: { studentId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        chapterId: true,
        versionNumber: true,
        fileName: true,
        submittedAt: true,
        chapter: {
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
          },
        },
        reviewJob: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
    return submissions;
  }

  async create(
    studentId: string,
    chapterId: string,
    file: Express.Multer.File,
  ) {
    // Validate MIME type
    if (file.mimetype !== DOCX_MIME) {
      throw new BadRequestException(
        'Invalid file format. Only DOCX files are allowed.',
      );
    }

    // Fetch chapter with thesis for ownership check
    const chapter = await this.prisma.client.chapter.findUnique({
      where: { id: chapterId },
      include: { thesis: { select: { studentId: true } } },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    if (chapter.thesis.studentId !== studentId) {
      throw new ForbiddenException('Chapter does not belong to this student');
    }

    if (chapter.status === 'LOCKED') {
      throw new BadRequestException(
        'Chapter is locked. Previous chapter must be approved first.',
      );
    }

    if (chapter.status === 'APPROVED') {
      throw new BadRequestException('Chapter is already approved.');
    }

    if (chapter.status === 'IN_REVIEW') {
      throw new BadRequestException(
        'Chapter is waiting for tutor review. Cannot submit new versions.',
      );
    }

    // Block if there is an active AI review (QUEUED or PROCESSING) for this chapter
    const activeReviewJob = await this.prisma.client.reviewJob.findFirst({
      where: {
        submission: { chapterId },
        status: { in: ['QUEUED', 'PROCESSING'] },
      },
    });

    if (activeReviewJob) {
      throw new BadRequestException(
        'An AI review is in progress. Please wait for it to finish before submitting again.',
      );
    }

    // Determine version number
    const lastSubmission = await this.prisma.client.submission.findFirst({
      where: { chapterId },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (lastSubmission?.versionNumber ?? 0) + 1;

    // Upload to MinIO
    const objectName = `${studentId}/${chapterId}/${versionNumber}.docx`;
    const fileUrl = await this.storage.upload(
      objectName,
      file.buffer,
      file.mimetype,
    );

    // Create submission, review job, and update chapter
    const submission = await this.prisma.client.submission.create({
      data: {
        chapterId,
        studentId,
        versionNumber,
        fileUrl,
        fileName: file.originalname,
        mimeType: file.mimetype,
      },
    });

    const reviewJob = await this.prisma.client.reviewJob.create({
      data: {
        submissionId: submission.id,
        status: 'QUEUED',
      },
    });

    // NOTE: We no longer set chapter status to IN_REVIEW here.
    // The chapter stays in DRAFT while AI processes. The student
    // explicitly requests tutor review via a separate endpoint.

    const result = { submission, reviewJob };

    // Enqueue job to BullMQ for the engine to pick up
    await this.reviewQueue.add('process-review', {
      jobId: result.reviewJob.id,
      submissionId: result.submission.id,
      chapterId,
      studentId,
      fileUrl,
      versionNumber,
    });

    // Audit log — fire-and-forget (errors swallowed in AuditService)
    void this.auditService.log({
      action: AuditAction.SUBMIT_CHAPTER,
      actorId: studentId,
      entityType: 'submission',
      entityId: result.submission.id,
      metadata: { chapterId, versionNumber },
    });

    return {
      id: result.submission.id,
      chapterId: result.submission.chapterId,
      versionNumber: result.submission.versionNumber,
      fileName: result.submission.fileName,
      submittedAt: result.submission.submittedAt,
      reviewJob: {
        id: result.reviewJob.id,
        status: result.reviewJob.status,
      },
    };
  }
}
