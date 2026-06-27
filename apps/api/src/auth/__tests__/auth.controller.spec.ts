/**
 * @file auth.controller.spec.ts
 * @module Auth/Tests
 *
 * Unit tests for AuthController (thin HTTP adapter).
 *
 * Verifies: delegation to services, response shapes, cookie management.
 * All services mocked — this tests ONLY controller behaviour, not service logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AuthController }            from '../auth.controller';
import { RegisterService }           from '../services/register.service';
import { LoginService }              from '../services/login.service';
import { LogoutService }             from '../services/logout.service';
import { EmailVerificationService }  from '../services/email-verification.service';
import { PasswordResetService }      from '../services/password-reset.service';
import { CurrentUserService }        from '../services/current-user.service';
import { TokenService }              from '../services/token.service';
import { MfaService }                from '../services/mfa.service';

// ── Service mocks ─────────────────────────────────────────────────────────────

const mockRegisterService           = { register: vi.fn() };
const mockLoginService              = { login: vi.fn() };
const mockLogoutService             = { logoutCurrentDevice: vi.fn(), logoutAllDevices: vi.fn() };
const mockEmailVerificationService  = { verifyEmail: vi.fn(), resendVerification: vi.fn() };
const mockPasswordResetService      = { forgotPassword: vi.fn(), resetPassword: vi.fn(), changePassword: vi.fn() };
const mockCurrentUserService        = { getCurrentUser: vi.fn() };
const mockTokenService              = { generateTokenPair: vi.fn() };
const mockMfaService                = { setupMfa: vi.fn(), verifyTotp: vi.fn(), disableMfa: vi.fn() };

// ── Request / reply mocks ─────────────────────────────────────────────────────

const mockReply = { setCookie: vi.fn(), redirect: vi.fn() };
const mockReq   = { ip: '1.2.3.4', headers: { 'user-agent': 'test' }, cookies: {} };

const mockUser = { id: 'u1', email: 'juan@example.com', role: 'subscriber', subscriptionTier: 'basic' } as const;

// ── Test setup ────────────────────────────────────────────────────────────────

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: RegisterService,          useValue: mockRegisterService },
        { provide: LoginService,             useValue: mockLoginService },
        { provide: LogoutService,            useValue: mockLogoutService },
        { provide: EmailVerificationService, useValue: mockEmailVerificationService },
        { provide: PasswordResetService,     useValue: mockPasswordResetService },
        { provide: CurrentUserService,       useValue: mockCurrentUserService },
        { provide: TokenService,             useValue: mockTokenService },
        { provide: MfaService,               useValue: mockMfaService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  // ── register ────────────────────────────────────────────────────────────────

  describe('register()', () => {
    const dto = { firstName: 'Juan', lastName: 'DC', email: 'juan@example.com', password: 'SecurePass1!' };

    it('should delegate to RegisterService and return result', async () => {
      mockRegisterService.register.mockResolvedValue({
        userId: 'u1', email: 'juan@example.com', message: 'check email',
      });

      const result = await controller.register(dto, mockReq as any);
      expect(result.userId).toBe('u1');
      expect(mockRegisterService.register).toHaveBeenCalledWith(dto, '1.2.3.4');
    });

    it('should propagate ConflictException from RegisterService', async () => {
      mockRegisterService.register.mockRejectedValue(new ConflictException({ code: 'EMAIL_ALREADY_EXISTS' }));
      await expect(controller.register(dto, mockReq as any)).rejects.toThrow(ConflictException);
    });
  });

  // ── verifyEmail ─────────────────────────────────────────────────────────────

  describe('verifyEmail()', () => {
    it('should delegate to EmailVerificationService', async () => {
      mockEmailVerificationService.verifyEmail.mockResolvedValue({ message: 'verified' });
      const result = await controller.verifyEmail({ token: 'abc123-token' });
      expect(result.message).toBe('verified');
      expect(mockEmailVerificationService.verifyEmail).toHaveBeenCalledWith('abc123-token');
    });
  });

  // ── resendVerification ──────────────────────────────────────────────────────

  describe('resendVerification()', () => {
    it('should delegate to EmailVerificationService.resendVerification', async () => {
      mockEmailVerificationService.resendVerification.mockResolvedValue({ message: 'sent if exists' });
      const result = await controller.resendVerification({ email: 'juan@example.com' });
      expect(result.message).toBeDefined();
      expect(mockEmailVerificationService.resendVerification).toHaveBeenCalledWith('juan@example.com');
    });
  });

  // ── login ───────────────────────────────────────────────────────────────────

  describe('login()', () => {
    const dto = { email: 'juan@example.com', password: 'SecurePass1!' };

    it('should delegate to LoginService and set refresh cookie', async () => {
      mockLoginService.login.mockResolvedValue({
        tokenPair: { accessToken: 'jwt', rawRefreshToken: 'raw-rt', expiresIn: 900 },
        user: mockUser,
      });

      const result = await controller.login(dto, mockReq as any, mockReply as any);

      expect(result.accessToken).toBe('jwt');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(900);
      expect(mockReply.setCookie).toHaveBeenCalled();
    });

    it('should call LoginService with correct input including IP and UA', async () => {
      mockLoginService.login.mockResolvedValue({
        tokenPair: { accessToken: 'jwt', rawRefreshToken: 'rt', expiresIn: 900 },
        user: mockUser,
      });

      await controller.login(dto, mockReq as any, mockReply as any);

      expect(mockLoginService.login).toHaveBeenCalledWith(
        expect.objectContaining({ email: dto.email, ipAddress: '1.2.3.4', userAgent: 'test' }),
      );
    });
  });

  // ── refresh ─────────────────────────────────────────────────────────────────

  describe('refresh()', () => {
    it('should set new cookie and return new access token', async () => {
      const tokenPair = { accessToken: 'new-jwt', rawRefreshToken: 'new-rt', expiresIn: 900 };
      const req = { ...mockReq, user: tokenPair };

      const result = await controller.refresh(req as any, mockReply as any);

      expect(result.accessToken).toBe('new-jwt');
      expect(mockReply.setCookie).toHaveBeenCalled();
    });
  });

  // ── logout ──────────────────────────────────────────────────────────────────

  describe('logout()', () => {
    it('should delegate to LogoutService and clear cookie', async () => {
      mockLogoutService.logoutCurrentDevice.mockResolvedValue(undefined);
      const reqWithCookie = { ...mockReq, cookies: { refreshToken: 'raw-rt' } };

      await controller.logout(mockUser, reqWithCookie as any, mockReply as any);

      expect(mockLogoutService.logoutCurrentDevice).toHaveBeenCalledWith('raw-rt', mockUser);
      expect(mockReply.setCookie).toHaveBeenCalled(); // clearRefreshCookie calls setCookie with maxAge:0
    });
  });

  // ── logoutAll ───────────────────────────────────────────────────────────────

  describe('logoutAll()', () => {
    it('should return sessions revoked count and clear cookie', async () => {
      mockLogoutService.logoutAllDevices.mockResolvedValue({ sessionsRevoked: 3 });

      const result = await controller.logoutAll(mockUser, mockReply as any);

      expect(result.sessionsRevoked).toBe(3);
      expect(mockReply.setCookie).toHaveBeenCalled();
    });
  });

  // ── forgotPassword ──────────────────────────────────────────────────────────

  describe('forgotPassword()', () => {
    it('should delegate to PasswordResetService', async () => {
      mockPasswordResetService.forgotPassword.mockResolvedValue({ message: 'check email' });

      const result = await controller.forgotPassword({ email: 'juan@example.com' });
      expect(result.message).toBeDefined();
      expect(mockPasswordResetService.forgotPassword).toHaveBeenCalledWith('juan@example.com');
    });
  });

  // ── resetPassword ───────────────────────────────────────────────────────────

  describe('resetPassword()', () => {
    it('should delegate to PasswordResetService and clear cookie', async () => {
      mockPasswordResetService.resetPassword.mockResolvedValue({ message: 'password reset' });

      const result = await controller.resetPassword(
        { token: 'tok', newPassword: 'NewPass1!' },
        mockReply as any,
      );

      expect(result.message).toBe('password reset');
      expect(mockReply.setCookie).toHaveBeenCalled();
    });
  });

  // ── changePassword ──────────────────────────────────────────────────────────

  describe('changePassword()', () => {
    it('should delegate to PasswordResetService and clear cookie', async () => {
      mockPasswordResetService.changePassword.mockResolvedValue({
        message: 'changed', sessionsRevoked: 2,
      });

      const result = await controller.changePassword(
        mockUser,
        { currentPassword: 'Old1!', newPassword: 'New1!' },
        mockReply as any,
      );

      expect(result.message).toBe('changed');
      expect(mockReply.setCookie).toHaveBeenCalled();
    });
  });

  // ── GET /me ─────────────────────────────────────────────────────────────────

  describe('me()', () => {
    it('should delegate to CurrentUserService and return profile', async () => {
      const profile = { id: 'u1', email: 'juan@example.com', firstName: 'Juan' };
      mockCurrentUserService.getCurrentUser.mockResolvedValue(profile);

      const result = await controller.me(mockUser);

      expect(result.id).toBe('u1');
      expect(mockCurrentUserService.getCurrentUser).toHaveBeenCalledWith(mockUser);
    });
  });

  // ── MFA setup ───────────────────────────────────────────────────────────────

  describe('setupMfa()', () => {
    it('should return QR URL, secret, backup codes, and message', async () => {
      mockMfaService.setupMfa.mockResolvedValue({
        qrCodeUrl: 'otpauth://totp/...',
        secret: 'BASE32SECRET',
        backupCodes: Array(8).fill('CODE123456AB'),
      });

      const result = await controller.setupMfa(mockUser);
      expect(result.qrCodeUrl).toBeDefined();
      expect(result.backupCodes).toHaveLength(8);
      expect(result.message).toContain('backup codes');
    });
  });

  // ── MFA verify ──────────────────────────────────────────────────────────────

  describe('verifyMfa()', () => {
    it('should return success message for valid code', async () => {
      mockMfaService.verifyTotp.mockResolvedValue(true);
      const result = await controller.verifyMfa(mockUser, { code: '123456' });
      expect(result.message).toContain('enabled');
    });

    it('should return failure message for invalid code', async () => {
      mockMfaService.verifyTotp.mockResolvedValue(false);
      const result = await controller.verifyMfa(mockUser, { code: '000000' });
      expect(result.message).toContain('Invalid');
    });
  });

  // ── MFA disable ─────────────────────────────────────────────────────────────

  describe('disableMfa()', () => {
    it('should disable MFA for valid code', async () => {
      mockMfaService.verifyTotp.mockResolvedValue(true);
      mockMfaService.disableMfa.mockResolvedValue(undefined);

      const result = await controller.disableMfa(mockUser, { code: '123456' });
      expect(result.message).toContain('disabled');
      expect(mockMfaService.disableMfa).toHaveBeenCalledWith('u1');
    });

    it('should return failure message without calling disableMfa for invalid code', async () => {
      mockMfaService.verifyTotp.mockResolvedValue(false);

      const result = await controller.disableMfa(mockUser, { code: '000000' });
      expect(result.message).toContain('Invalid');
      expect(mockMfaService.disableMfa).not.toHaveBeenCalled();
    });
  });
});
