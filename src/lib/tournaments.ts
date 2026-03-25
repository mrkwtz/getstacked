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

export function calculatePayouts(
  players: { id: string; finish_position: number | null }[],
  payouts: Payout[], // percentage is a whole number (e.g. 60 = 60%)
  prizePool: number, // cents
): { playerId: string; amount: number }[] {
  // Build a map of finish_position → player id
  const byPosition = new Map<number, string>();
  for (const player of players) {
    if (player.finish_position !== null) {
      byPosition.set(player.finish_position, player.id);
    }
  }

  // Sort payouts ascending by position
  const sorted = [...payouts].sort((a, b) => a.position - b.position);

  // Calculate base amounts for awarded positions
  const amounts = new Map<string, number>();
  let distributed = 0;

  for (const payout of sorted) {
    const playerId = byPosition.get(payout.position);
    if (playerId === undefined) continue; // no player at this position — skip
    const amount = Math.floor((prizePool * payout.percentage) / 100);
    amounts.set(playerId, amount);
    distributed += amount;
  }

  // Add rounding remainder to 1st place — ONLY when all prize positions were awarded.
  // If any position had no player, the unapplied percentage is simply not redistributed.
  const allPositionsFilled = sorted.every((payout) =>
    byPosition.has(payout.position),
  );
  const remainder = prizePool - distributed;
  if (remainder > 0 && allPositionsFilled) {
    const firstPlaceId = byPosition.get(1);
    if (firstPlaceId !== undefined) {
      amounts.set(firstPlaceId, (amounts.get(firstPlaceId) ?? 0) + remainder);
    }
  }

  // Return an entry for every player (paid: their amount, unpaid: 0)
  return players.map((player) => ({
    playerId: player.id,
    amount: amounts.get(player.id) ?? 0,
  }));
}
