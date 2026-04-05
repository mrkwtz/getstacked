# Chips Feature Design

**Date:** 2026-04-05
**Status:** Approved

## Overview

Introduce chip counts to tournaments so that for each payment type (buy-in, rebuy, add-on) a fixed number of chips is awarded. These chip counts enable statistics like the average chip stack during and after a tournament.

## Data Model

Three new integer columns on the `tournaments` table:

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `buy_in_chips` | integer | yes (DB), required (UI) | Chips awarded for a buy-in |
| `rebuy_chips` | integer | yes (DB), required (UI) | Chips awarded for a rebuy; only applies when `format = 'rebuy'` |
| `addon_chips` | integer | yes (DB), required (UI) | Chips awarded for an add-on; only applies when `format = 'rebuy'` |

Nullable in the DB to avoid breaking existing rows. Required via UI validation and server-side checks. The `rebuy_chips` and `addon_chips` fields mirror the existing `rebuy_amount` / `addon_amount` pattern: only relevant and required when `format = 'rebuy'`.

The `Tournament` TypeScript interface in `src/lib/types.ts` gains:

```ts
buy_in_chips: number | null;
rebuy_chips: number | null;
addon_chips: number | null;
```

A Supabase migration adds the three columns.

## Tournament Creation Form

In `src/routes/[club]/admin/tournaments/new/+page.svelte`, chip inputs are added alongside money inputs:

- `Buy-in chips` — always shown, paired with `Buy-in amount`
- `Rebuy chips` — shown only when `format = 'rebuy'`, paired with `Rebuy amount`
- `Add-on chips` — shown only when `format = 'rebuy'`, paired with `Add-on amount`

All chip inputs are whole-number (`step="1"`, `min="1"`). Validation: required, must be > 0. Field error highlighting follows the existing pattern (`ring-2 ring-accent`).

## Business Logic

A new pure function `calculateAverageStack` in `src/lib/tournaments.ts`:

```ts
function calculateAverageStack(
  tournament: Pick<Tournament, 'buy_in_chips' | 'rebuy_chips' | 'addon_chips'>,
  players: { finish_position: number | null; rebuys: number; addon: boolean }[]
): number | null
```

- Returns `null` if `buy_in_chips` is null (no chip config).
- **Total chips in play** = `(all_players × buy_in_chips) + (total_rebuys × rebuy_chips) + (addon_count × addon_chips)`
- **Remaining players** = players where `finish_position IS NULL`
- **Average stack** = `total_chips / remaining_players` (integer, rounded)
- Returns `null` if remaining players = 0.

Unit tests cover: basic calculation, no chips configured, zero remaining players, rebuy/addon contribution.

## UI — Tournament Detail Page

In `src/routes/[club]/admin/tournaments/[id]/+page.svelte`:

- **Running status:** Average stack shown live in the tournament summary area, calculated from current player state.
- **Finished status:** Average stack shown in the final summary. Since only the winner remains (`finish_position IS NULL`), the average stack equals total chips in play.

The value is only rendered when the tournament has chip config (`buy_in_chips != null`).

## Out of Scope

- Chip structures (reusable named configs) — deferred for a future iteration.
- Per-player chip tracking (only aggregate stats for now).
- Editing chip counts after tournament creation (follow the same pattern as money amounts if needed later).
