import { useAppStore } from '../store/useAppStore';
import { resolveDevBackendUrl } from './runtime-host';
import { loadSecureSession, saveSecureSession } from './secure-session';

const baseUrl = resolveDevBackendUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

export const API_BASE_URL = baseUrl;

if (__DEV__) {
  console.info('[Sentinel] API base URL:', baseUrl);
}

type RequestOptions = {
  auth?: boolean;
  timeoutMs?: number;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
let refreshInFlight: Promise<string | null> | null = null;

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: RequestOptions,
): Promise<T> {
  const headers = new Headers(init?.headers || {});
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  );

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (options?.auth) {
    const token = await getUsableAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let res: Response;
  const requestUrl = `${baseUrl}/api${path}`;

  if (__DEV__) {
    console.info('[Sentinel] API request:', requestUrl);
  }

  try {
    res = await fetch(requestUrl, {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (res.status === 401 && options?.auth) {
      const refreshed = await refreshSecureAccessToken();
      if (refreshed) {
        headers.set('Authorization', `Bearer ${refreshed}`);
        res = await fetch(requestUrl, { ...init, headers, signal: controller.signal });
      }
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new ApiError(
      aborted
        ? 'The request timed out. Check your connection and try again.'
        : 'Network connection failed. Check your internet connection and try again.',
      0,
      { path, reason: aborted ? 'timeout' : 'network_error' },
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  const data = text ? tryParseJson(text) : null;

  if (__DEV__) {
    console.info('[Sentinel] API response:', res.status, requestUrl);
  }

  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'message' in data
        ? normalizeMessage((data as { message?: unknown }).message)
        : `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

async function getUsableAccessToken() {
  const inMemory = useAppStore.getState().accessToken;
  if (inMemory) return inMemory;
  const session = await loadSecureSession();
  if (!session?.accessToken) return null;
  useAppStore.getState().restoreSecureAuth(session);
  return session.accessToken;
}

async function refreshSecureAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const session = await loadSecureSession();
    if (!session?.refreshToken) return null;
    try {
      const response = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { accessToken?: string; refreshToken?: string };
      if (!data.accessToken || !data.refreshToken) return null;
      const next = { accessToken: data.accessToken, refreshToken: data.refreshToken };
      await saveSecureSession(next);
      useAppStore.getState().restoreSecureAuth(next);
      return next.accessToken;
    } catch {
      return null;
    }
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeMessage(message: unknown) {
  if (Array.isArray(message)) {
    return message.join('\n');
  }

  if (typeof message === 'string') {
    return message;
  }

  if (typeof message === 'object' && message && 'message' in message) {
    return normalizeMessage((message as { message?: unknown }).message);
  }

  return 'Something went wrong. Please try again.';
}

export async function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { method: 'GET' }, options);
}

export type BackendHealth = {
  status: string;
  timestamp?: string;
  checks?: Record<string, unknown>;
};

export function checkBackendHealth() {
  return apiGet<BackendHealth>('/health', { timeoutMs: 10000 });
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>(
    path,
    {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    options,
  );
}

export async function apiPatch<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>(
    path,
    {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    options,
  );
}

export async function apiDelete<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { method: 'DELETE' }, options);
}
