# Tournament Lifecycle Design

## Goal

Enable admins to run a tournament end-to-end: start it, track busts/rebuys/add-ons live per player, review results, and finish with saved finish positions and payout amounts.

## Scope

- Status transitions: registration → running → finished (no backwards)
- Live tracking during running: bust order, rebuys per player, add-on per player
- Finish review: confirm all positions, calculate and save payouts
- All UI on the existing tournament detail page (`/[club]/admin/tournaments/[id]`)
- Table/seat assignment is explicitly out of scope (separate feature)

---

## Data Model

### Migration `0005_tournament_results.sql`

```sql
alter table tournament_players
  add column payout_amount integer; -- cents, null until tournament finished
```

All other needed columns (`finish_position`, `rebuys`, `addon`) already exist in `tournament_players`.

---

## Business Logic (`src/lib/tournaments.ts`)

### `calculatePrizePool` (existing — fix call site)

The detail page currently passes zeros for rebuys/add-ons. The call site is updated to sum actual player rebuys and add-ons.

### `calculatePayouts` (new)

```typescript
export function calculatePayouts(
  players: { id: string; finish_position: number | null }[],
  payouts: Payout[],        // from prize structure
  prizePool: number,        // cents
): { playerId: string; amount: number }[]
```

- `percentage` is a whole number (e.g. 60 = 60%). Reuses the existing `Payout` type from `src/lib/tournaments.ts`.
- Iterates prize structure payouts sorted by position
- For each paid position: `amount = Math.floor(prizePool * percentage / 100)`
- Any remainder from rounding is added to the player with `finish_position === 1` (1st place)
- Players not in a paid position receive amount 0
- If fewer players exist than paid positions in the prize structure, unpaid positions are simply skipped — no redistribution (the percentage is effectively not awarded)
- Returns an entry for every player (paid and unpaid)

### Tests (TDD)

New tests in `tests/unit/tournaments.test.ts`:

- `calculatePayouts` with clean percentages (no remainder)
- `calculatePayouts` with rounding remainder → goes to 1st place
- `calculatePayouts` with fewer players than paid positions → only existing positions paid
- `calculatePrizePool` with rebuys and add-ons (an existing test already covers this — verify it passes, no new test needed)

---

## Server Actions (`src/routes/[club]/admin/tournaments/[id]/+page.server.ts`)

All actions verify `isAdmin` via `getClubAndMember`.

| Action | Transition / Effect | Validation |
|---|---|---|
| `start_tournament` | status: registration → running | ≥ 2 players registered |
| `bust_player` | sets `finish_position` on one player | tournament running; player has no position; player belongs to this tournament. **Position formula:** next = `MAX` of all positions in `{1..total_players}` not currently assigned (where `total_players` = `COUNT(*) FROM tournament_players WHERE tournament_id = ?`). This naturally fills any gaps left by `unset_bust` operations. Counts down: last bust = position 1. |
| `unset_bust` | clears `finish_position` on one player | tournament running; player belongs to this tournament. Subsequent busts use the corrected formula above and will fill the gap automatically. |
| `add_rebuy` | increments `rebuys` by 1 | tournament running; player belongs to this tournament; tournament format is `rebuy` |
| `remove_rebuy` | decrements `rebuys` by 1 | tournament running; player belongs to this tournament; rebuys > 0; tournament format is `rebuy` |
| `toggle_addon` | flips `addon` boolean | tournament running; player belongs to this tournament; tournament format is `rebuy` |
| `finish_tournament` | status: running → finished; writes `payout_amount` to all players | all players have `finish_position`; tournament has a prize structure assigned |

`finish_tournament` in detail:
1. Fetch all players for tournament
2. Verify every player has a `finish_position`
3. Fetch the tournament's prize structure (fail with `fail(400, { errorKey: 'error_no_prize_structures' })` if none assigned)
4. Calculate actual prize pool (using all rebuys and add-ons)
5. Fetch prize structure payouts
6. Call `calculatePayouts`
7. Write `payout_amount` to each player row (service client)
8. Set tournament status to `finished`

---

## UI (`src/routes/[club]/admin/tournaments/[id]/+page.svelte`)

