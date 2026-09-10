import { apiGet, apiPost } from './api';

export type AlertHistoryItem = {
  id: string;
  userId: string;
  type?: string | null;
  severity?: string | null;
  message?: string | null;
  status?: string | null;
  triggerSource?: string | null;
  stage?: string | null;
  escalationLevel?: number | null;
  riskScore?: number | null;
  riskSnapshot?: Record<string, unknown> | null;
  detectionSummary?: string[] | null;
  createdAt?: string | null;
  resolvedAt?: string | null;
  cancelExpiresAt?: string | null;
  escalatedAt?: string | null;

  session?: {
    id: string;
    status?: string | null;
    startedAt?: string | null;
    endedAt?: string | null;
    lastLocationAt?: string | null;
  } | null;

  latestAudit?: {
    eventType?: string | null;
    source?: string | null;
    createdAt?: string | null;
  } | null;
};

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

export const createAlert = (
  input: string | CreateAlertRequest = 'panic',
) => {
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

  return apiPost<CreateAlertResponse>(
    '/alerts',
    body,
    { auth: true },
  );
};

export const getAlertHistory = (limit = 40) => {
  const safeLimit = Math.min(
    Math.max(Math.floor(limit) || 40, 1),
    100,
  );

  return apiGet<AlertHistoryItem[]>(
    `/alerts/history?limit=${safeLimit}`,
    { auth: true },
  );
};

export const escalateAlert = (
  alertId: string,
  body: EscalateAlertRequest,
) =>
  apiPost<EscalateAlertResponse>(
    `/alerts/${alertId}/escalate`,
    body,
    { auth: true },
  );

export const cancelAlert = (alertId: string) =>
  apiPost<CancelAlertResponse>(
    `/alerts/${alertId}/cancel`,
    {},
    { auth: true },
  );