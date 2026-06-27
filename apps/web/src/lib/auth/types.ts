/**
 * @file types.ts — auth domain types, matching the backend /auth contract.
 */

export type UserRole =
  | 'super_admin' | 'admin' | 'content_admin' | 'content_author'
  | 'reviewer' | 'subscriber' | 'free_user';

export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'premium' | string;

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  isVerified?: boolean;
  fullName?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
  /** Present when MFA is required to complete login. */
  mfaRequired?: boolean;
}

export interface RegisterResponse {
  id: string;
  email: string;
}

export interface LoginInput { email: string; password: string; mfaCode?: string; }
export interface RegisterInput { email: string; password: string; fullName?: string; }
export interface ForgotPasswordInput { email: string; }
export interface ResetPasswordInput { token: string; password: string; }
export interface VerifyEmailInput { token: string; }
export interface MfaVerifyInput { code: string; }

/** Roles that may access the admin portal. */
export const ADMIN_ROLES: UserRole[] = ['super_admin', 'admin', 'content_admin', 'content_author', 'reviewer'];

export function isAdminRole(role: UserRole | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}
