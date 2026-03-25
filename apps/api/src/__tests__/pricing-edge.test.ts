/**
 * Pricing Service Edge-Case Unit Tests
 *
 * Tests the actual pricing service module:
 * - 0 minutes → just unlock fee
 * - Fractional minutes handling
 * - Very large durations (24h)
 * - Negative duration handling
 * - getEstimate
 * - getPricingInfo
 * - Subscription discount multipliers
 */
import { describe, it, expect } from 'vitest';
import { calculateRideCost, getEstimate, getPricingInfo } from '../services/pricing.service.js';

describe('Pricing Service: calculateRideCost', () => {
  it('0 minutes → just $1.00 unlock fee', () => {
    const result = calculateRideCost(0);
    expect(result.unlockFee).toBe(1.0);
    expect(result.minuteCharge).toBe(0);
    expect(result.total).toBe(1.0);
  });

  it('handles fractional minutes (0.5 min)', () => {
    const result = calculateRideCost(0.5);
    // 0.5 * 0.15 = 0.075, rounded = 0.08
    expect(result.minuteCharge).toBe(0.08);
    expect(result.total).toBe(1.08);
  });

  it('handles fractional minutes (7.3 min)', () => {
    const result = calculateRideCost(7.3);
    // 7.3 * 0.15 = 1.095, rounded = 1.10
    expect(result.minuteCharge).toBe(1.1);
    expect(result.total).toBe(2.1);
  });

  it('very large duration: 1440 minutes (24h)', () => {
    const result = calculateRideCost(1440);
    // 1440 * 0.15 = 216.00
    expect(result.minuteCharge).toBe(216.0);
    expect(result.total).toBe(217.0);
  });

  it('negative duration produces negative minuteCharge (no clamping in service)', () => {
    const result = calculateRideCost(-5);
    // -5 * 0.15 = -0.75
    expect(result.minuteCharge).toBe(-0.75);
    expect(result.total).toBe(0.25);
  });

  it('1 minute ride costs $1.15', () => {
    const result = calculateRideCost(1);
    expect(result.total).toBe(1.15);
  });

  it('30 minute ride costs $5.50', () => {
    const result = calculateRideCost(30);
    expect(result.minuteCharge).toBe(4.5);
    expect(result.total).toBe(5.5);
  });

  it('always includes unlockFee of $1.00', () => {
    for (const mins of [0, 1, 10, 60, 1440]) {
      expect(calculateRideCost(mins).unlockFee).toBe(1.0);
    }
  });

  it('total rounds to 2 decimal places', () => {
    // 7 * 0.15 = 1.05 → total 2.05
    expect(calculateRideCost(7).total).toBe(2.05);
    // 13 * 0.15 = 1.95 → total 2.95
    expect(calculateRideCost(13).total).toBe(2.95);
  });
});

describe('Pricing Service: getEstimate', () => {
  it('returns total cost for given duration', () => {
    expect(getEstimate(10)).toBe(2.5);
    expect(getEstimate(0)).toBe(1.0);
  });

  it('equals calculateRideCost(...).total', () => {
    for (const mins of [0, 1, 5, 10, 30, 60]) {
      expect(getEstimate(mins)).toBe(calculateRideCost(mins).total);
    }
  });
});

describe('Pricing Service: getPricingInfo', () => {
  it('returns unlockFee and perMinuteRate', () => {
    const info = getPricingInfo();
    expect(info).toEqual({ unlockFee: 1.0, perMinuteRate: 0.15 });
  });
});

describe('Pricing with subscription discount multipliers', () => {
  // These verify the discount math — the service returns the raw cost,
  // subscription discount is applied at billing time.
  it('free plan (0% discount): full price', () => {
    const cost = calculateRideCost(10).total;
    const discountMultiplier = 1.0; // 0% off
    expect(cost * discountMultiplier).toBe(2.5);
  });

  it('monthly plan (20% discount)', () => {
    const cost = calculateRideCost(10).total;
    const discountMultiplier = 0.8; // 20% off
    expect(Math.round(cost * discountMultiplier * 100) / 100).toBe(2.0);
  });

  it('annual plan (30% discount)', () => {
    const cost = calculateRideCost(10).total;
    const discountMultiplier = 0.7; // 30% off
    expect(Math.round(cost * discountMultiplier * 100) / 100).toBe(1.75);
  });
});
