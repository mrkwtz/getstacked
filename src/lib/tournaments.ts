export function validatePayouts(
  payouts: { position: number; percentage: number }[]
): string | null {
  if (payouts.length === 0) return 'error_required';
  for (const payout of payouts) {
    if (payout.percentage < 0 || payout.percentage > 100) return 'error_required';
  }
  const total = payouts.reduce((sum, p) => sum + p.percentage, 0);
  if (Math.round(total) !== 100) return 'error_payouts_must_total_100';
  return null;
}

export function calculatePrizePool(
  playerCount: number,
  buyIn: number,
  totalRebuys: number,
  rebuyAmount: number,
  addonCount: number,
  addonAmount: number
): number {
  return playerCount * buyIn + totalRebuys * rebuyAmount + addonCount * addonAmount;
}

export interface PrizePoolPart {
  count: number;
  amountCents: number;
  type: 'buyin' | 'rebuy' | 'addon';
}

export function formatPrizePoolBreakdown(
  playerCount: number,
  buyIn: number,
  totalRebuys: number,
  rebuyAmount: number,
  addonCount: number,
  addonAmount: number,
): PrizePoolPart[] {
  const parts: PrizePoolPart[] = [{ count: playerCount, amountCents: buyIn, type: 'buyin' }];
  if (totalRebuys > 0) parts.push({ count: totalRebuys, amountCents: rebuyAmount, type: 'rebuy' });
  if (addonCount > 0) parts.push({ count: addonCount, amountCents: addonAmount, type: 'addon' });
  return parts;
}

export function calculatePayouts(
  players: { id: string; finish_position: number | null }[],
  payouts: { position: number; percentage: number }[],
  prizePool: number
): { playerId: string; amount: number }[] {
  const results: { playerId: string; amount: number }[] = [];
  for (const player of players) {
    if (player.finish_position === null) continue;
    const payout = payouts.find((p) => p.position === player.finish_position);
    if (!payout) continue;
    results.push({
      playerId: player.id,
      amount: Math.round(prizePool * (payout.percentage / 100)),
    });
  }
  return results;
}
