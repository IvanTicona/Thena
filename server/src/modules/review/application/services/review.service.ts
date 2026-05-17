import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

export interface ReviewAgent {
  type: string;
  status: string;
}

export interface SourceReference {
  layer: 'TUTOR' | 'INSTITUTIONAL';
  chunkId: string;
  documentTitle: string;
  section: string;
}

export interface BySeverity {
  INFO: number;
  SUGGESTION: number;
  WARNING: number;
  ERROR: number;
}

export interface ReviewObservation {
  id: string;
  type: string;
  severity: string;
  message: string;
  suggestion: string | null;
  textFragment: string | null;
  offsetStart: number | null;
  offsetEnd: number | null;
  sourceReference: SourceReference | null;
  source: string;
  authorId: string | null;
  authorName: string | null;
  isMutable: boolean;
  escalationLevel: number;
}

export interface ReviewDiffResult {
  resolved: ReviewObservation[];
  persisting: ReviewObservation[];
  new: ReviewObservation[];
}

export interface ReviewJobBase {
  id: string;
  submissionId: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  agents: ReviewAgent[];
}

export interface ReviewJobCompleted extends ReviewJobBase {
  report: {
    id: string;
    summaryText: string;
    totalObservations: number;
    bySeverity: BySeverity;
  };
  observations: ReviewObservation[];
  markdownContent: string | null;
}

export type ReviewJobResult = ReviewJobBase | ReviewJobCompleted;

function parseSourceReference(value: unknown): SourceReference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const obj = value as Record<string, string>;
  return {
    layer: obj.layer as SourceReference['layer'],
    chunkId: obj.chunkId,
    documentTitle: obj.documentTitle,
    section: obj.section,
  };
}

