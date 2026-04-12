import { apiGet, apiPost } from './api';

export type ReviewerRequest = {
  id: string;
  userId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  motivation?: string | null;
  adminNote?: string | null;
  requestedAt?: string | null;
  reviewedAt?: string | null;
};

export async function requestReviewerRole(motivation?: string) {
  return apiPost<ReviewerRequest>(
    '/roles/reviewer-request',
    { motivation: motivation?.trim() || undefined },
    { auth: true },
  );
}

export async function getMyReviewerRequest() {
  return apiGet<ReviewerRequest | null>('/roles/reviewer-request/me', { auth: true });
}
