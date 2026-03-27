import { describe, it, expect } from 'vitest';
import {
  drawSeats,
  autoSeat,
  suggestRebalanceMove,
  suggestTableBreak,
  type SeatingPlayer,
  type SeatingTable,
  type SeatAssignment,
} from '$lib/seating';

// Helper: two tables, 3 seats each
function makeTables(count: number, maxSeats = 3): SeatingTable[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i + 1}`,
    number: i + 1,
    max_seats: maxSeats,
  }));
}

function makePlayers(count: number): SeatingPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    preferred_table: null,
  }));
}

describe('drawSeats', () => {
  it('seats all players with no locks', () => {
    const tables = makeTables(2, 3);
    const players = makePlayers(4);
    const result = drawSeats(players, tables);
    expect(result.error).toBeNull();
    expect(result.assignments).toHaveLength(4);
  });

  it('returns no duplicate seats per table', () => {
    const tables = makeTables(2, 3);
    const players = makePlayers(6);
    const result = drawSeats(players, tables);
    expect(result.error).toBeNull();
    const byTable = new Map<string, number[]>();
    for (const a of result.assignments) {
      if (!byTable.has(a.tableId)) byTable.set(a.tableId, []);
      byTable.get(a.tableId)!.push(a.seatNumber);
    }
    for (const seats of byTable.values()) {
      expect(new Set(seats).size).toBe(seats.length);
    }
  });

  it('assigns locked players to their preferred table', () => {
    const tables = makeTables(2, 3);
    const players: SeatingPlayer[] = [
      { id: 'p1', preferred_table: 1 },
      { id: 'p2', preferred_table: 1 },
      { id: 'p3', preferred_table: null },
      { id: 'p4', preferred_table: null },
    ];
    const result = drawSeats(players, tables);
    expect(result.error).toBeNull();
    const t1 = result.assignments.filter((a) => a.tableId === 't1').map((a) => a.playerId);
    expect(t1).toContain('p1');
    expect(t1).toContain('p2');
  });

  it('returns error when locks exceed table capacity', () => {
    const tables = makeTables(2, 2); // 2 seats each
    const players: SeatingPlayer[] = [
      { id: 'p1', preferred_table: 1 },
      { id: 'p2', preferred_table: 1 },
      { id: 'p3', preferred_table: 1 }, // 3 locked to table with 2 seats
    ];
    const result = drawSeats(players, tables);
    expect(result.error).not.toBeNull();
    expect(result.error).toContain('Table 1');
    expect(result.assignments).toHaveLength(0);
  });

  it('seat numbers are in range 1..max_seats', () => {
    const tables = makeTables(1, 5);
    const players = makePlayers(5);
    const result = drawSeats(players, tables);
    expect(result.error).toBeNull();
    for (const a of result.assignments) {
      expect(a.seatNumber).toBeGreaterThanOrEqual(1);
      expect(a.seatNumber).toBeLessThanOrEqual(5);
    }
  });
});

describe('autoSeat', () => {
  it('assigns all unseated players', () => {
    const tables = makeTables(2, 3);
    const players = makePlayers(4);
    const result = autoSeat(players, tables, []);
    expect(result).toHaveLength(4);
  });

  it('distributes evenly: no table gets more than 1 extra player than another', () => {
    const tables = makeTables(2, 5);
    const players = makePlayers(5);
    const result = autoSeat(players, tables, []);
    const counts = [
      result.filter((a) => a.tableId === 't1').length,
      result.filter((a) => a.tableId === 't2').length,
    ];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('respects existing assignments (does not overfill a table)', () => {
    const tables = makeTables(2, 2);
    // Table 1 already has 2 players seated
    const existing: SeatAssignment[] = [
      { playerId: 'x1', tableId: 't1', seatNumber: 1 },
      { playerId: 'x2', tableId: 't1', seatNumber: 2 },
    ];
    const players = makePlayers(2); // 2 more to seat
    const result = autoSeat(players, tables, existing);
    // Both new players must go to table 2
    expect(result.every((a) => a.tableId === 't2')).toBe(true);
  });

  it('returns no duplicate seats in the new assignments', () => {
    const tables = makeTables(1, 5);
    const players = makePlayers(5);
    const result = autoSeat(players, tables, []);
    const seats = result.map((a) => a.seatNumber);
    expect(new Set(seats).size).toBe(seats.length);
  });
});

describe('suggestRebalanceMove', () => {
  // Helper: build active player list from table assignments
  function ap(id: string, tableId: string, tableNumber: number, seatNumber: number) {
    return { id, name: `Player ${id}`, tableId, tableNumber, seatNumber };
  }

  it('returns null when tables are balanced (difference < 2)', () => {
    const tables = makeTables(2, 5);
    const active = [
      ap('p1', 't1', 1, 1),
      ap('p2', 't1', 1, 2),
      ap('p3', 't2', 2, 1),
    ];
    // t1=2, t2=1 → diff=1, no suggestion needed
    expect(suggestRebalanceMove(active, tables)).toBeNull();
  });

  it('returns a move when difference >= 2', () => {
    const tables = makeTables(2, 5);
    const active = [
      ap('p1', 't1', 1, 1),
      ap('p2', 't1', 1, 2),
      ap('p3', 't1', 1, 3),
      ap('p4', 't2', 2, 1),
    ];
    // t1=3, t2=1 → diff=2, should suggest
    const move = suggestRebalanceMove(active, tables);
    expect(move).not.toBeNull();
    expect(move!.playerId).toBe('p3'); // highest seat on largest table
    expect(move!.toTableNumber).toBe(2);
    expect(move!.toSeatNumber).toBe(2); // lowest empty seat on t2
  });

  it('picks the player with the highest seat number from the largest table', () => {
    const tables = makeTables(2, 5);
    const active = [
      ap('p1', 't1', 1, 1),
      ap('p2', 't1', 1, 4), // highest seat
      ap('p3', 't1', 1, 2),
    ];
    const move = suggestRebalanceMove(active, tables);
    expect(move!.playerId).toBe('p2');
  });

  it('returns null with only one table', () => {
    const tables = makeTables(1, 5);
    const active = [ap('p1', 't1', 1, 1)];
    expect(suggestRebalanceMove(active, tables)).toBeNull();
  });
});

describe('suggestTableBreak', () => {
  function ap(id: string, tableId: string, tableNumber: number, seatNumber: number) {
    return { id, name: `Player ${id}`, tableId, tableNumber, seatNumber };
  }

  it('returns null when no table has exactly 1 active player', () => {
    const tables = makeTables(2, 5);
    const active = [
      ap('p1', 't1', 1, 1),
      ap('p2', 't1', 1, 2),
      ap('p3', 't2', 2, 1),
      ap('p4', 't2', 2, 2),
    ];
    expect(suggestTableBreak(active, tables)).toBeNull();
  });

  it('returns a break move when a table has exactly 1 active player', () => {
    const tables = makeTables(2, 5);
    const active = [
      ap('p1', 't1', 1, 1), // only one left on t1
      ap('p2', 't2', 2, 1),
      ap('p3', 't2', 2, 2),
    ];
    const move = suggestTableBreak(active, tables);
    expect(move).not.toBeNull();
    expect(move!.playerId).toBe('p1');
    expect(move!.fromTableNumber).toBe(1);
    expect(move!.toTableNumber).toBe(2);
    expect(move!.toSeatNumber).toBe(3); // lowest empty on t2
  });

  it('returns null with only one table', () => {
    const tables = makeTables(1, 5);
    const active = [ap('p1', 't1', 1, 1)];
    expect(suggestTableBreak(active, tables)).toBeNull();
  });
});

describe('busted-seat occupancy (regression)', () => {
  function ap(id: string, tableId: string, tableNumber: number, seatNumber: number) {
    return { id, name: `Player ${id}`, tableId, tableNumber, seatNumber };
  }

  it('suggestRebalanceMove treats busted-player seats as available for reassignment', () => {
    const tables = makeTables(2, 3); // 3 seats each
    const active = [
      ap('p1', 't1', 1, 1),
      ap('p2', 't1', 1, 2),
      ap('p3', 't1', 1, 3),
      ap('p4', 't2', 2, 1), // only active player on t2
    ];
    // Busted player's DB record still has seat 2 on t2, but the seat is reassignable
    const move = suggestRebalanceMove(active, tables);
    expect(move).not.toBeNull();
    expect(move!.toSeatNumber).toBe(2); // seat 2 is the first available (busted record ignored)
  });

  it('suggestTableBreak returns a move even when busted players have seats at the target table', () => {
    const tables = makeTables(2, 3);
    const active = [
      ap('p1', 't1', 1, 1), // only active player on t1 — break candidate
      ap('p2', 't2', 2, 1),
      ap('p3', 't2', 2, 2),
    ];
    // Busted player's DB record still occupies seat 3 on t2, but that seat is reassignable
    // t2 active count = 2, max_seats = 3 → room exists at seat 3
    const move = suggestTableBreak(active, tables);
    expect(move).not.toBeNull();
    expect(move!.playerId).toBe('p1');
    expect(move!.toSeatNumber).toBe(3); // first available seat at t2
  });

  it('consolidates 2 remaining players on different tables', () => {
    const tables = makeTables(3, 2); // 3 tables, 2 seats each
    const active = [
      ap('p1', 't1', 1, 1),
      ap('p2', 't2', 2, 1),
    ];
    // t3 has 0 active — both its seats are available regardless of any busted DB records
    const move = suggestTableBreak(active, tables);
    expect(move).not.toBeNull();
    expect(['p1', 'p2']).toContain(move!.playerId);
    expect(move!.toSeatNumber).toBe(1); // first seat on the empty table
  });
});
