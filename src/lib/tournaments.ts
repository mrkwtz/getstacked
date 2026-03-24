export interface BlindLevel {
  small_blind: number;
  big_blind: number;
  ante: number;
  duration_minutes: number;
}

export interface Payout {
  position: number;
  percentage: number;
}

export function calculatePrizePool(
  playerCount: number,
  buyIn: number, // cents
  totalRebuys: number,
  rebuyAmount: number, // cents
  addonCount: number,
  addonAmount: number, // cents
): number {
  return (
    playerCount * buyIn + totalRebuys * rebuyAmount + addonCount * addonAmount
  );
}

/**
 * Validates a payouts array.
 * Returns null if valid, or an i18n error key string if invalid.
 */
export function validatePayouts(payouts: Payout[]): string | null {
  if (payouts.some((p) => p.percentage <= 0)) return "error_percentage_sum";
  const positions = payouts.map((p) => p.position);
  if (new Set(positions).size !== positions.length)
    return "error_duplicate_position";
  const sum = payouts.reduce((acc, p) => acc + p.percentage, 0);
  if (sum !== 100) return "error_percentage_sum";
  return null;
}
