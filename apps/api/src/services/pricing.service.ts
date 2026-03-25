// ─── Pricing Constants ──────────────────────────────

const UNLOCK_FEE = 1.0;
const PER_MINUTE_RATE = 0.15;

// ─── Public API ─────────────────────────────────────

export function calculateRideCost(durationMinutes: number): {
  unlockFee: number;
  minuteCharge: number;
  total: number;
} {
  const minuteCharge = Math.round(durationMinutes * PER_MINUTE_RATE * 100) / 100;
  const total = Math.round((UNLOCK_FEE + minuteCharge) * 100) / 100;

  return { unlockFee: UNLOCK_FEE, minuteCharge, total };
}

export function getEstimate(durationMinutes: number): number {
  return calculateRideCost(durationMinutes).total;
}

export function getPricingInfo() {
  return { unlockFee: UNLOCK_FEE, perMinuteRate: PER_MINUTE_RATE };
}
