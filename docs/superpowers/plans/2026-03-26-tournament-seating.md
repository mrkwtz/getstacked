# Tournament Seating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add table and seat management to tournament administration — random draw with optional table locks, auto-seating, and system-suggested rebalancing as players bust out.

**Architecture:** New `tournament_tables` DB table stores per-table metadata (number, max_seats, dealer). `tournament_players` gains three nullable columns: `table_id`, `seat_number`, `preferred_table`. All seating logic (draw, auto-seat, rebalancing) is pure functions in `src/lib/seating.ts` tested with Vitest. The tournament detail page (`+page.svelte`) gains a Seating section that is separate for registration (configure/draw) and running (grid/rebalance) phases.

**Tech Stack:** SvelteKit universal loads, Supabase (client-side mutations via `createClient()`), Svelte 5 runes (`$state`, `$derived`, `$props`), Vitest, Paraglide i18n

---

## File Map

| File | Role |
|------|------|
| `supabase/migrations/0007_tournament_seating.sql` | Schema: new table + altered columns + RLS |
| `messages/en.json` | New seating i18n keys (English) |
| `messages/de.json` | New seating i18n keys (German) |
| `src/lib/types.ts` | `tournament_tables` Database type; `TournamentTable` interface; extend `TournamentPlayer` |
| `src/lib/seating.ts` | Pure functions: `drawSeats`, `autoSeat`, `suggestRebalanceMove`, `suggestTableBreak` |
| `tests/unit/seating.test.ts` | TDD tests for all seating functions |
| `src/routes/[club]/admin/tournaments/[id]/+page.ts` | Add `tournament_tables` parallel query |
| `src/routes/[club]/admin/tournaments/[id]/+page.svelte` | Seating section (registration + running) |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/0007_tournament_seating.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/0007_tournament_seating.sql

create table tournament_tables (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  number        integer not null,
  max_seats     integer not null,
  dealer        text,
  created_at    timestamptz not null default now(),
  unique (tournament_id, number)
);

alter table tournament_players
  add column table_id        uuid references tournament_tables(id) on delete set null,
  add column seat_number     integer,
  add column preferred_table integer;

alter table tournament_tables enable row level security;

create policy "members can read tournament tables"
  on tournament_tables for select
  using (
    tournament_id in (
      select id from tournaments
      where club_id in (select get_user_club_ids(auth.uid()))
    )
  );

create policy "admins can manage tournament tables"
  on tournament_tables for all
  using (
    tournament_id in (
      select id from tournaments
      where is_club_admin(auth.uid(), club_id)
    )
  );
