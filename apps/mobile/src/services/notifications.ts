import { apiGet } from './api';

export type AppNotification = {
  id: string;
  userId: string;
  type: string | null;
  channel: string | null;
  status: string | null;
  payload: Record<string, unknown> | null;
  relatedSessionId: string | null;
  createdAt: string | null;
  sentAt: string | null;
};

export async function listNotifications() {
  return apiGet<AppNotification[]>('/notifications', { auth: true });
}
