import { Platform } from 'react-native';
import { apiPost } from './api';

export type AuthUser = {
  id: string;
  phone: string;
  name?: string | null;
  email?: string | null;
  status?: string | null;
  roles?: string[];
  reviewerRequest?: {
    id: string;
    status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
    motivation?: string | null;
    adminNote?: string | null;
    requestedAt?: string | null;
    reviewedAt?: string | null;
  } | null;
  credibility?: {
    score: number;
    ratingTier: 'high' | 'mid' | 'low';
    restrictionLevel:
      | 'none'
      | 'warning'
      | 'temporary_restriction'
      | 'shadow_restriction'
      | 'ban';
    restrictionExpiresAt?: string | null;
    warningCount: number;
    totalReportsCount: number;
    confirmedTrueReportsCount: number;
    likelyTrueReportsCount: number;
    inconclusiveReportsCount: number;
    falseReportsCount: number;
    maliciousReportsCount: number;
    corroboratedReportsCount: number;
    qualityScoreAverage: number;
    lastReportedAt?: string | null;
    lastScoredAt?: string | null;
  } | null;
};

type RequestOtpResponse = {
  success: boolean;
  phone: string;
  devCode?: string;
};

type VerifyOtpResponse = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  user: AuthUser;
};

const defaultDeviceId = `expo-${Platform.OS}-sentinel`;

export function normalizePhoneInput(value: string) {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');

  if (!digits) {
    return '';
  }

  return `${hasPlus ? '+' : '+'}${digits}`;
}

export function isPhoneValid(value: string) {
  return /^\+[1-9]\d{9,14}$/.test(value);
}

export function isOtpValid(value: string) {
  return /^\d{4,8}$/.test(value.trim());
}

export async function requestOtp(phone: string, deviceId = defaultDeviceId) {
  return apiPost<RequestOtpResponse>('/auth/otp/request', {
    phone,
    deviceId,
    platform: Platform.OS,
  });
}

export async function verifyOtp(phone: string, code: string, deviceId = defaultDeviceId) {
  return apiPost<VerifyOtpResponse>('/auth/otp/verify', {
    phone,
    code,
    deviceId,
  });
}
