/**
 * @file auth-api.ts — typed wrappers over the backend /auth endpoints.
 *
 * These call the shared `api` client. Auth-entry calls (login/register/refresh/
 * forgot/reset/verify) use `skipAuth` so they don't trigger the 401-refresh loop.
 * The access token is held in memory by the client; the refresh token is an
 * httpOnly cookie the browser sends automatically.
 */
import { api } from '@/lib/api/client';
import { tokenStore } from '@/lib/api/token-store';
import type {
  AuthUser, LoginInput, LoginResponse, RegisterInput, RegisterResponse,
  ForgotPasswordInput, ResetPasswordInput, VerifyEmailInput, MfaVerifyInput,
} from './types';

export const authApi = {
  async login(input: LoginInput): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/login', input, { skipAuth: true });
    if (data.accessToken) tokenStore.set(data.accessToken);
    return data;
  },

  async register(input: RegisterInput): Promise<RegisterResponse> {
    // The form collects a single "Full name"; the API expects firstName +
    // lastName. Split on whitespace: first token = firstName, the rest =
    // lastName (falling back to firstName for single-word names so the
    // required lastName is never empty).
    const trimmed = (input.fullName ?? '').trim().replace(/\s+/g, ' ');
    const [firstName, ...rest] = trimmed.split(' ');
    const lastName = rest.length > 0 ? rest.join(' ') : firstName;
    const payload = {
      email: input.email,
      password: input.password,
      firstName: firstName ?? '',
      lastName: lastName ?? '',
    };
    return api.data(api.post<RegisterResponse>('/auth/register', payload, { skipAuth: true }));
  },

  async verifyEmail(input: VerifyEmailInput): Promise<{ verified: boolean }> {
    return api.data(api.post('/auth/verify-email', input, { skipAuth: true }));
  },

  async resendVerification(email: string): Promise<{ sent: boolean }> {
    return api.data(api.post('/auth/resend-verification', { email }, { skipAuth: true }));
  },

  async forgotPassword(input: ForgotPasswordInput): Promise<{ sent: boolean }> {
    return api.data(api.post('/auth/forgot-password', input, { skipAuth: true }));
  },

  async resetPassword(input: ResetPasswordInput): Promise<{ reset: boolean }> {
    return api.data(api.post('/auth/reset-password', input, { skipAuth: true }));
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ changed: boolean }> {
    return api.data(api.patch('/auth/change-password', { currentPassword, newPassword }));
  },

  async me(): Promise<AuthUser> {
    return api.data(api.get<AuthUser>('/auth/me'));
  },

  async logout(): Promise<void> {
    try { await api.post('/auth/logout'); } finally { tokenStore.clear(); }
  },

  async logoutAll(): Promise<void> {
    try { await api.post('/auth/logout-all'); } finally { tokenStore.clear(); }
  },

  // ── MFA ───────────────────────────────────────────────────────────────────────
  async mfaSetup(): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl?: string }> {
    return api.data(api.post('/auth/mfa/setup'));
  },

  async mfaVerify(input: MfaVerifyInput): Promise<{ enabled: boolean }> {
    return api.data(api.post('/auth/mfa/verify', input));
  },

  async mfaDisable(): Promise<{ disabled: boolean }> {
    return api.data(api.delete('/auth/mfa'));
  },

  /** Silent refresh on app boot: repopulates the in-memory access token. */
  async bootstrap(): Promise<AuthUser | null> {
    const ok = await api.refresh();
    if (!ok) return null;
    try { return await this.me(); } catch { return null; }
  },
};