function parseBySeverity(value: unknown): BySeverity {
  if (!value || typeof value !== 'object') {
    return { INFO: 0, SUGGESTION: 0, WARNING: 0, ERROR: 0 };
  }
  const obj = value as Record<string, number>;
  return {
    INFO: obj.INFO !== undefined ? obj.INFO : 0,
    SUGGESTION: obj.SUGGESTION !== undefined ? obj.SUGGESTION : 0,
    WARNING: obj.WARNING !== undefined ? obj.WARNING : 0,
    ERROR: obj.ERROR !== undefined ? obj.ERROR : 0,
  };
}

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async findByJobId(
    jobId: string,
    requestingUserId?: string,
  ): Promise<ReviewJobResult> {
    const job = await this.prisma.client.reviewJob.findUnique({
      where: { id: jobId },
      include: {
        agentResults: {
          select: { agentType: true, status: true },
          orderBy: { createdAt: 'asc' },
        },
        reviewReport: true,
        submission: {
          select: {
            markdownContent: true,
            chapter: {
              select: {
                thesis: { select: { studentId: true } },
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Review job not found');
    }

    // Tutors bypass this check (they access reviews via their own dashboard endpoints).
    if (requestingUserId !== undefined) {
      const studentId = job.submission.chapter.thesis.studentId;
      if (studentId !== requestingUserId) {
        throw new ForbiddenException('No tenés permiso para ver esta revisión');
      }
    }

    const base = {
      id: job.id,
      submissionId: job.submissionId,
      status: job.status,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      durationMs: job.durationMs,
      agents: job.agentResults.map((a) => ({
        type: a.agentType,
        status: a.status,
      })),
    };

    if (job.status !== 'COMPLETED' || !job.reviewReport) {
      return base;
    }

    const observations = await this.prisma.client.observation.findMany({
      where: { reviewReportId: job.reviewReport.id },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return {
      ...base,
      report: {
        id: job.reviewReport.id,
        summaryText: job.reviewReport.summaryText,
        totalObservations: job.reviewReport.totalObservations,
        bySeverity: parseBySeverity(job.reviewReport.bySeverity),
      },
      observations: observations.map((o) => ({
        id: o.id,
        type: o.type,
        severity: o.severity,
        message: o.message,
        suggestion: o.suggestion,
        textFragment: o.textFragment,
        offsetStart: o.offsetStart,
        offsetEnd: o.offsetEnd,
        sourceReference: parseSourceReference(o.sourceReference),
        source: o.source,
        authorId: o.authorId,
        authorName: o.author !== null ? o.author.name : null,
        isMutable: o.isMutable,
        escalationLevel: o.escalationLevel,
      })),
      markdownContent: job.submission.markdownContent,
    };
  }

  async findLatestByChapterId(
    chapterId: string,
    requestingUserId?: string,
  ): Promise<ReviewJobResult> {
    const submission = await this.prisma.client.submission.findFirst({
      where: { chapterId },
      orderBy: { versionNumber: 'desc' },
      select: { reviewJob: { select: { id: true } } },
    });

    if (!submission?.reviewJob) {
      throw new NotFoundException('No review found for this chapter');
    }

    return this.findByJobId(submission.reviewJob.id, requestingUserId);
  }

  async getDiff(
    submissionV1Id: string,
    submissionV2Id: string,
    requestingUserId?: string,
  ): Promise<ReviewDiffResult> {
    const getObsForSubmission = async (
      submissionId: string,
    ): Promise<ReviewObservation[]> => {
      const job = await this.prisma.client.reviewJob.findUnique({
        where: { submissionId },
        include: { reviewReport: true },
      });

      if (!job || job.status !== 'COMPLETED' || !job.reviewReport) {
        return [];
      }

      if (requestingUserId !== undefined) {
        const submission = await this.prisma.client.submission.findUnique({
          where: { id: submissionId },
          select: {
            chapter: { select: { thesis: { select: { studentId: true } } } },
          },
        });
        if (
          submission === null ||
          submission.chapter.thesis.studentId !== requestingUserId
        ) {
          throw new ForbiddenException(
            'No tenés permiso para ver esta revisión',
          );
        }
      }

      const obs = await this.prisma.client.observation.findMany({
        where: { reviewReportId: job.reviewReport.id },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      });

      return obs.map((o) => ({
        id: o.id,
        type: o.type,
        severity: o.severity,
        message: o.message,
        suggestion: o.suggestion,
        textFragment: o.textFragment,
        offsetStart: o.offsetStart,
        offsetEnd: o.offsetEnd,
        sourceReference: parseSourceReference(o.sourceReference),
        source: o.source,
        authorId: o.authorId,
        authorName: o.author !== null ? o.author.name : null,
        isMutable: o.isMutable,
        escalationLevel: o.escalationLevel,
      }));
    };

    const [obsV1, obsV2] = await Promise.all([
      getObsForSubmission(submissionV1Id),
      getObsForSubmission(submissionV2Id),
    ]);

    return diffObservations(obsV1, obsV2);
  }

  async generatePdfReport(
    jobId: string,
    userId: string,
    userRole: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const job = await this.prisma.client.reviewJob.findUnique({
      where: { id: jobId },
      include: {
        reviewReport: true,
        submission: {
          select: {
            versionNumber: true,
            chapter: {
              select: {
                number: true,
                title: true,
                thesis: {
                  select: {
                    title: true,
                    studentId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Review job not found');
    }

    if (userRole === 'STUDENT') {
      const studentId = job.submission.chapter.thesis.studentId;
      if (studentId !== userId) {
        throw new ForbiddenException(
          'No tenés permiso para exportar esta revisión',
        );
      }
    }

    if (job.status !== 'COMPLETED' || !job.reviewReport) {
      throw new ForbiddenException(
        'Solo se pueden exportar revisiones completadas',
      );
    }

    const observations = await this.prisma.client.observation.findMany({
      where: { reviewReportId: job.reviewReport.id },
      orderBy: { type: 'asc' },
    });

    const chapter = job.submission.chapter;
    const thesis = chapter.thesis;
    const report = job.reviewReport;
    const bySeverity = parseBySeverity(report.bySeverity);
    const versionNumber = job.submission.versionNumber;
    const chapterNumber = chapter.number;

    const buffer = await buildPdfBuffer({
      thesisTitle: thesis.title,
      chapterNumber,
      chapterTitle: chapter.title,
      versionNumber,
      completedAt: job.completedAt,
      summaryText: report.summaryText,
      totalObservations: report.totalObservations,
      bySeverity,
      observations: observations.map((o) => ({
        id: o.id,
        type: o.type as string,
        severity: o.severity as string,
        message: o.message,
        suggestion: o.suggestion,
        textFragment: o.textFragment,
        source: o.source as string,
      })),
    });

    const filename = `thena-reporte-cap${chapterNumber}-v${versionNumber}.pdf`;
    return { buffer, filename };
  }
}

function wordOverlapSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);

  const wordsA = new Set(tokenize(a));
  const wordsB = new Set(tokenize(b));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }

  return (overlap * 2) / (wordsA.size + wordsB.size);
}

function diffObservations(
  v1: ReviewObservation[],
  v2: ReviewObservation[],
): ReviewDiffResult {
  const SIMILARITY_THRESHOLD = 0.8;

  const matchedV2Indices = new Set<number>();
  const persisting: ReviewObservation[] = [];
  const resolved: ReviewObservation[] = [];

  for (const obs1 of v1) {
    let bestMatch = -1;
    let bestScore = 0;

    for (let i = 0; i < v2.length; i++) {
      if (matchedV2Indices.has(i)) continue;
      const obs2 = v2[i];

      // Must share the same type and severity bucket
      if (obs1.type !== obs2.type || obs1.severity !== obs2.severity) continue;

      const score = wordOverlapSimilarity(obs1.message, obs2.message);
      if (score >= SIMILARITY_THRESHOLD && score > bestScore) {
        bestScore = score;
        bestMatch = i;
      }
    }

    if (bestMatch >= 0) {
      matchedV2Indices.add(bestMatch);
      persisting.push(v1.find((o) => o === obs1)!);
    } else {
      resolved.push(obs1);
    }
  }

  const newObservations = v2.filter((_, i) => !matchedV2Indices.has(i));

  return { resolved, persisting, new: newObservations };
}

const SEVERITY_COLORS: Record<string, string> = {
  ERROR: '#ff4d4f',
  WARNING: '#faad14',
  SUGGESTION: '#1890ff',
  INFO: '#52c41a',
};

const SEVERITY_LABELS: Record<string, string> = {
  ERROR: 'Error',
  WARNING: 'Advertencia',
  SUGGESTION: 'Sugerencia',
  INFO: 'Info',
};

const AGENT_LABELS: Record<string, string> = {
  STRUCTURE: 'Estructura',
  METHODOLOGY: 'Metodología',
  COHERENCE: 'Coherencia',
  CITATIONS: 'Citas',
  FORMAT: 'Formato',
  INTEGRITY: 'Integridad',
};

interface PdfObservation {
  id: string;
  type: string;
  severity: string;
  message: string;
  suggestion: string | null;
  textFragment: string | null;
  source: string;
}

interface PdfBuildInput {
  thesisTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  versionNumber: number;
  completedAt: Date | null;
  summaryText: string;
  totalObservations: number;
  bySeverity: BySeverity;
  observations: PdfObservation[];
}

function buildPdfBuffer(input: PdfBuildInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      bufferPages: true,
      info: {
        Title: `Reporte de Revision - Capitulo ${input.chapterNumber}`,
        Author: 'Thena - Sistema de Revision de Proyectos de Grado',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const MARGIN = 56;
    const CONTENT_WIDTH = doc.page.width - MARGIN * 2;

    doc
      .fillColor('#1a1a2e')
      .font('Helvetica-Bold')
      .fontSize(20)
      .text('Thena \u2014 Reporte de Revisi\u00f3n', MARGIN, 56);

    const dateStr = (
      input.completedAt !== null ? input.completedAt : new Date()
    ).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    doc
      .fillColor('#555555')
      .font('Helvetica')
      .fontSize(10)
      .text(`Generado el ${dateStr}`, MARGIN);

    doc.moveDown(0.5);

    const infoBoxY = doc.y;
    const infoBoxH = 66;
    doc
      .roundedRect(MARGIN, infoBoxY, CONTENT_WIDTH, infoBoxH, 6)
      .fillAndStroke('#f5f5f5', '#e0e0e0');

    doc
      .fillColor('#333333')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('TESIS', MARGIN + 12, infoBoxY + 10);

    doc
      .fillColor('#111111')
      .font('Helvetica')
      .fontSize(10)
      .text(input.thesisTitle, MARGIN + 12, infoBoxY + 22, {
        width: CONTENT_WIDTH - 24,
        ellipsis: true,
      });

    doc
      .fillColor('#555555')
      .font('Helvetica')
      .fontSize(9)
      .text(
        `Cap\u00edtulo ${input.chapterNumber}: ${input.chapterTitle}   \u00b7   Versi\u00f3n ${input.versionNumber}`,
        MARGIN + 12,
        infoBoxY + 44,
        { width: CONTENT_WIDTH - 24 },
      );

    doc.text('', MARGIN, infoBoxY + infoBoxH + 16);

    drawSectionTitle(doc, 'Resumen', MARGIN, CONTENT_WIDTH);
    doc.moveDown(0.3);

    doc
      .fillColor('#222222')
      .font('Helvetica')
      .fontSize(10)
      .text(input.summaryText, MARGIN, doc.y, {
        width: CONTENT_WIDTH,
        align: 'justify',
      });

    doc.moveDown(0.8);

    doc
      .fillColor('#333333')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(
        `Total: ${input.totalObservations} observaci\u00f3n${input.totalObservations !== 1 ? 'es' : ''}`,
        MARGIN,
      );

    doc.moveDown(0.4);

    const sevOrder: Array<keyof BySeverity> = [
      'ERROR',
      'WARNING',
      'SUGGESTION',
      'INFO',
    ];
    const statY = doc.y;
    let statX = MARGIN;
    const badgeH = 16;
    const badgeW = 95;

    for (const sev of sevOrder) {
      const count = input.bySeverity[sev];
      if (!count) continue;
      const color = SEVERITY_COLORS[sev];
      const label = `${SEVERITY_LABELS[sev]}: ${count}`;

      doc.roundedRect(statX, statY, badgeW, badgeH, 3).fillColor(color).fill();

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(label, statX + 5, statY + 4, {
          width: badgeW - 8,
          lineBreak: false,
        });

      statX += badgeW + 6;
    }

    doc.text('', MARGIN, statY + badgeH + 16);

    drawSectionTitle(doc, 'Observaciones', MARGIN, CONTENT_WIDTH);
    doc.moveDown(0.5);

    if (input.observations.length === 0) {
      doc
        .fillColor('#888888')
        .font('Helvetica')
        .fontSize(10)
        .text('No se encontraron observaciones.', MARGIN, doc.y);
    } else {
      const grouped = new Map<string, PdfObservation[]>();
      for (const obs of input.observations) {
        if (!grouped.has(obs.type)) {
          grouped.set(obs.type, []);
        }
        grouped.get(obs.type)!.push(obs);
      }

      const agentOrder = [
        'STRUCTURE',
        'METHODOLOGY',
        'COHERENCE',
        'CITATIONS',
        'FORMAT',
        'INTEGRITY',
      ];

      for (const agentType of agentOrder) {
        const group = grouped.get(agentType);
        if (!group || group.length === 0) continue;

        doc.moveDown(0.5);

        if (doc.y > doc.page.height - 130) {
          doc.addPage();
        }

        const agentLabelValue = AGENT_LABELS[agentType];
        const agentLabel =
          agentLabelValue !== undefined ? agentLabelValue : agentType;
        doc
          .fillColor('#1a1a2e')
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(agentLabel, MARGIN, doc.y);

        const lineY = doc.y;
        doc
          .moveTo(MARGIN, lineY)
          .lineTo(MARGIN + CONTENT_WIDTH, lineY)
          .strokeColor('#cccccc')
          .lineWidth(0.5)
          .stroke();

        doc.moveDown(0.5);

        for (const obs of group) {
          const estHeight =
            70 + (obs.textFragment ? 40 : 0) + (obs.suggestion ? 30 : 0);
          if (doc.y + estHeight > doc.page.height - 70) {
            doc.addPage();
          }

          renderObservation(doc, obs, MARGIN, CONTENT_WIDTH);
          doc.moveDown(0.3);
        }
      }
    }

    addFooters(doc);

    doc.end();
  });
}

function drawSectionTitle(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  width: number,
) {
  doc
    .fillColor('#1a1a2e')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(text, x, doc.y, { width });

  const lineY = doc.y;
  doc
    .moveTo(x, lineY)
    .lineTo(x + width, lineY)
    .strokeColor('#1a1a2e')
    .lineWidth(1)
    .stroke();

  doc.moveDown(0.3);
}

function renderObservation(
  doc: PDFKit.PDFDocument,
  obs: PdfObservation,
  x: number,
  width: number,
) {
  const colorValue = SEVERITY_COLORS[obs.severity];
  const color = colorValue !== undefined ? colorValue : '#888888';
  const boxY = doc.y;

  const badgeW = 80;
  const badgeH = 16;
  doc.roundedRect(x, boxY, badgeW, badgeH, 3).fillColor(color).fill();

  const sevLabelValue = SEVERITY_LABELS[obs.severity];
  const sevLabel = sevLabelValue !== undefined ? sevLabelValue : obs.severity;
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(7)
    .text(sevLabel.toUpperCase(), x + 6, boxY + 4, {
      width: badgeW - 10,
      lineBreak: false,
    });

  const sourceBadgeX = x + badgeW + 6;
  const sourceLabel = obs.source === 'TUTOR' ? 'Tutor' : 'Thena';
  const sourceBg = obs.source === 'TUTOR' ? '#722ed1' : '#1890ff';
  doc.roundedRect(sourceBadgeX, boxY, 44, badgeH, 3).fillColor(sourceBg).fill();

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(7)
    .text(sourceLabel, sourceBadgeX + 6, boxY + 4, {
      width: 32,
      lineBreak: false,
    });

  doc
    .fillColor('#111111')
    .font('Helvetica')
    .fontSize(10)
    .text(obs.message, x + 4, boxY + badgeH + 6, { width: width - 4 });

  if (obs.textFragment) {
    doc.moveDown(0.25);
    const fragY = doc.y;
    doc
      .rect(x + 4, fragY, 3, 12)
      .fillColor('#aaaaaa')
      .fill();
    doc
      .fillColor('#666666')
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text(`"${obs.textFragment}"`, x + 12, fragY, { width: width - 12 });
  }

  if (obs.suggestion) {
    doc.moveDown(0.25);
    doc
      .fillColor('#444444')
      .font('Helvetica')
      .fontSize(9)
      .text(`\u2192 Sugerencia: ${obs.suggestion}`, x + 4, doc.y, {
        width: width - 4,
      });
  }

  doc.moveDown(0.25);
  doc
    .moveTo(x, doc.y)
    .lineTo(x + width, doc.y)
    .strokeColor('#eeeeee')
    .lineWidth(0.5)
    .stroke();
}

function addFooters(doc: PDFKit.PDFDocument) {
  const docWithBuffer = doc as unknown as {
    bufferedPageRange: () => { start: number; count: number };
  };

  const range = docWithBuffer.bufferedPageRange?.();
  if (!range) return;

  const footerText =
    'Generado por Thena \u2014 Sistema de Revisi\u00f3n de Proyectos de Grado';

  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const pageNum = i + 1;
    const totalPages = range.count;
    const footerY = doc.page.height - 36;
    const pageWidth = doc.page.width;

    doc
      .moveTo(56, footerY - 8)
      .lineTo(pageWidth - 56, footerY - 8)
      .strokeColor('#cccccc')
      .lineWidth(0.5)
      .stroke();

    doc
      .fillColor('#999999')
      .font('Helvetica')
      .fontSize(8)
      .text(footerText, 56, footerY, {
        width: pageWidth - 112,
        align: 'left',
        lineBreak: false,
      });

    doc
      .fillColor('#999999')
      .font('Helvetica')
      .fontSize(8)
      .text(`P\u00e1gina ${pageNum} de ${totalPages}`, 56, footerY, {
        width: pageWidth - 112,
        align: 'right',
        lineBreak: false,
      });
  }
}
