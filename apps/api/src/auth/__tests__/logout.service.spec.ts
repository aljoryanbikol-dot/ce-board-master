/**
 * @file logout.service.spec.ts
 * @module Auth/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogoutService } from '../services/logout.service';

const mockTokenService = {
  revokeRefreshToken:  vi.fn().mockResolvedValue(undefined),
  revokeAllUserTokens: vi.fn().mockResolvedValue(4),
};

const mockUser = {
  id: 'user-001', email: 'juan@example.com', role: 'subscriber', subscriptionTier: 'pro',
} as const;

describe('LogoutService', () => {
  let service: LogoutService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LogoutService(mockTokenService as any);
  });

  describe('logoutCurrentDevice()', () => {
    it('should revoke the provided refresh token', async () => {
      await service.logoutCurrentDevice('raw-refresh-token', mockUser);
      expect(mockTokenService.revokeRefreshToken).toHaveBeenCalledWith('raw-refresh-token');
    });

    it('should handle missing refresh token gracefully (idempotent)', async () => {
      await expect(
        service.logoutCurrentDevice(undefined, mockUser),
      ).resolves.not.toThrow();
      expect(mockTokenService.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('logoutAllDevices()', () => {
    it('should revoke all sessions and return count', async () => {
      const result = await service.logoutAllDevices(mockUser);
      expect(result.sessionsRevoked).toBe(4);
      expect(mockTokenService.revokeAllUserTokens).toHaveBeenCalledWith('user-001');
    });
  });
});
