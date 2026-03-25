/**
 * IoT Service Unit Tests
 *
 * Tests the mock IoT service for:
 * - unlockBike returns success
 * - lockBike returns success
 * - Both accept any bikeId string
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unlockBike, lockBike } from '../services/iot.service.js';

describe('IoT Service', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('unlockBike', () => {
    it('returns { success: true }', () => {
      expect(unlockBike('bike-001')).toEqual({ success: true });
    });

    it('accepts any bikeId string', () => {
      expect(unlockBike('')).toEqual({ success: true });
      expect(unlockBike('some-uuid-here')).toEqual({ success: true });
      expect(unlockBike('🚲')).toEqual({ success: true });
    });

    it('logs the unlock operation', () => {
      unlockBike('bike-42');
      expect(console.log).toHaveBeenCalledWith('[iot] Unlocking bike bike-42');
    });
  });

  describe('lockBike', () => {
    it('returns { success: true }', () => {
      expect(lockBike('bike-001')).toEqual({ success: true });
    });

    it('accepts any bikeId string', () => {
      expect(lockBike('')).toEqual({ success: true });
      expect(lockBike('arbitrary-id')).toEqual({ success: true });
    });

    it('logs the lock operation', () => {
      lockBike('bike-99');
      expect(console.log).toHaveBeenCalledWith('[iot] Locking bike bike-99');
    });
  });
});
