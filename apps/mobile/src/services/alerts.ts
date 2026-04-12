import { apiPost } from './api';

type CreateAlertResponse = {
  alertId: string;
  sessionId: string;
  status: string;
  triggerSource?: string | null;
};

type CancelAlertResponse = {
  id: string;
  status: string;
  sessionId?: string | null;
};

export const createAlert = (triggerSource: string = 'panic') =>
  apiPost<CreateAlertResponse>('/alerts', { triggerSource }, { auth: true });

export const cancelAlert = (alertId: string) =>
  apiPost<CancelAlertResponse>(`/alerts/${alertId}/cancel`, {}, { auth: true });
