import { apiPost } from './api';
import type { RapidAlertSeverity, RapidAlertTag } from '../constants/rapid-alerts';

export type CreateRapidReportInput = {
  title: string;
  severity: RapidAlertSeverity;
  category: RapidAlertTag;
  lat: number;
  lng: number;
  locationAccuracyM?: number | null;
  aiConfidence?: number;
};

export type CreateRapidReportResponse = {
  id: string;
  title: string;
  status: string;
  category?: string | null;
  severity?: RapidAlertSeverity;
  createdAt?: string;
  distribution?: {
    status: string;
    reason?: string | null;
    visibilityScope?: string | null;
  };
};

export async function createRapidReport(input: CreateRapidReportInput) {
  return apiPost<CreateRapidReportResponse>(
    '/reports',
    {
      title: input.title,
      category: input.category,
      severity: input.severity,
      lat: input.lat,
      lng: input.lng,
      locationAccuracyM: input.locationAccuracyM ?? null,
      aiConfidence: input.aiConfidence ?? undefined,
      confirmedSeverity: input.severity === 'critical',
    },
    { auth: true },
  );
}
