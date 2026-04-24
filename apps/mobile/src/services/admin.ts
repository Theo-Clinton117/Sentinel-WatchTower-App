import { apiGet, apiPost } from './api';

export type ReviewerFilter = 'pending' | 'reviewed' | 'flagged' | 'all';

export type ReviewerClassification =
  | 'confirmed_true'
  | 'likely_true'
  | 'inconclusive'
  | 'false'
  | 'malicious';

export type ReviewerResponseOutcome =
  | 'pending'
  | 'validated'
  | 'action_taken'
  | 'dismissed'
  | 'no_action';

export type ReviewerQueueReport = {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  status: string;
  category?: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt?: string;
  flagsCount: number;
  confirmationsCount: number;
  location?: {
    lat: number;
    lng: number;
    accuracyM?: number | null;
  } | null;
  distribution: {
    status: string;
    reason?: string | null;
    visibilityScope?: string | null;
    requiresManualReview: boolean;
    throttledUntil?: string | null;
    restrictionApplied?: string | null;
  };
  classification: {
    status: ReviewerClassification;
    responseOutcome: ReviewerResponseOutcome;
    aiConfidence: number;
    qualityScore: number;
    credibilitySnapshot: number;
    corroborationCount: number;
    reviewedAt?: string | null;
    reviewedBy?: string | null;
    notes?: string | null;
  };
  reporter: {
    id: string;
    name?: string | null;
    phone?: string | null;
    score: number;
    ratingTier: 'high' | 'mid' | 'low';
    restrictionLevel:
      | 'none'
      | 'warning'
      | 'temporary_restriction'
      | 'shadow_restriction'
      | 'ban';
  };
};

export type ReviewerQueueResponse = {
  filter: ReviewerFilter | string;
  summary: {
    pendingReviewCount: number;
    reviewedCount: number;
    highPriorityCount: number;
    flaggedCount: number;
  };
  reports: ReviewerQueueReport[];
};

export type ClassifyReportPayload = {
  classification: ReviewerClassification;
  responseOutcome?: ReviewerResponseOutcome;
  aiConfidence?: number;
  qualityScore?: number;
  corroborationCount?: number;
  notes?: string;
};

export async function getReviewerQueue(filter: ReviewerFilter = 'pending') {
  return apiGet<ReviewerQueueResponse>(`/admin/reports?filter=${encodeURIComponent(filter)}`, {
    auth: true,
  });
}

export async function classifyReviewerReport(reportId: string, payload: ClassifyReportPayload) {
  return apiPost<{ reportId: string; auditLogId: string }>(
    `/admin/reports/${reportId}/classify`,
    payload,
    { auth: true },
  );
}
