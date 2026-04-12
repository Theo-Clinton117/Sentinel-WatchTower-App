import { apiGet, apiPost } from './api';

export type TrustedContact = {
  id: string;
  userId: string;
  contactUserId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  status?: string | null;
  priority?: number | null;
  canViewLocation?: boolean;
  canViewHistory?: boolean;
  canSms?: boolean;
  canCall?: boolean;
  createdAt?: string;
};

export type CreateTrustedContactInput = {
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  priority?: number;
  canViewLocation?: boolean;
  canViewHistory?: boolean;
  canSms?: boolean;
  canCall?: boolean;
};

export function listContacts() {
  return apiGet<TrustedContact[]>('/contacts', { auth: true });
}

export function createContact(body: CreateTrustedContactInput) {
  return apiPost<TrustedContact>('/contacts', body, { auth: true });
}
