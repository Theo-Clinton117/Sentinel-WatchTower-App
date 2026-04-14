import { apiGet, apiPost } from './api';
import type { EmergencyLocation, EmergencySession } from '../store/useAppStore';

type SessionResponse = {
  id: string;
  alertId: string;
  userId: string;
  status: string;
  escalationLevel?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
  lastLocationAt?: string | null;
  alertStatus?: string | null;
  triggerSource?: string | null;
  alertStage?: string | null;
  riskScore?: number | null;
  cancelExpiresAt?: string | null;
  riskSnapshot?: Record<string, unknown> | null;
  detectionSummary?: string[] | null;
};

type SessionLocationsResponse = {
  sessionId: string;
  locations: EmergencyLocation[];
};

const mapSession = (session: SessionResponse): EmergencySession => ({
  alertId: session.alertId,
  sessionId: session.id,
  status: session.status,
  triggerSource: session.triggerSource,
  startedAt: session.startedAt,
  escalationLevel: session.escalationLevel,
  alertStatus: session.alertStatus,
  alertStage: session.alertStage,
  riskScore: session.riskScore ?? 0,
  cancelExpiresAt: session.cancelExpiresAt,
  riskSnapshot: session.riskSnapshot ?? {},
  detectionSummary: session.detectionSummary ?? [],
});

export async function getActiveSession() {
  const response = await apiGet<SessionResponse | null>('/sessions/active', { auth: true });
  return response ? mapSession(response) : null;
}

export async function closeSession(sessionId: string) {
  const response = await apiPost<SessionResponse>(`/sessions/${sessionId}/close`, {}, { auth: true });
  return mapSession(response);
}

export async function listSessionLocations(sessionId: string) {
  const response = await apiGet<SessionLocationsResponse>(`/sessions/${sessionId}/locations`, {
    auth: true,
  });
  return response.locations;
}

export async function ingestSessionLocations(
  sessionId: string,
  locations: Array<{
    lat: number;
    lng: number;
    accuracyM?: number | null;
    source?: string | null;
    recordedAt?: string;
  }>,
) {
  return apiPost<{ received: number; locations: EmergencyLocation[] }>(
    `/sessions/${sessionId}/locations`,
    { locations },
    { auth: true },
  );
}
