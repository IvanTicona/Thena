export interface User {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'TUTOR';
  createdAt: string;
}

export type ChapterStatus = 'LOCKED' | 'DRAFT' | 'IN_REVIEW' | 'APPROVED';

export interface Chapter {
  id: string;
  number: number;
  title: string;
  status: ChapterStatus;
  latestSubmission: SubmissionSummary | null;
  submissionCount: number;
}

export interface SubmissionSummary {
  id: string;
  versionNumber: number;
  submittedAt: string;
}

export interface Submission {
  id: string;
  chapterId: string;
  versionNumber: number;
  fileName: string;
  submittedAt: string;
  reviewJob: ReviewJobSummary | null;
}

export interface ReviewJobSummary {
  id: string;
  status: JobStatus;
}

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type AgentType = 'STRUCTURE' | 'METHODOLOGY' | 'COHERENCE';
export type Severity = 'INFO' | 'SUGGESTION' | 'WARNING' | 'ERROR';

export interface Observation {
  id: string;
  type: AgentType;
  severity: Severity;
  message: string;
  suggestion: string | null;
  textFragment: string | null;
  offsetStart: number | null;
  offsetEnd: number | null;
  sourceReference: SourceReference | null;
}

export interface SourceReference {
  layer: 'TUTOR' | 'INSTITUTIONAL';
  chunkId: string;
  documentTitle: string;
  section: string;
}

export interface ReviewReport {
  id: string;
  summaryText: string;
  totalObservations: number;
  bySeverity: Record<Severity, number>;
}

export interface ReviewAgentStatus {
  type: AgentType;
  status: string;
}

export interface ReviewResult {
  id: string;
  submissionId: string;
  status: JobStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  agents: ReviewAgentStatus[];
  report: ReviewReport | null;
  observations: Observation[];
  markdownContent: string | null;
}

export interface KnowledgeDoc {
  sourceDocument: string;
  layer: 'TUTOR' | 'INSTITUTIONAL';
  chunkCount: number;
  lastUpdated: string;
}

export interface TutorSummary {
  id: string;
  name: string;
  email: string;
}

export interface ThesisDocument {
  id: string;
  title: string;
  studentId: string;
  tutorId: string | null;
  tutor?: TutorSummary;
  student?: {
    id: string;
    name: string;
    email: string;
  };
  chapters?: Chapter[];
  createdAt: string;
  updatedAt: string;
}
