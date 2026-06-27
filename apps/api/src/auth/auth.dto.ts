/**
 * @file auth.dto.ts
 * @module Auth
 *
 * Zod validation schemas and Swagger DTO classes for all authentication
 * endpoints. Every field constraint mirrors the API Contract Specification
 * (Phase 4, Group 1) and the Project Constitution security requirements.
 *
 * Architecture (ADR-008):
 * Zod schemas are used for runtime validation; TypeScript types are
 * automatically inferred — zero duplication. Swagger DTO classes are
 * thin wrappers used only for OpenAPI documentation generation.
 *
 * Email normalisation: all schemas lowercase + trim email addresses so
 * controllers and services always receive a canonical email value.
 */
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────────────────────
// Shared field definitions
// ─────────────────────────────────────────────────────────────────────────────

const emailField = z
  .string({ required_error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .email({ message: 'Please enter a valid email address.' })
  .max(320, { message: 'Email address must not exceed 320 characters.' });

const passwordField = z
  .string({ required_error: 'Password is required.' })
  .min(8,   { message: 'Password must be at least 8 characters.' })
  .max(128, { message: 'Password must not exceed 128 characters.' })
  .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
  .regex(/[0-9]/, { message: 'Password must contain at least one number.' })
  .regex(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character.' });

const totpField = z
  .string()
  .length(6, { message: 'MFA code must be exactly 6 digits.' })
  .regex(/^\d{6}$/, { message: 'MFA code must contain digits only.' });

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schemas  (validation + type inference)
// ─────────────────────────────────────────────────────────────────────────────

/** POST /auth/register */
export const RegisterSchema = z.object({
  firstName: z
    .string({ required_error: 'First name is required.' })
    .trim()
    .min(1, { message: 'First name cannot be empty.' })
    .max(100, { message: 'First name must not exceed 100 characters.' }),
  lastName: z
    .string({ required_error: 'Last name is required.' })
    .trim()
    .min(1, { message: 'Last name cannot be empty.' })
    .max(100, { message: 'Last name must not exceed 100 characters.' }),
  email: emailField,
  password: passwordField,
  examTargetDate: z
    .string()
    .date('Exam target date must be a valid date (YYYY-MM-DD).')
    .refine(
      (d) => new Date(d) > new Date(),
      { message: 'Exam target date must be in the future.' },
    )
    .optional(),
  school: z
    .string()
    .trim()
    .max(255, { message: 'School name must not exceed 255 characters.' })
    .optional(),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;

/** POST /auth/login */
export const LoginSchema = z.object({
  email:   emailField,
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, { message: 'Password cannot be empty.' }),
  mfaCode: totpField.optional(),
});

export type LoginDto = z.infer<typeof LoginSchema>;

/** POST /auth/verify-email */
export const VerifyEmailSchema = z.object({
  token: z
    .string({ required_error: 'Verification token is required.' })
    .min(32, { message: 'Invalid verification token.' }),
});

export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;

/** POST /auth/resend-verification */
export const ResendVerificationSchema = z.object({
  email: emailField,
});

export type ResendVerificationDto = z.infer<typeof ResendVerificationSchema>;

/** POST /auth/forgot-password */
export const ForgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;

/** POST /auth/reset-password */
export const ResetPasswordSchema = z.object({
  token: z
    .string({ required_error: 'Reset token is required.' })
    .min(32, { message: 'Invalid reset token.' }),
  newPassword: passwordField,
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;

/** PATCH /auth/change-password */
export const ChangePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: 'Current password is required.' })
      .min(1, { message: 'Current password cannot be empty.' }),
    newPassword: passwordField,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must differ from the current password.',
    path: ['newPassword'],
  });

export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

/** POST /auth/mfa/verify — 6-digit code */
export const MfaVerifySchema = z.object({
  code: totpField,
});
export type MfaVerifyDto = z.infer<typeof MfaVerifySchema>;

/** DELETE /auth/mfa — code required to disable */
export const MfaDisableSchema = z.object({
  code: totpField,
});
export type MfaDisableDto = z.infer<typeof MfaDisableSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Swagger DTO classes  (OpenAPI documentation only)
// ─────────────────────────────────────────────────────────────────────────────

export class RegisterDtoClass {
  @ApiProperty({ example: 'Juan', description: '1–100 chars.' })
  firstName!: string;

  @ApiProperty({ example: 'dela Cruz', description: '1–100 chars.' })
  lastName!: string;

  @ApiProperty({ example: 'juan@example.com', description: 'Valid email (max 320 chars). Stored lowercase.' })
  email!: string;

  @ApiProperty({ example: 'SecurePass1!', description: 'Min 8 chars, 1 uppercase, 1 number, 1 special.' })
  password!: string;

  @ApiPropertyOptional({ example: '2026-08-24', description: 'Target PRC exam date (YYYY-MM-DD). Must be future.' })
  examTargetDate?: string;

  @ApiPropertyOptional({ example: 'Mapua University', description: 'Max 255 chars.' })
  school?: string;
}

export class LoginDtoClass {
  @ApiProperty({ example: 'juan@example.com' })
  email!: string;

  @ApiProperty({ example: 'SecurePass1!' })
  password!: string;

  @ApiPropertyOptional({ example: '123456', description: '6-digit TOTP code. Required only if MFA is enabled.' })
  mfaCode?: string;
}

export class VerifyEmailDtoClass {
  @ApiProperty({ description: 'Raw token from the verification email link.' })
  token!: string;
}

export class ResendVerificationDtoClass {
  @ApiProperty({ example: 'juan@example.com', description: 'Email to resend verification to.' })
  email!: string;
}

export class ForgotPasswordDtoClass {
  @ApiProperty({ example: 'juan@example.com' })
  email!: string;
}

export class ResetPasswordDtoClass {
  @ApiProperty({ description: 'Raw token from the password reset email link.' })
  token!: string;

  @ApiProperty({ example: 'NewSecurePass1!' })
  newPassword!: string;
}

export class ChangePasswordDtoClass {
  @ApiProperty({ description: 'Current account password.' })
  currentPassword!: string;

  @ApiProperty({ example: 'NewSecurePass1!', description: 'Must differ from current password.' })
  newPassword!: string;
}

export class MfaVerifyDtoClass {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code from authenticator app.' })
  code!: string;
}

export class MfaDisableDtoClass {
  @ApiProperty({ example: '123456', description: 'Current TOTP code required to disable MFA.' })
  code!: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response DTO classes  (Swagger documentation shapes)
// ─────────────────────────────────────────────────────────────────────────────

export class AuthUserResponseDto {
  @ApiProperty({ example: '01J4XYZABC', description: 'User UUID' })
  id!: string;

  @ApiProperty({ example: 'juan@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'Juan' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'dela Cruz' })
  lastName?: string;

  @ApiProperty({ example: 'subscriber', description: 'Role slug' })
  role!: string;

  @ApiProperty({ example: 'pro', enum: ['free', 'basic', 'pro'] })
  subscriptionTier!: string;

  @ApiProperty({ example: true })
  isVerified!: boolean;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT access token. Use as: Authorization: Bearer {token}' })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: 900, description: 'Seconds until access token expires.' })
  expiresIn!: number;

  @ApiProperty({ type: AuthUserResponseDto })
  user!: AuthUserResponseDto;
}

export class RegisterResponseDto {
  @ApiProperty({ example: '01J4XYZABC' })
  userId!: string;

  @ApiProperty({ example: 'juan@example.com' })
  email!: string;

  @ApiProperty({ description: 'Instructs the client to check email.' })
  message!: string;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully.' })
  message!: string;
}

export class LogoutAllResponseDto {
  @ApiProperty({ example: 3, description: 'Number of active sessions revoked.' })
  sessionsRevoked!: number;
}

export class RefreshResponseDto {
  @ApiProperty({ description: 'New JWT access token.' })
  accessToken!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;
}

export class MfaSetupResponseDto {
  @ApiProperty({ description: 'otpauth:// URL for QR code generation.' })
  qrCodeUrl!: string;

  @ApiProperty({ description: 'Base32 TOTP secret — store securely; shown once.' })
  secret!: string;

  @ApiProperty({
    type: [String],
    description: '8 single-use backup codes — shown once. User must save these.',
  })
  backupCodes!: string[];

  @ApiProperty()
  message!: string;
}
