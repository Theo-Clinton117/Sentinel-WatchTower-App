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

export type SentinelUserMatch = {
  userId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  hasSentinel: boolean;
  matchSource: 'email' | 'phone';
  matchedEmail?: string | null;
  matchedPhone?: string | null;
};

export type CreateTrustedContactInput = {
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  contactUserId?: string;
  status?: string;
  priority?: number;
  canViewLocation?: boolean;
  canViewHistory?: boolean;
  canSms?: boolean;
  canCall?: boolean;
};

export function listContacts() {
  return apiGet<TrustedContact[]>('/contacts', { auth: true });
}

export function searchSentinelUsersByEmail(email: string) {
  return apiGet<SentinelUserMatch[]>(
    `/contacts/search?email=${encodeURIComponent(email)}`,
    { auth: true },
  );
}

export function discoverSentinelContacts(body: {
  emails?: string[];
  phones?: string[];
}) {
  return apiPost<SentinelUserMatch[]>('/contacts/discover', body, { auth: true });
}

export function createContact(body: CreateTrustedContactInput) {
  return apiPost<TrustedContact>('/contacts', body, { auth: true });
}
