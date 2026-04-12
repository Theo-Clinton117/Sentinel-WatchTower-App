import { useAppStore } from '../store/useAppStore';

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000';

type RequestOptions = {
  auth?: boolean;
};

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

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (options?.auth) {
    const token = useAppStore.getState().accessToken;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const res = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  const data = text ? tryParseJson(text) : null;

  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'message' in data
        ? normalizeMessage((data as { message?: unknown }).message)
        : `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, data);
  }

  return data as T;
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

  return 'Something went wrong. Please try again.';
}

export async function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { method: 'GET' }, options);
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>(
    path,
    {
    method: 'POST',
    body: JSON.stringify(body),
    },
    options,
  );
}
