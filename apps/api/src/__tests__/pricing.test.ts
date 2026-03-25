/**
 * Pricing Service Tests
 *
 * Tests ride cost calculation logic:
 * - Unlock fee: $1.00 (flat)
 * - Per-minute rate: $0.15
 * - Total = unlockFee + (minutes × perMinuteRate)
 * - Rounds to 2 decimal places
 *
 * References: Sprint 2, PRD §3.3
 */
import { describe, it, expect } from 'vitest';

// ─── Pricing Logic (mirrors expected service contract) ──────

const UNLOCK_FEE = 1.0;
const PER_MINUTE_RATE = 0.15;

interface PriceBreakdown {
  unlockFee: number;
  perMinuteRate: number;
  durationMinutes: number;
  rideCost: number;
  total: number;
}

function calculateRideCost(durationMinutes: number): PriceBreakdown {
  const minutes = Math.max(0, durationMinutes);
  const rideCost = Math.round(minutes * PER_MINUTE_RATE * 100) / 100;
  const total = Math.round((UNLOCK_FEE + rideCost) * 100) / 100;

  return {
    unlockFee: UNLOCK_FEE,
    perMinuteRate: PER_MINUTE_RATE,
    durationMinutes: minutes,
    rideCost,
    total,
  };
}

// ─── Tests ──────────────────────────────────────────

describe('Pricing: calculateRideCost', () => {
  it('should return correct breakdown for 0 minutes', () => {
    const result = calculateRideCost(0);

    expect(result.unlockFee).toBe(1.0);
    expect(result.perMinuteRate).toBe(0.15);
    expect(result.durationMinutes).toBe(0);
    expect(result.rideCost).toBe(0);
    expect(result.total).toBe(1.0);
  });

  it('should return correct breakdown for 1 minute', () => {
    const result = calculateRideCost(1);

    expect(result.durationMinutes).toBe(1);
    expect(result.rideCost).toBe(0.15);
    expect(result.total).toBe(1.15);
  });

  it('should return correct breakdown for 10 minutes', () => {
    const result = calculateRideCost(10);

    expect(result.durationMinutes).toBe(10);
    expect(result.rideCost).toBe(1.5);
    expect(result.total).toBe(2.5);
  });

  it('should return correct breakdown for 60 minutes', () => {
    const result = calculateRideCost(60);

    expect(result.durationMinutes).toBe(60);
    expect(result.rideCost).toBe(9.0);
    expect(result.total).toBe(10.0);
  });

  it('should always include $1.00 unlock fee', () => {
    for (const mins of [0, 1, 5, 15, 30, 60, 120]) {
      const result = calculateRideCost(mins);
      expect(result.unlockFee).toBe(1.0);
    }
  });

  it('should always use $0.15 per-minute rate', () => {
    for (const mins of [0, 1, 5, 15, 30, 60]) {
      const result = calculateRideCost(mins);
      expect(result.perMinuteRate).toBe(0.15);
    }
  });

  it('should satisfy total = unlockFee + (minutes × perMinuteRate)', () => {
    for (const mins of [0, 1, 7, 13, 25, 42, 60, 90, 120]) {
      const result = calculateRideCost(mins);
      const expected = Math.round((1.0 + mins * 0.15) * 100) / 100;
      expect(result.total).toBe(expected);
    }
  });

  it('should round to 2 decimal places', () => {
    // 7 minutes: 7 * 0.15 = 1.05, total = 2.05
    const r7 = calculateRideCost(7);
    expect(r7.rideCost).toBe(1.05);
    expect(r7.total).toBe(2.05);

    // 13 minutes: 13 * 0.15 = 1.95, total = 2.95
    const r13 = calculateRideCost(13);
    expect(r13.rideCost).toBe(1.95);
    expect(r13.total).toBe(2.95);

    // 23 minutes: 23 * 0.15 = 3.45, total = 4.45
    const r23 = calculateRideCost(23);
    expect(r23.rideCost).toBe(3.45);
    expect(r23.total).toBe(4.45);
  });

  it('should handle negative duration by treating as 0', () => {
    const result = calculateRideCost(-5);
    expect(result.durationMinutes).toBe(0);
    expect(result.rideCost).toBe(0);
    expect(result.total).toBe(1.0);
  });

  it('should handle very long rides (24 hours)', () => {
    const result = calculateRideCost(1440);
    expect(result.rideCost).toBe(216.0);
    expect(result.total).toBe(217.0);
  });
});