### Header area

- **Registration**: "Start Tournament" button (disabled if < 2 players, with tooltip)
- **Running**: "Finish Tournament" button (disabled until all positions assigned)
- **Finished**: read-only, no action buttons

### Player table — columns by status

| Status | Columns |
|---|---|
| Registration | Player · Type · Remove |
| Running | Player · Rebuys · Add-on · Position · Bust/Undo |
| Finished | Position · Player · Payout |

**Running row details:**
- **Rebuys**: `−` · count · `+` buttons (− disabled at 0). Hidden entirely for `freezeout` format tournaments.
- **Add-on**: checkbox toggle. Hidden entirely for `freezeout` format tournaments.
- **Position**: shows "3rd" (with ordinal suffix) once busted, "—" if still in
- **Bust button**: labelled with next position (e.g. "→ 8th"); hidden once busted. The last remaining player is busted manually — their bust assigns them position 1.
- **Undo link**: shown instead of bust button once busted; clears position

### Prize pool callout

Updates after each rebuy/add-on action round-trip (no optimistic UI needed — the page re-renders with fresh server data after each form submission).

### Finish review section

Appears inline below the player table when "Finish Tournament" is clicked (a `showReview` boolean state). Shows:

- Table: Position · Player · Payout (€)
- Payouts calculated client-side for the preview using `prizeStructure.payouts` (array of `{ position, percentage }`) passed from the load function, plus `prizePool` derived from actual rebuys/add-ons
- "Confirm & close tournament" button (submits `finish_tournament` action)
- "Cancel" (`tournament_cancel_review`) link to dismiss the review section

The load function must return `prizeStructure: { payouts: { position: number; percentage: number }[] } | null` alongside the tournament data so the client-side preview can call `calculatePayouts`. When no prize structure is assigned, `prizeStructure` is null and the preview section simply cannot be shown (the "Finish Tournament" button is also disabled in this case).

The load function must fetch the full prize structure row including `payouts` JSONB — not just the name. The current join `prize_structures(name)` must be extended to `prize_structures(payouts)`.

---

## i18n Keys

New keys added to `messages/en.json` and `messages/de.json`:

```
tournament_start_button         "Start tournament"
tournament_finish_button        "Finish tournament"
tournament_confirm_finish       "Confirm & close tournament"
tournament_cancel_review        "Cancel"
tournament_review_title         "Review results"
tournament_position_col         "Position"
tournament_payout_col           "Payout"
tournament_bust_button          "→ {position}"
tournament_undo_bust            "Undo"
tournament_rebuy_col            "Rebuys"
tournament_addon_col            "Add-on"
tournament_min_players_error    "At least 2 players required to start."
tournament_positions_incomplete "Assign all finish positions before finishing."
error_tournament_not_running    "This action requires the tournament to be running."
```

Notes:
- `error_tournament_not_open` already exists (message: "Tournament registration is closed.") — covers adding players after registration closes.
- `error_no_prize_structures` already exists — reused for `finish_tournament` with no prize structure assigned.
- `error_tournament_not_running` is new — for bust/rebuy/add-on actions on a non-running tournament.
- The disabled "Start Tournament" tooltip reuses `tournament_min_players_error`.
- The disabled "Finish Tournament" tooltip (when no prize structure) reuses `error_no_prize_structures`.

---

## Error Handling

- Start with < 2 players: `fail(400, { errorKey: 'tournament_min_players_error' })`
- Finish with incomplete positions: `fail(400, { errorKey: 'tournament_positions_incomplete' })`
- Finish with no prize structure: `fail(400, { errorKey: 'error_no_prize_structures' })`
- All other DB errors: `fail(500, { errorKey: 'server_error' })`
- Wrong status for an action requiring `running` (e.g. bust, rebuy, add-on on a finished tournament): `fail(400, { errorKey: 'error_tournament_not_running' })`
- Wrong status for adding players (not registration): `fail(400, { errorKey: 'error_tournament_not_open' })` (key already exists)

---

## Out of Scope

- Table/seat assignment
- Live blind level timer
- Backwards status transitions
- Editing results after `finished`