```

- [ ] **Step 2: Verify migration file exists**

```bash
ls supabase/migrations/0007_tournament_seating.sql
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_tournament_seating.sql
git commit -m "feat: add tournament_tables migration and seat columns on tournament_players"
```

---

## Task 2: Types and i18n Keys

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Add `tournament_tables` to Database type in `src/lib/types.ts`**

Insert the following entry into `Database['public']['Tables']`, after the `tournament_players` entry (before the closing `}` of `Tables:`):

```ts
      tournament_tables: {
        Row: {
          id: string
          tournament_id: string
          number: number
          max_seats: number
          dealer: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          number: number
          max_seats: number
          dealer?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          number?: number
          max_seats?: number
          dealer?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_tables_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
```

Also add the three new nullable columns to `tournament_players`:

In `tournament_players.Row`, add after `payout_amount`:
```ts
          table_id: string | null
          seat_number: number | null
          preferred_table: number | null
```

In `tournament_players.Insert`, add after `payout_amount`:
```ts
          table_id?: string | null
          seat_number?: number | null
          preferred_table?: number | null
```

In `tournament_players.Update`, add after `payout_amount`:
```ts
          table_id?: string | null
          seat_number?: number | null
          preferred_table?: number | null
```

Also add the FK relationship to `tournament_tables` in `tournament_players.Relationships`:
```ts
          {
            foreignKeyName: "tournament_players_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tournament_tables"
            referencedColumns: ["id"]
          },
```

- [ ] **Step 2: Add hand-written interfaces at the bottom of `src/lib/types.ts`**

Add before the final blank line:

```ts
export interface TournamentTable {
  id: string;
  tournament_id: string;
  number: number;
  max_seats: number;
  dealer: string | null;
  created_at: string;
}
```

Also extend `TournamentPlayer` — add these fields inside the existing `TournamentPlayer` interface (after `club_members?`):

```ts
  table_id: string | null;
  seat_number: number | null;
  preferred_table: number | null;
  tournament_tables?: { number: number; max_seats: number } | null;
```

- [ ] **Step 3: Add i18n keys to `messages/en.json`**

Add the following keys (order doesn't matter, place near the other `tournament_` keys):

```json
"seating_title": "Seating",
"seating_tables_label": "Tables",
"seating_seats_per_table_label": "Seats / table",
"seating_set_tables_button": "Set tables",
"seating_reset_warning": "This will reset all seat assignments and locks.",
"seating_confirm_reset_button": "Confirm reset",
"seating_lock_label": "Lock to table",
"seating_lock_any": "Any",
"seating_draw_button": "Draw seats",
"seating_redraw_button": "Re-draw",
"seating_auto_seat_button": "Auto-Seat",
"seating_unseated_title": "Unseated players",
"seating_dealer_label": "Dealer",
"seating_confirm_move_button": "Confirm",
"seating_dismiss_button": "Dismiss",
"seating_error_lock_overflow": "Table {table} has {locks} locks but only {seats} seats.",
"seating_error_seat_taken": "Seat {seat} at Table {table} is already taken.",
"seating_active_count": "{count} active",
"seating_table_label": "Table {number}",
"seating_assign_seat_placeholder": "Assign seat…",
"seating_error_invalid_config": "Please enter a valid number of tables and seats."
```

- [ ] **Step 4: Add i18n keys to `messages/de.json`**

```json
"seating_title": "Sitzordnung",
"seating_tables_label": "Tische",
"seating_seats_per_table_label": "Plätze / Tisch",
"seating_set_tables_button": "Tische festlegen",
"seating_reset_warning": "Alle Platzzuweisungen und Sperren werden zurückgesetzt.",
"seating_confirm_reset_button": "Zurücksetzen bestätigen",
"seating_lock_label": "Tisch zuweisen",
"seating_lock_any": "Beliebig",
"seating_draw_button": "Plätze auslosen",
"seating_redraw_button": "Neu auslosen",
"seating_auto_seat_button": "Auto-Sitz",
"seating_unseated_title": "Nicht platzierte Spieler",
"seating_dealer_label": "Dealer",
"seating_confirm_move_button": "Bestätigen",
"seating_dismiss_button": "Verwerfen",
"seating_error_lock_overflow": "Tisch {table} hat {locks} Sperren, aber nur {seats} Plätze.",
"seating_error_seat_taken": "Platz {seat} an Tisch {table} ist bereits belegt.",
"seating_active_count": "{count} aktiv",
"seating_table_label": "Tisch {number}",
"seating_assign_seat_placeholder": "Platz zuweisen…",
"seating_error_invalid_config": "Bitte gültige Anzahl von Tischen und Plätzen eingeben."
```

- [ ] **Step 5: Run the TypeScript type check**

```bash
npx tsc --noEmit 2>&1 | grep -v "ui/badge\|ui/button"
```

Expected: no output (no errors).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts messages/en.json messages/de.json
git commit -m "feat: add tournament_tables type, extend TournamentPlayer, add seating i18n keys"
```

---

## Task 3: Seating Utility Functions (TDD)

**Files:**
- Create: `src/lib/seating.ts`
- Create: `tests/unit/seating.test.ts`

### Background for the implementer

`drawSeats` assigns all players to random seats respecting `preferred_table` locks. `autoSeat` fills only unseated players into remaining space. `suggestRebalanceMove` finds a player to move when tables are uneven (≥2 difference). `suggestTableBreak` suggests moving the last player off a dying table.

All four are pure functions with no side effects. `drawSeats` and `autoSeat` use `Math.random` internally for shuffling — tests should mock it or verify structural properties (total count, no duplicates) rather than exact assignment order.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/seating.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|Cannot find|seating"
```

Expected: FAIL — `Cannot find module '$lib/seating'`

- [ ] **Step 3: Implement `src/lib/seating.ts`**

```ts
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

  const vals = [...count.values()];
  if (Math.max(...vals) - Math.min(...vals) < 2) return null;

  const largest = [...tables].sort((a, b) => {
    const diff = (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0);
    return diff !== 0 ? diff : a.number - b.number;
  })[0];

  const smallest = [...tables]
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

  const player = active.find((p) => p.tableId === breakTable.id)!;

  const target = [...tables]
    .filter((t) => t.id !== breakTable.id && (count.get(t.id) ?? 0) < t.max_seats)
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test 2>&1 | tail -8
```

Expected:
```
Test Files  5 passed (5)
Tests       XX passed (XX)
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/seating.ts tests/unit/seating.test.ts
git commit -m "feat: add seating utility functions with TDD (drawSeats, autoSeat, suggestRebalanceMove, suggestTableBreak)"
```

---

## Task 4: Extend Page Load

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.ts`

The current load returns `{ tournament, players, availableMembers, prizePool, prizeStructure }`. We add a parallel query for `tournament_tables`.

- [ ] **Step 1: Replace the `Promise.all` in `+page.ts`**

Find the existing `Promise.all` block:
```ts
  const [{ data: players }, { data: members }] = await Promise.all([
```

Replace the entire `Promise.all` and everything that follows up to (but not including) `return`) with:

```ts
  const [{ data: players }, { data: members }, { data: tables }] = await Promise.all([
    supabase
      .from('tournament_players')
      .select('*, club_members!tournament_players_member_club_id_member_user_id_fkey(display_name)')
      .eq('tournament_id', params.id)
      .order('created_at'),
    supabase
      .from('club_members')
      .select('user_id, display_name')
      .eq('club_id', club.id)
      .order('display_name'),
    supabase
      .from('tournament_tables')
      .select('*')
      .eq('tournament_id', params.id)
      .order('number'),
  ]);

  const allPlayers = players ?? [];
  const registeredIds = new Set(allPlayers.map((p) => p.member_user_id).filter(Boolean));
  const availableMembers = (members ?? []).filter((m) => !registeredIds.has(m.user_id));

  const totalRebuys = allPlayers.reduce((sum, p) => sum + p.rebuys, 0);
  const addonCount = allPlayers.filter((p) => p.addon).length;
  const prizePool = calculatePrizePool(
    allPlayers.length,
    tournament.buy_in,
    totalRebuys,
    tournament.rebuy_amount ?? 0,
    addonCount,
    tournament.addon_amount ?? 0,
  );

  const prizeStructure = tournament.prize_structures
    ? { payouts: tournament.prize_structures.payouts as { position: number; percentage: number }[] }
    : null;

  return { tournament, players: allPlayers, availableMembers, prizePool, prizeStructure, tables: tables ?? [] };
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
npx tsc --noEmit 2>&1 | grep -v "ui/badge\|ui/button"
```

Expected: no output.

- [ ] **Step 3: Run tests**

```bash
npm test 2>&1 | tail -5
```

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/[club]/admin/tournaments/[id]/+page.ts"
git commit -m "feat: load tournament_tables in tournament detail page load"
```

---

## Task 5: Registration Seating UI

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte`

This task adds the Seating section visible during the **registration** phase: configure tables, lock players to tables, draw seats, re-draw, and auto-seat unseated players.

### Context for this file

The page uses Svelte 5 runes. `data` is passed in via `$props()`. Handlers use `createClient()` from `$lib/supabase` and call `invalidateAll()` after mutations. All handlers follow the `if (loading) return; loading = true; try { ... } finally { loading = false; }` pattern. Error messages are looked up in i18n via a `resolveError(key)` helper that already exists in the file.

- [ ] **Step 1: Add seating imports and state to the script block**

At the top of the `<script lang="ts">` block, add these imports after the existing imports:

```ts
  import { drawSeats, autoSeat, suggestRebalanceMove, suggestTableBreak } from '$lib/seating';
  import type { TournamentTable } from '$lib/types';
```

Add these reactive state declarations after the existing `$state` declarations (near `let loading`, etc.):

```ts
  // Seating state
  let numTables = $state('');
  let seatsPerTable = $state('');
  let seatingError = $state<string | null>(null);
  let confirmReset = $state(false);
  let dismissedSuggestion = $state(false);
```

- [ ] **Step 2: Add seating handler functions to the script block**

Add these handler functions before the closing `</script>` tag:

```ts
  // --- Seating handlers ---

  async function handleSetTables(e: SubmitEvent) {
    e.preventDefault();
    if (loading) return;
    const n = parseInt(numTables);
    const s = parseInt(seatsPerTable);
    if (!n || n < 1 || !s || s < 1) { seatingError = m.seating_error_invalid_config(); return; }

    if (data.tables.length > 0) {
      if (!confirmReset) { confirmReset = true; return; }
    }

    loading = true;
    seatingError = null;
    confirmReset = false;
    try {
      const supabase = createClient();
      // Delete existing tables (cascades to clear table_id/seat_number on players)
      if (data.tables.length > 0) {
        await supabase.from('tournament_tables').delete().eq('tournament_id', data.tournament.id);
        // Clear preferred_table on all players
        await supabase
          .from('tournament_players')
          .update({ preferred_table: null })
          .eq('tournament_id', data.tournament.id);
      }
      // Insert new tables
      const rows = Array.from({ length: n }, (_, i) => ({
        tournament_id: data.tournament.id,
        number: i + 1,
        max_seats: s,
      }));
      const { error } = await supabase.from('tournament_tables').insert(rows);
      if (error) { seatingError = error.message; return; }
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleSetLock(playerId: string, preferredTable: number | null) {
    if (loading) return;
    const supabase = createClient();
    await supabase
      .from('tournament_players')
      .update({ preferred_table: preferredTable })
      .eq('id', playerId);
    await invalidateAll();
  }

  async function handleDrawSeats() {
    if (loading) return;
    seatingError = null;
    const players = data.players.map((p) => ({ id: p.id, preferred_table: p.preferred_table ?? null }));
    const tables = data.tables.map((t) => ({ id: t.id, number: t.number, max_seats: t.max_seats }));
    const result = drawSeats(players, tables);
    if (result.error) { seatingError = result.error; return; } // result.error is a pre-formatted English string from drawSeats

    loading = true;
    try {
      const supabase = createClient();
      // Reset all seats first
      await supabase
        .from('tournament_players')
        .update({ table_id: null, seat_number: null })
        .eq('tournament_id', data.tournament.id);
      // Apply assignments
      await Promise.all(
        result.assignments.map((a) =>
          supabase
            .from('tournament_players')
            .update({ table_id: a.tableId, seat_number: a.seatNumber })
            .eq('id', a.playerId),
        ),
      );
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleAutoSeat() {
    if (loading) return;
    seatingError = null;
    const unseated = data.players
      .filter((p) => p.table_id === null)
      .map((p) => ({ id: p.id, preferred_table: p.preferred_table ?? null }));
    const tables = data.tables.map((t) => ({ id: t.id, number: t.number, max_seats: t.max_seats }));
    const existing = data.players
      .filter((p) => p.table_id !== null)
      .map((p) => ({ playerId: p.id, tableId: p.table_id!, seatNumber: p.seat_number! }));
    const assignments = autoSeat(unseated, tables, existing);

    loading = true;
    try {
      const supabase = createClient();
      await Promise.all(
        assignments.map((a) =>
          supabase
            .from('tournament_players')
            .update({ table_id: a.tableId, seat_number: a.seatNumber })
            .eq('id', a.playerId),
        ),
      );
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleManualSeat(playerId: string, tableId: string, seatNumber: number) {
    if (loading) return;
    seatingError = null;
    // Check seat not already taken
    const taken = data.players.some(
      (p) => p.table_id === tableId && p.seat_number === seatNumber && p.id !== playerId,
    );
    if (taken) {
      const tNum = data.tables.find((t) => t.id === tableId)?.number ?? '?';
      seatingError = m.seating_error_seat_taken({ seat: String(seatNumber), table: String(tNum) });
      return;
    }
    loading = true;
    try {
      const supabase = createClient();
      await supabase
        .from('tournament_players')
        .update({ table_id: tableId, seat_number: seatNumber })
        .eq('id', playerId);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
```

- [ ] **Step 3: Add the registration Seating section to the template**

Find the section in the template where registration-phase content ends (after the player list / "Start tournament" button area). Add this block after the player list section but before the "Start tournament" button:

```svelte
  {#if t.status === 'registration'}
    <!-- ── Seating configuration ── -->
    <div class="flex flex-col gap-4">
      <h2 class="text-sm font-semibold text-foreground">{m.seating_title()}</h2>

      <!-- Configure tables form -->
      <form onsubmit={handleSetTables} class="flex gap-2 items-end">
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.seating_tables_label()}</label>
          <input
            type="number" min="1" required bind:value={numTables}
            class="w-20 px-2 py-1.5 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.seating_seats_per_table_label()}</label>
          <input
            type="number" min="1" required bind:value={seatsPerTable}
            class="w-20 px-2 py-1.5 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent"
          />
        </div>
        {#if confirmReset}
          <div class="flex flex-col gap-1">
            <p class="text-xs text-accent">{m.seating_reset_warning()}</p>
            <button type="submit" disabled={loading}
              class="self-start bg-accent text-accent-foreground text-xs font-medium px-3 py-1.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50">
              {m.seating_confirm_reset_button()}
            </button>
          </div>
        {:else}
          <button type="submit" disabled={loading}
            class="bg-accent text-accent-foreground text-sm font-medium px-3 py-1.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50">
            {m.seating_set_tables_button()}
          </button>
        {/if}
      </form>

      {#if seatingError}
        <p class="text-xs text-accent">{seatingError}</p>
      {/if}

      {#if data.tables.length > 0}
        <!-- Per-player lock dropdowns -->
        {#if data.players.length > 0}
          <div class="bg-card border border-border rounded-lg overflow-hidden">
            <div class="grid grid-cols-[1fr_auto] text-xs font-medium text-muted-foreground px-4 py-2 border-b border-border uppercase tracking-wide">
              <span>Player</span><span>{m.seating_lock_label()}</span>
            </div>
            {#each data.players as player}
              <div class="grid grid-cols-[1fr_auto] items-center px-4 py-2 border-b border-border last:border-0">
                <span class="text-sm text-foreground">
                  {player.club_members?.display_name ?? player.guest_name ?? '—'}
                </span>
                <select
                  class="bg-background border border-input rounded-md text-xs px-2 py-1 text-foreground"
                  value={player.preferred_table ?? ''}
                  onchange={(e) => {
                    const val = (e.currentTarget as HTMLSelectElement).value;
                    handleSetLock(player.id, val ? parseInt(val) : null);
                  }}
                >
                  <option value="">{m.seating_lock_any()}</option>
                  {#each data.tables as table}
                    <option value={table.number}>{m.seating_table_label({ number: String(table.number) })}</option>
                  {/each}
                </select>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Draw / re-draw button -->
        <div class="flex gap-2">
          <button
            type="button"
            disabled={loading || data.players.length < 2}
            onclick={handleDrawSeats}
            class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
          >
            {data.players.some(p => p.table_id !== null) ? m.seating_redraw_button() : m.seating_draw_button()}
          </button>
        </div>

        <!-- Seating grid (after draw) -->
        {#if data.players.some((p) => p.table_id !== null)}
          <div class="grid grid-cols-2 gap-3">
            {#each data.tables as table}
              {@const seated = data.players.filter((p) => p.table_id === table.id).sort((a, b) => (a.seat_number ?? 0) - (b.seat_number ?? 0))}
              <div class="bg-card border border-border rounded-lg p-3">
                <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {m.seating_table_label({ number: String(table.number) })}
                </div>
                <div class="grid grid-cols-2 gap-1.5 text-xs">
                  {#each Array.from({ length: table.max_seats }, (_, i) => i + 1) as seat}
                    {@const player = seated.find((p) => p.seat_number === seat)}
                    <div class="px-2 py-1 rounded {player ? 'bg-accent/20 text-foreground' : 'bg-muted text-muted-foreground'}">
                      {seat} {player ? (player.club_members?.display_name ?? player.guest_name ?? '?') : '—'}
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>

          <!-- Unseated players -->
          {@const unseated = data.players.filter((p) => p.table_id === null)}
          {#if unseated.length > 0}
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{m.seating_unseated_title()}</h3>
                <button
                  type="button"
                  onclick={handleAutoSeat}
                  disabled={loading}
                  class="text-xs bg-accent text-accent-foreground px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {m.seating_auto_seat_button()}
                </button>
              </div>
              {#each unseated as player}
                <div class="flex items-center gap-2 text-sm text-foreground">
                  <span class="flex-1">{player.club_members?.display_name ?? player.guest_name ?? '?'}</span>
                  <select
                    class="bg-background border border-input rounded-md text-xs px-2 py-1"
                    onchange={(e) => {
                      const [tableId, seatStr] = (e.currentTarget as HTMLSelectElement).value.split(':');
                      if (tableId && seatStr) handleManualSeat(player.id, tableId, parseInt(seatStr));
                    }}
                  >
                    <option value="">{m.seating_assign_seat_placeholder()}</option>
                    {#each data.tables as table}
                      {#each Array.from({ length: table.max_seats }, (_, i) => i + 1) as seat}
                        {@const taken = data.players.some((p) => p.table_id === table.id && p.seat_number === seat && p.id !== player.id)}
                        {#if !taken}
                          <option value="{table.id}:{seat}">T{table.number} S{seat}</option>
                        {/if}
                      {/each}
                    {/each}
                  </select>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      {/if}
    </div>
  {/if}
```

- [ ] **Step 4: Run TypeScript check and tests**

```bash
npx tsc --noEmit 2>&1 | grep -v "ui/badge\|ui/button"
npm test 2>&1 | tail -5
```

Expected: no TS errors, all tests passing.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/[club]/admin/tournaments/[id]/+page.svelte"
git commit -m "feat: add seating configuration UI to tournament registration phase"
```

---

## Task 6: Running Phase Seating UI

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte`

This task adds the seating grid and rebalancing/break banners visible while the tournament is **running**.

- [ ] **Step 1: Add the running seating handlers to the script block**

Add these handlers after the `handleManualSeat` function added in Task 5:

```ts
  async function handleUpdateDealer(tableId: string, dealer: string) {
    const supabase = createClient();
    await supabase.from('tournament_tables').update({ dealer: dealer || null }).eq('id', tableId);
    await invalidateAll();
  }

  async function handleConfirmMove(move: { playerId: string; toTableId: string; toSeatNumber: number }) {
    if (loading) return;
    loading = true;
    dismissedSuggestion = false;
    try {
      const supabase = createClient();
      await supabase
        .from('tournament_players')
        .update({ table_id: move.toTableId, seat_number: move.toSeatNumber })
        .eq('id', move.playerId);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
```

- [ ] **Step 2: Add derived rebalancing suggestions to the script block**

Add after the existing `$derived` declarations:

```ts
  const activePlayers = $derived(
    data.players
      .filter((p) => p.finish_position === null && p.table_id !== null)
      .map((p) => ({
        id: p.id,
        name: p.club_members?.display_name ?? p.guest_name ?? '?',
        tableId: p.table_id!,
        tableNumber: data.tables.find((t) => t.id === p.table_id)?.number ?? 0,
        seatNumber: p.seat_number!,
      })),
  );

  const rebalanceMove = $derived(
    !dismissedSuggestion && t.status === 'running' && data.tables.length > 0
      ? suggestTableBreak(activePlayers, data.tables) ??
        suggestRebalanceMove(activePlayers, data.tables)
      : null,
  );
```

Note: `suggestTableBreak` takes priority over `suggestRebalanceMove` (table break is more urgent).

- [ ] **Step 3: Add the running seating section to the template**

Find the section in the template where the running-phase content is. Add this block after the players bust/rebuy/addon controls, before any finish section:

```svelte
  {#if t.status === 'running' && data.tables.length > 0}
    <!-- ── Seating grid ── -->
    <div class="flex flex-col gap-4">
      <h2 class="text-sm font-semibold text-foreground">{m.seating_title()}</h2>

      <!-- Rebalance / break suggestion banner -->
      {#if rebalanceMove}
        {@const isBreak = 'fromTableNumber' in rebalanceMove && !('fromSeatNumber' in rebalanceMove)}
        <div class="flex items-center justify-between gap-3 bg-accent/10 border border-accent/30 rounded-lg px-4 py-3">
          <span class="text-sm text-foreground">
            {#if 'toSeatNumber' in rebalanceMove && 'fromSeatNumber' in rebalanceMove}
              Move <strong>{rebalanceMove.playerName}</strong>
              T{rebalanceMove.fromTableNumber} S{rebalanceMove.fromSeatNumber}
              → T{rebalanceMove.toTableNumber} S{rebalanceMove.toSeatNumber}
            {:else}
              Break Table <strong>{rebalanceMove.fromTableNumber}</strong>
              — move <strong>{rebalanceMove.playerName}</strong>
              to T{rebalanceMove.toTableNumber} S{rebalanceMove.toSeatNumber}
            {/if}
          </span>
          <div class="flex gap-2 shrink-0">
            <button
              type="button"
              onclick={() => handleConfirmMove(rebalanceMove as { playerId: string; toTableId: string; toSeatNumber: number })}
              disabled={loading}
              class="text-xs bg-accent text-accent-foreground px-3 py-1.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {m.seating_confirm_move_button()}
            </button>
            <button
              type="button"
              onclick={() => { dismissedSuggestion = true; }}
              class="text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
            >
              {m.seating_dismiss_button()}
            </button>
          </div>
        </div>
      {/if}

      <!-- Table cards grid -->
      <div class="grid grid-cols-2 gap-3">
        {#each data.tables as table}
          {@const tablePlayers = data.players
            .filter((p) => p.table_id === table.id)
            .sort((a, b) => (a.seat_number ?? 0) - (b.seat_number ?? 0))}
          {@const activeCount = tablePlayers.filter((p) => p.finish_position === null).length}
          <div class="bg-card border border-border rounded-lg p-3 flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {m.seating_table_label({ number: String(table.number) })}
              </span>
              <span class="text-xs text-muted-foreground">{m.seating_active_count({ count: String(activeCount) })}</span>
            </div>
            <!-- Dealer field -->
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-muted-foreground">{m.seating_dealer_label()}:</span>
              <input
                type="text"
                value={table.dealer ?? ''}
                placeholder="—"
                class="flex-1 text-xs bg-background border border-input rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:border-accent"
                onchange={(e) => handleUpdateDealer(table.id, (e.currentTarget as HTMLInputElement).value)}
              />
            </div>
            <!-- Seat grid -->
            <div class="grid grid-cols-2 gap-1 text-xs">
              {#each Array.from({ length: table.max_seats }, (_, i) => i + 1) as seat}
                {@const player = tablePlayers.find((p) => p.seat_number === seat)}
                {@const busted = player && player.finish_position !== null}
                <div class="px-2 py-1 rounded {busted ? 'bg-muted text-muted-foreground line-through opacity-50' : player ? 'bg-accent/20 text-foreground' : 'bg-muted text-muted-foreground'}">
                  {seat} {player ? (player.club_members?.display_name ?? player.guest_name ?? '?') : '—'}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
```

Note on the banner: the template checks `'fromSeatNumber' in rebalanceMove` to distinguish `RebalanceMove` (has `fromSeatNumber`) from `TableBreakMove` (does not). Both types have `playerName`, `fromTableNumber`, `toTableNumber`, `toSeatNumber`.

- [ ] **Step 4: Fix the `dismissedSuggestion` reset**

The `dismissedSuggestion` flag should reset when a new bust happens (i.e. when `data.players` changes). Add this effect after the `$derived` declarations:

```ts
  $effect(() => {
    // Reset dismiss flag when player state changes (new bust = new suggestion opportunity)
    void data.players;
    dismissedSuggestion = false;
  });
```

- [ ] **Step 5: Run TypeScript check and tests**

```bash
npx tsc --noEmit 2>&1 | grep -v "ui/badge\|ui/button"
npm test 2>&1 | tail -5
```

Expected: no TS errors, all tests passing.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/[club]/admin/tournaments/[id]/+page.svelte"
git commit -m "feat: add running phase seating grid, rebalancing and table break suggestions"
```

---

## Final Checklist

- [ ] All 6 tasks committed
- [ ] `npm test` passes (all tests green)
- [ ] `npx tsc --noEmit` clean (ignoring shadcn noise)
- [ ] Migration file `0007_tournament_seating.sql` present
- [ ] Seating section visible in registration phase when tables are configured
- [ ] Seating grid and banners visible in running phase
