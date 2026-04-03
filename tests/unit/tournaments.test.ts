import { describe, it, expect } from 'vitest';
import { validatePayouts, calculatePrizePool, calculatePayouts, formatPrizePoolBreakdown, calculateTotalFees } from '$lib/tournaments';

describe('validatePayouts', () => {
  it('returns error_required for empty array', () => {
    expect(validatePayouts([])).toBe('error_required');
  });

  it('allows 0% for a position when total still sums to 100', () => {
    expect(
      validatePayouts([
        { position: 1, percentage: 0 },
        { position: 2, percentage: 100 },
      ])
    ).toBeNull();
  });

  it('returns error_required if any percentage is negative', () => {
    expect(validatePayouts([{ position: 1, percentage: -5 }])).toBe('error_required');
  });

  it('returns error_required if any percentage is > 100', () => {
    expect(validatePayouts([{ position: 1, percentage: 101 }])).toBe('error_required');
  });

  it('returns error_payouts_must_total_100 if percentages sum to 99', () => {
    expect(
      validatePayouts([
        { position: 1, percentage: 60 },
        { position: 2, percentage: 39 },
      ])
    ).toBe('error_payouts_must_total_100');
  });

  it('returns null for a valid single payout of 100%', () => {
    expect(validatePayouts([{ position: 1, percentage: 100 }])).toBeNull();
  });

  it('returns null for valid payouts summing to 100', () => {
    expect(
      validatePayouts([
        { position: 1, percentage: 60 },
        { position: 2, percentage: 25 },
        { position: 3, percentage: 15 },
      ])
    ).toBeNull();
  });
});

describe('calculatePrizePool', () => {
  it('freezeout: player_count × buy_in only', () => {
    expect(calculatePrizePool(4, 2000, 0, 0, 0, 0)).toBe(8000);
  });

  it('rebuy: adds rebuys and add-ons', () => {
    expect(calculatePrizePool(3, 2000, 2, 2000, 1, 1000)).toBe(
      3 * 2000 + 2 * 2000 + 1 * 1000,
    );
  });

  it('zero players returns 0', () => {
    expect(calculatePrizePool(0, 2000, 0, 0, 0, 0)).toBe(0);
  });

  it('all amounts in cents in, cents out', () => {
    expect(calculatePrizePool(1, 5000, 0, 0, 0, 0)).toBe(5000);
  });

  it('returns correct prize pool for basic arithmetic case', () => {
    // 10 players * 100 buy-in + 3 rebuys * 100 + 2 add-ons * 50
    expect(calculatePrizePool(10, 100, 3, 100, 2, 50)).toBe(1400);
  });

  it('handles no rebuys and no add-ons', () => {
    expect(calculatePrizePool(5, 200, 0, 0, 0, 0)).toBe(1000);
  });
});

describe('calculatePayouts', () => {
  it('maps finish positions to payout amounts correctly', () => {
    const players = [
      { id: 'p1', finish_position: 1 },
      { id: 'p2', finish_position: 2 },
    ];
    const payouts = [
      { position: 1, percentage: 60 },
      { position: 2, percentage: 40 },
    ];
    const result = calculatePayouts(players, payouts, 1000);
    expect(result).toEqual([
      { playerId: 'p1', amount: 600 },
      { playerId: 'p2', amount: 400 },
    ]);
  });

  it('excludes players without a finish_position', () => {
    const players = [
      { id: 'p1', finish_position: 1 },
      { id: 'p2', finish_position: null },
    ];
    const payouts = [{ position: 1, percentage: 100 }];
    const result = calculatePayouts(players, payouts, 500);
    expect(result).toEqual([{ playerId: 'p1', amount: 500 }]);
  });

  it('excludes players whose position has no matching payout entry', () => {
    const players = [
      { id: 'p1', finish_position: 1 },
      { id: 'p2', finish_position: 5 },
    ];
    const payouts = [{ position: 1, percentage: 100 }];
    const result = calculatePayouts(players, payouts, 300);
    expect(result).toEqual([{ playerId: 'p1', amount: 300 }]);
  });

  it('rounds amounts using Math.round', () => {
    const players = [{ id: 'p1', finish_position: 1 }];
    const payouts = [{ position: 1, percentage: 33.33 }];
    const result = calculatePayouts(players, payouts, 100);
    expect(result).toEqual([{ playerId: 'p1', amount: Math.round(100 * (33.33 / 100)) }]);
  });

  it('distributes prize pool with clean percentages (no remainder)', () => {
    const players = [
      { id: 'p1', finish_position: 1 },
      { id: 'p2', finish_position: 2 },
      { id: 'p3', finish_position: 3 },
    ];
    const payouts = [
      { position: 1, percentage: 60 },
      { position: 2, percentage: 30 },
      { position: 3, percentage: 10 },
    ];
    const result = calculatePayouts(players, payouts, 10000);
    expect(result).toEqual(
      expect.arrayContaining([
        { playerId: 'p1', amount: 6000 },
        { playerId: 'p2', amount: 3000 },
        { playerId: 'p3', amount: 1000 },
      ])
    );
  });
});

describe('formatPrizePoolBreakdown', () => {
  it('freezeout: returns only buyin part', () => {
    expect(formatPrizePoolBreakdown(4, 2000, 0, 0, 0, 0)).toEqual([
      { count: 4, amountCents: 2000, type: 'buyin' },
    ]);
  });

  it('with rebuys: appends rebuy part', () => {
    expect(formatPrizePoolBreakdown(4, 2000, 3, 1000, 0, 0)).toEqual([
      { count: 4, amountCents: 2000, type: 'buyin' },
      { count: 3, amountCents: 1000, type: 'rebuy' },
    ]);
  });

  it('with addons: appends addon part', () => {
    expect(formatPrizePoolBreakdown(4, 2000, 0, 0, 2, 500)).toEqual([
      { count: 4, amountCents: 2000, type: 'buyin' },
      { count: 2, amountCents: 500, type: 'addon' },
    ]);
  });

  it('with rebuys and addons: returns all three parts in order', () => {
    expect(formatPrizePoolBreakdown(4, 2000, 3, 1000, 2, 500)).toEqual([
      { count: 4, amountCents: 2000, type: 'buyin' },
      { count: 3, amountCents: 1000, type: 'rebuy' },
      { count: 2, amountCents: 500, type: 'addon' },
    ]);
  });

  it('zero rebuys are omitted even when rebuy amount is set', () => {
    expect(formatPrizePoolBreakdown(4, 2000, 0, 1000, 0, 500)).toEqual([
      { count: 4, amountCents: 2000, type: 'buyin' },
    ]);
  });
});

describe('calculateTotalFees', () => {
  it('calculates fees for buy-in only (freezeout)', () => {
    expect(calculateTotalFees(4, 500, 0, 0, 0, 0)).toBe(2000);
  });

  it('calculates fees for all entry types', () => {
    // 3 players * 500 buy-in fee + 2 rebuys * 300 rebuy fee + 1 addon * 200 addon fee
    expect(calculateTotalFees(3, 500, 2, 300, 1, 200)).toBe(2300);
  });

  it('returns 0 when all fees are 0', () => {
    expect(calculateTotalFees(5, 0, 3, 0, 2, 0)).toBe(0);
  });

  it('returns 0 with zero players', () => {
    expect(calculateTotalFees(0, 500, 0, 300, 0, 200)).toBe(0);
  });

  it('handles fee on buy-in only with rebuys and addons having no fee', () => {
    expect(calculateTotalFees(4, 500, 3, 0, 2, 0)).toBe(2000);
  });
});
