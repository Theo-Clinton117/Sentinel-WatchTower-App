import { apiGet } from './api';
import type { AuthUser } from './auth';

export async function getCurrentUser() {
  return apiGet<AuthUser>('/users/me', { auth: true });
}
