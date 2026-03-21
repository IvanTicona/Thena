export class ReviewAgentStatus {
  type: string;
  status: string;
}

export class ReviewReportSummary {
  id: string;
  summaryText: string;
  totalObservations: number;
  bySeverity: Record<string, number>;
}

export class ReviewObservation {
  id: string;
  type: string;
  severity: string;
  message: string;
  suggestion: string | null;
  textFragment: string | null;
  offsetStart: number | null;
  offsetEnd: number | null;
  sourceReference: string | null;
}

export class ReviewResponse {
  id: string;
  submissionId: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  agents: ReviewAgentStatus[];
  report?: ReviewReportSummary;
  observations?: ReviewObservation[];
  markdownContent?: string | null;
}
