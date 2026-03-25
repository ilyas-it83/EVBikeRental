// ─── Mock IoT Service ───────────────────────────────
// Simulates communication with bike hardware (unlock/lock).

export function unlockBike(bikeId: string): { success: boolean } {
  console.log(`[iot] Unlocking bike ${bikeId}`);
  return { success: true };
}

export function lockBike(bikeId: string): { success: boolean } {
  console.log(`[iot] Locking bike ${bikeId}`);
  return { success: true };
}
