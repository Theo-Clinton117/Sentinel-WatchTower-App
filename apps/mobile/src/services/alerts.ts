import { apiPost } from './api';

type CreateAlertResponse = {
  alertId: string;
  sessionId: string;
  status: string;
  triggerSource?: string | null;
  alertStage?: string | null;
  escalationLevel?: number | null;
  startedAt?: string | null;
  alertStatus?: string | null;
  riskScore?: number | null;
  cancelExpiresAt?: string | null;
  riskSnapshot?: Record<string, unknown> | null;
  detectionSummary?: string[] | null;
};

type CancelAlertResponse = {
  id: string;
  status: string;
  sessionId?: string | null;
};

type CreateAlertRequest = {
  triggerSource?: string;
  stage?: string;
  riskScore?: number;
  riskSnapshot?: Record<string, unknown>;
  detectionSummary?: string[];
  cancelWindowSeconds?: number;
};

type EscalateAlertResponse = CreateAlertResponse;

type EscalateAlertRequest = {
  stage: string;
  riskScore?: number;
  riskSnapshot?: Record<string, unknown>;
  detectionSummary?: string[];
};

export const createAlert = (input: string | CreateAlertRequest = 'panic') => {
  const body =
    typeof input === 'string'
      ? { triggerSource: input }
      : {
          triggerSource: input.triggerSource || 'panic',
          stage: input.stage,
          riskScore: input.riskScore,
          riskSnapshot: input.riskSnapshot,
          detectionSummary: input.detectionSummary,
          cancelWindowSeconds: input.cancelWindowSeconds,
        };

  return apiPost<CreateAlertResponse>('/alerts', body, { auth: true });
};

export const escalateAlert = (alertId: string, body: EscalateAlertRequest) =>
  apiPost<EscalateAlertResponse>(`/alerts/${alertId}/escalate`, body, { auth: true });

export const cancelAlert = (alertId: string) =>
  apiPost<CancelAlertResponse>(`/alerts/${alertId}/cancel`, {}, { auth: true });
