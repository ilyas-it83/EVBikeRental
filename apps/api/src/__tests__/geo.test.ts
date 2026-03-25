/**
 * Geo Utility Unit Tests
 *
 * Tests the haversine distance formula for:
 * - Same point → 0
 * - Known NYC landmarks distance
 * - Antipodal points (max distance)
 * - Negative coordinates
 * - Equator crossing
 */
import { describe, it, expect } from 'vitest';
import { haversineDistance } from '../utils/geo.js';

describe('haversineDistance', () => {
  it('returns 0 for the same point', () => {
    expect(haversineDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it('returns 0 for identical coordinates at the equator', () => {
    expect(haversineDistance(0, 0, 0, 0)).toBe(0);
  });

  it('calculates known distance between NYC landmarks (Central Park ↔ Times Square)', () => {
    const distance = haversineDistance(40.785091, -73.968285, 40.758896, -73.98513);
    // ~3.1 km
    expect(distance).toBeGreaterThan(2.5);
    expect(distance).toBeLessThan(4.0);
  });

  it('calculates known distance between Statue of Liberty and Empire State Building', () => {
    // ~8.3 km
    const distance = haversineDistance(40.6892, -74.0445, 40.7484, -73.9857);
    expect(distance).toBeGreaterThan(7);
    expect(distance).toBeLessThan(10);
  });

  it('calculates antipodal points (maximum distance ~20015 km)', () => {
    // North Pole to South Pole = ~20015 km (half circumference)
    const distance = haversineDistance(90, 0, -90, 0);
    expect(distance).toBeGreaterThan(20000);
    expect(distance).toBeLessThan(20100);
  });

  it('handles negative coordinates (Southern / Western hemispheres)', () => {
    // Buenos Aires (-34.6, -58.4) to Sydney (-33.9, 151.2) ~11800 km
    const distance = haversineDistance(-34.6037, -58.3816, -33.8688, 151.2093);
    expect(distance).toBeGreaterThan(11500);
    expect(distance).toBeLessThan(12100);
  });

  it('handles equator crossing', () => {
    // Point just north of equator to point just south
    const distance = haversineDistance(1, 0, -1, 0);
    // ~222 km (2 degrees of latitude ≈ 222 km)
    expect(distance).toBeGreaterThan(220);
    expect(distance).toBeLessThan(225);
  });

  it('is symmetric: distance(A,B) === distance(B,A)', () => {
    const d1 = haversineDistance(40.7128, -74.006, 51.5074, -0.1278);
    const d2 = haversineDistance(51.5074, -0.1278, 40.7128, -74.006);
    expect(d1).toBeCloseTo(d2, 10);
  });

  it('handles 180th meridian crossing', () => {
    const distance = haversineDistance(0, 179, 0, -179);
    // 2 degrees at equator ≈ 222 km
    expect(distance).toBeGreaterThan(220);
    expect(distance).toBeLessThan(225);
  });
});
