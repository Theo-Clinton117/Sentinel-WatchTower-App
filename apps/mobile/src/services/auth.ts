import { Platform } from 'react-native';
import { apiPost } from './api';

export type AuthFlow = 'login' | 'signup';

export type AuthUser = {
  id: string;
  phone?: string | null;
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
  email: string;
  mode: AuthFlow;
  devCode?: string;
};

type VerifyOtpResponse = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  user: AuthUser;
};

const defaultDeviceId = `expo-${Platform.OS}-sentinel`;

export function normalizeEmailInput(value: string) {
  return value.trim().toLowerCase();
}

export function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmailInput(value));
}

export function isOtpValid(value: string) {
  return /^\d{4,8}$/.test(value.trim());
}

type RequestOtpPayload = {
  email: string;
  name?: string;
  mode: AuthFlow;
};

type VerifyOtpPayload = RequestOtpPayload & {
  code: string;
};

export async function requestOtp(
  payload: RequestOtpPayload,
  deviceId = defaultDeviceId,
) {
  return apiPost<RequestOtpResponse>('/auth/otp/request', {
    email: normalizeEmailInput(payload.email),
    name: payload.name?.trim() || undefined,
    mode: payload.mode,
    deviceId,
    platform: Platform.OS,
  });
}

export async function verifyOtp(
  payload: VerifyOtpPayload,
  deviceId = defaultDeviceId,
) {
  return apiPost<VerifyOtpResponse>('/auth/otp/verify', {
    email: normalizeEmailInput(payload.email),
    name: payload.name?.trim() || undefined,
    mode: payload.mode,
    code: payload.code,
    deviceId,
  });
}
