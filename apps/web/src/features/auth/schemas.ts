/**
 * @file schemas.ts — Zod validation for auth forms (shared by RHF resolvers).
 * Mirrors the backend's auth validation so the client fails fast with friendly copy.
 */
import { z } from 'zod';

const email = z.string().min(1, 'Enter your email').email('Enter a valid email');
const password = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[0-9]/, 'Add a number')
  .regex(/[^A-Za-z0-9]/, 'Add a special character');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your name').max(120),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export type RegisterForm = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export const mfaSchema = z.object({ code: z.string().length(6, 'Enter the 6-digit code').regex(/^\d+$/, 'Digits only') });
export type MfaForm = z.infer<typeof mfaSchema>;
