// src/lib/seating.ts

export interface SeatingTable {
  id: string;
  number: number;
  max_seats: number;
}

export interface SeatingPlayer {
  id: string;
  preferred_table: number | null;
}

export interface SeatAssignment {
  playerId: string;
  tableId: string;
  seatNumber: number;
}

export interface DrawResult {
  assignments: SeatAssignment[];
  error: string | null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function emptySeats(maxSeats: number, used: Set<number>): number[] {
  return Array.from({ length: maxSeats }, (_, i) => i + 1).filter((s) => !used.has(s));
}

export function drawSeats(players: SeatingPlayer[], tables: SeatingTable[]): DrawResult {
  // Validate locks
  for (const table of tables) {
    const locked = players.filter((p) => p.preferred_table === table.number);
    if (locked.length > table.max_seats) {
      return {
        assignments: [],
        error: `Table ${table.number} has ${locked.length} locks but only ${table.max_seats} seats.`,
      };
    }
  }

  const assignments: SeatAssignment[] = [];
  const used: Map<string, Set<number>> = new Map(tables.map((t) => [t.id, new Set()]));

  // Assign locked players first
  for (const table of tables) {
    const locked = shuffle(players.filter((p) => p.preferred_table === table.number));
    for (const player of locked) {
      const seat = emptySeats(table.max_seats, used.get(table.id)!)[0];
      used.get(table.id)!.add(seat);
      assignments.push({ playerId: player.id, tableId: table.id, seatNumber: seat });
    }
  }

  // Assign remaining players in round-robin (fewest assigned first, tie-break: lowest number)
  const assignedIds = new Set(assignments.map((a) => a.playerId));
  const unlocked = shuffle(players.filter((p) => !assignedIds.has(p.id)));

  for (const player of unlocked) {
    const sorted = [...tables].sort((a, b) => {
      const diff = used.get(a.id)!.size - used.get(b.id)!.size;
      return diff !== 0 ? diff : a.number - b.number;
    });
    for (const table of sorted) {
      const free = emptySeats(table.max_seats, used.get(table.id)!);
      if (free.length === 0) continue;
      used.get(table.id)!.add(free[0]);
      assignments.push({ playerId: player.id, tableId: table.id, seatNumber: free[0] });
      break;
    }
  }

  return { assignments, error: null };
}

export function autoSeat(
  unseated: SeatingPlayer[],
  tables: SeatingTable[],
  existing: SeatAssignment[],
): SeatAssignment[] {
  const used: Map<string, Set<number>> = new Map(tables.map((t) => [t.id, new Set()]));
  for (const a of existing) {
    used.get(a.tableId)?.add(a.seatNumber);
  }

  const assignments: SeatAssignment[] = [];
  for (const player of unseated) {
    const sorted = [...tables].sort((a, b) => {
      const diff = used.get(a.id)!.size - used.get(b.id)!.size;
      return diff !== 0 ? diff : a.number - b.number;
    });
    for (const table of sorted) {
      const free = emptySeats(table.max_seats, used.get(table.id)!);
      if (free.length === 0) continue;
      used.get(table.id)!.add(free[0]);
      assignments.push({ playerId: player.id, tableId: table.id, seatNumber: free[0] });
      break;
    }
  }
  return assignments;
}

export interface ActivePlayer {
  id: string;
  name: string;
  tableId: string;
  tableNumber: number;
  seatNumber: number;
}

export interface RebalanceMove {
  playerId: string;
  playerName: string;
  fromTableNumber: number;
  fromSeatNumber: number;
  toTableId: string;
  toTableNumber: number;
  toSeatNumber: number;
}

export function suggestRebalanceMove(
  active: ActivePlayer[],
  tables: SeatingTable[],
): RebalanceMove | null {
  if (tables.length < 2) return null;

  const count: Map<string, number> = new Map(tables.map((t) => [t.id, 0]));
  for (const p of active) count.set(p.tableId, (count.get(p.tableId) ?? 0) + 1);

  // Only consider tables that are in use — empty tables should not skew the balance check
  const activeTables = tables.filter((t) => (count.get(t.id) ?? 0) > 0);
  if (activeTables.length < 2) return null;

  const activeVals = activeTables.map((t) => count.get(t.id)!);
  if (Math.max(...activeVals) - Math.min(...activeVals) < 2) return null;

  const largest = [...activeTables].sort((a, b) => {
    const diff = (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0);
    return diff !== 0 ? diff : a.number - b.number;
  })[0];

  const smallest = [...activeTables]
    .filter((t) => t.id !== largest.id)
    .sort((a, b) => {
      const diff = (count.get(a.id) ?? 0) - (count.get(b.id) ?? 0);
      return diff !== 0 ? diff : a.number - b.number;
    })[0];

  const player = [...active]
    .filter((p) => p.tableId === largest.id)
    .sort((a, b) => b.seatNumber - a.seatNumber)[0];

  const occupied = new Set(active.filter((p) => p.tableId === smallest.id).map((p) => p.seatNumber));
  const toSeat = emptySeats(smallest.max_seats, occupied)[0];

  if (!player || toSeat === undefined) return null;

  return {
    playerId: player.id,
    playerName: player.name,
    fromTableNumber: player.tableNumber,
    fromSeatNumber: player.seatNumber,
    toTableId: smallest.id,
    toTableNumber: smallest.number,
    toSeatNumber: toSeat,
  };
}

export interface TableBreakMove {
  playerId: string;
  playerName: string;
  fromTableNumber: number;
  toTableId: string;
  toTableNumber: number;
  toSeatNumber: number;
}

export function suggestTableBreak(
  active: ActivePlayer[],
  tables: SeatingTable[],
): TableBreakMove | null {
  if (tables.length < 2) return null;

  const count: Map<string, number> = new Map(tables.map((t) => [t.id, 0]));
  for (const p of active) count.set(p.tableId, (count.get(p.tableId) ?? 0) + 1);

  const breakTable = [...tables]
    .sort((a, b) => a.number - b.number)
    .find((t) => count.get(t.id) === 1);
  if (!breakTable) return null;

  const player = active.find((p) => p.tableId === breakTable.id);
  if (!player) return null;

  const target = [...tables]
    .filter((t) => t.id !== breakTable.id && (count.get(t.id) ?? 0) > 0 && (count.get(t.id) ?? 0) < t.max_seats)
    .sort((a, b) => {
      const diff = (count.get(a.id) ?? 0) - (count.get(b.id) ?? 0);
      return diff !== 0 ? diff : a.number - b.number;
    })[0];

  if (!target) return null;

  const occupied = new Set(active.filter((p) => p.tableId === target.id).map((p) => p.seatNumber));
  const toSeat = emptySeats(target.max_seats, occupied)[0];
  if (toSeat === undefined) return null;

  return {
    playerId: player.id,
    playerName: player.name,
    fromTableNumber: breakTable.number,
    toTableId: target.id,
    toTableNumber: target.number,
    toSeatNumber: toSeat,
  };
}
