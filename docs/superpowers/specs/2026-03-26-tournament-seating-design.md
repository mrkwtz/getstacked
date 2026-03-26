# Tournament Seating Design

## Goal

Allow admins to assign players to numbered tables and seats during a tournament — with a random seat draw (respecting optional table locks), manual overrides, and system-suggested rebalancing moves as players bust out.

## Scope

- Table configuration during registration (number of tables, seats per table)
- Per-player table lock before the draw
- Seat draw: random assignment respecting locks
- Auto-Seat: fill unseated players evenly across tables
- Manual seat assignment for individual players
- Running phase: grid display with busted players struck through
- Rebalancing suggestions when tables become uneven
- Table break suggestion when a table reaches 1 active player
- Table metadata: dealer name (editable at any time)

Out of scope: Break status re-seating (deferred), player-visible seating view (admin-only for now).

---

## Data Model

### New table: `tournament_tables`

```sql
create table tournament_tables (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  number        integer not null,              -- 1-based display number
  max_seats     integer not null,
  dealer        text,                          -- optional metadata
  created_at    timestamptz not null default now(),
  unique (tournament_id, number)
);
```

RLS: members can read, admins can manage (same pattern as other tournament tables).

### Modified: `tournament_players`

```sql
alter table tournament_players
  add column table_id       uuid references tournament_tables(id) on delete set null,
  add column seat_number    integer,
  add column preferred_table integer;   -- table number (not id) locked during registration
```

`table_id` and `seat_number` are null until a seat draw or manual assignment. `preferred_table` is null unless the admin locks a player to a specific table.

---

## Seating Flow

### Registration phase

A **Seating** section appears on the tournament detail page below the player list.

1. Admin enters number of tables and seats per table, clicks **Set tables**. This creates `tournament_tables` rows immediately (so lock dropdowns can reference table numbers).
2. Each registered player has a **Lock to table** dropdown: `Any` (default) or a specific table number.
3. A **Draw seats** button is available once tables are configured and ≥ 2 players are registered.
4. After the draw, the seating grid appears. Any players added after the draw appear in an **Unseated** list below the grid.
5. Unseated players can be assigned via:
   - **Auto-Seat** button: distributes all unseated players evenly across tables (fills the table with fewest active players first), then fills remaining empty seats randomly.
   - **Manual**: per-player table + seat number selectors.
6. Admin can **re-draw** at any point during registration, resetting all seat assignments. Re-draw is disabled once the tournament is running.

### Seat draw algorithm (`drawSeats`)

Input: list of players with optional `preferred_table`, list of tables with `max_seats`.

1. Validate: for each table, count players locked to it. If count > `max_seats`, return an error: "Table N has X locks but only Y seats."
2. For each table, shuffle its locked players and assign them seats 1..N.
3. Collect remaining (unlocked) players and shuffle them.
4. Fill remaining empty seats across tables in round-robin order (smallest table first) until all players are seated.

### Running phase

The seating section becomes the **Seating** tab / section on the tournament detail page.

- Tables are displayed as a grid of cards (2-column on desktop, 1-column on mobile).
- Each card shows: table number, active player count, dealer name (editable inline), and a seat grid.
- Seats show: seat number + player name. Busted players are greyed out with a strikethrough.
- Empty seats show `—`.

### Rebalancing

Triggered automatically after any bust:

- Compute active player count per table (excluding busted).
- If `max(active) - min(active) >= 2`: show a suggestion banner: **"Move [player] from Table X seat Y → Table Z seat W"**. The suggested player is the most recently seated active player on the largest table. The target seat is the lowest empty seat on the smallest table.
- If any table has exactly 1 active player: show a **Break table** banner instead: **"Break Table X — move [player] to Table Y seat Z"**.
- Admin can **Confirm** (updates `table_id` and `seat_number`) or **Dismiss** (hides banner until next bust).
- At most one suggestion is shown at a time. After a confirm or next bust, suggestions are re-evaluated.

---

## Files Affected

| File | Change |
|------|--------|
| `supabase/migrations/0007_tournament_seating.sql` | Create `tournament_tables`, alter `tournament_players` |
| `src/lib/seating.ts` | `drawSeats()`, `autoSeat()`, `suggestRebalanceMove()`, `suggestTableBreak()` |
| `tests/unit/seating.test.ts` | TDD tests for all seating utility functions |
| `src/lib/types.ts` | Add `tournament_tables` Database type |
| `src/routes/[club]/admin/tournaments/[id]/+page.ts` | Load tables + seating data |
| `src/routes/[club]/admin/tournaments/[id]/+page.svelte` | Add Seating section (registration + running views) |

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Lock count exceeds table seats | Draw fails with inline error message listing affected tables |
| Draw with 0 tables configured | Draw button disabled; prompt to configure tables first |
| Manual seat already occupied | Error: "Seat N at Table X is taken" |
| Supabase write failure | Inline error, no state change |

---

## Testing

All seating logic is pure functions in `src/lib/seating.ts`, tested with Vitest:

- `drawSeats`: locked players go to correct tables, all players seated, overflow lock returns error
- `autoSeat`: fills tables from smallest first, result is evenly distributed
- `suggestRebalanceMove`: returns correct player and target when imbalance ≥ 2, returns null when balanced
- `suggestTableBreak`: triggers when exactly 1 active player remains on a table

UI interactions (set tables, draw, confirm move) are handled via client-side Supabase mutations following the existing pattern in the tournament detail page.
