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
  buyInAmount: number,
  buyInRake: number,
  totalRebuys: number,
  rebuyAmount: number,
  rebuyRake: number,
  addonCount: number,
  addonAmount: number,
  addonRake: number
): number {
  return (
    playerCount * (buyInAmount - buyInRake) +
    totalRebuys * (rebuyAmount - rebuyRake) +
    addonCount * (addonAmount - addonRake)
  );
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

export function calculateTotalRake(
  playerCount: number,
  buyInRake: number,
  totalRebuys: number,
  rebuyRake: number,
  addonCount: number,
  addonRake: number
): number {
  return playerCount * buyInRake + totalRebuys * rebuyRake + addonCount * addonRake;
}

export function calculateAverageStack(
  tournament: { buy_in_chips: number | null; rebuy_chips: number | null; addon_chips: number | null },
  players: { finish_position: number | null; rebuys: number; addon: boolean }[]
): number | null {
  if (tournament.buy_in_chips === null) return null;
  const remaining = players.filter((p) => p.finish_position === null);
  if (remaining.length === 0) return null;
  const totalRebuys = players.reduce((sum, p) => sum + p.rebuys, 0);
  const addonCount = players.filter((p) => p.addon).length;
  const totalChips =
    players.length * tournament.buy_in_chips +
    totalRebuys * (tournament.rebuy_chips ?? 0) +
    addonCount * (tournament.addon_chips ?? 0);
  return Math.floor(totalChips / remaining.length);
}
