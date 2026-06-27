/**
 * @file lockout.service.spec.ts
 * @module Auth/Tests
 *
 * Unit tests for LockoutService.
 * Verifies Redis-backed counter logic, threshold detection, and reset.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LockoutService } from '../services/lockout.service';
import { AUTH } from '../../common/constants';

const mockCache = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
};

describe('LockoutService', () => {
  let service: LockoutService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LockoutService(mockCache as any);
  });

  describe('getLockoutStatus()', () => {
    it('should return not locked when failure count is below threshold', async () => {
      mockCache.get.mockResolvedValue(3); // 3 failures — below 5 threshold

      const status = await service.getLockoutStatus('user-01', '1.2.3.4');
      expect(status.isLocked).toBe(false);
      expect(status.failureCount).toBe(3);
    });

    it('should return locked when failure count meets threshold', async () => {
      mockCache.get.mockResolvedValue(AUTH.MAX_FAILED_ATTEMPTS); // exactly 5

      const status = await service.getLockoutStatus('user-01', '1.2.3.4');
      expect(status.isLocked).toBe(true);
      expect(status.remainingSeconds).toBeGreaterThan(0);
    });

    it('should return not locked when cache returns null (no failures)', async () => {
      mockCache.get.mockResolvedValue(null);

      const status = await service.getLockoutStatus('user-01', '1.2.3.4');
      expect(status.isLocked).toBe(false);
      expect(status.failureCount).toBe(0);
    });
  });

  describe('recordFailure()', () => {
    it('should increment counters on failure', async () => {
      mockCache.get.mockResolvedValue(1); // previous count

      await service.recordFailure('user-01', '1.2.3.4');

      // Should call set for both user and IP counters
      expect(mockCache.set).toHaveBeenCalledTimes(2);
    });

    it('should return true when threshold is reached', async () => {
      // Return value that when incremented hits the threshold
      mockCache.get.mockResolvedValue(AUTH.MAX_FAILED_ATTEMPTS - 1);

      const isLocked = await service.recordFailure('user-01', '1.2.3.4');
      expect(isLocked).toBe(true);
    });
  });

  describe('clearLockout()', () => {
    it('should delete the user lockout key', async () => {
      await service.clearLockout('user-01');
      expect(mockCache.del).toHaveBeenCalledWith(`auth:lockout:user-01`);
    });
  });
});
