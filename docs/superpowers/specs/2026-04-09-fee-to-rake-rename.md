# Spec: Fee → Rake Rename + Semantic Change

**Date:** 2026-04-09

## Summary

Rename "fee" to "rake" across the entire codebase (database, types, business logic, UI, i18n), and change the semantic meaning: the rake is now deducted from the buy-in amount rather than added on top of it.

## Current Behaviour

- Player pays `amount + fee` (total = amount + fee)
- `amount` goes directly into the prize pool
- `fee` is an additional charge on top — the house's cut

## New Behaviour

- Player pays `amount` (the amount field is the total the player hands over)
- `amount - rake` goes into the prize pool
- `rake` is deducted from the amount — the house's cut

**Example:** €20 buy-in with €2 rake → €18 goes to the prize pool.

## Database

New migration: rename three columns on the `tournaments` table.

| Old name       | New name       |
|----------------|----------------|
| `buy_in_fee`   | `buy_in_rake`  |
| `rebuy_fee`    | `rebuy_rake`   |
| `addon_fee`    | `addon_rake`   |

All existing constraints (CHECK >= 0) are preserved; Postgres renames them automatically.

## TypeScript Types (`src/lib/types.ts`)

Update all three type shapes (Row, Insert, Update) to replace `buy_in_fee`, `rebuy_fee`, `addon_fee` with `buy_in_rake`, `rebuy_rake`, `addon_rake`.

## Business Logic (`src/lib/tournaments.ts`)

### `calculatePrizePool`

Old signature:
```ts
calculatePrizePool(playerCount, buyIn, totalRebuys, rebuyAmount, addonCount, addonAmount)
```
`buyIn` was already the net prize pool contribution (fee excluded).

New signature:
```ts
calculatePrizePool(playerCount, buyInAmount, buyInRake, totalRebuys, rebuyAmount, rebuyRake, addonCount, addonAmount, addonRake)
```
Internally computes:
```ts
playerCount * (buyInAmount - buyInRake)
+ totalRebuys * (rebuyAmount - rebuyRake)
+ addonCount  * (addonAmount  - addonRake)
```

### `calculateTotalFees` → `calculateTotalRake`

Renamed to `calculateTotalRake`. Signature otherwise identical (counts × rake amounts).

### `formatPrizePoolBreakdown`

No signature change needed. Callers pass the net amounts (amount - rake) directly, consistent with the current pattern.

## Validation

Add a check in the tournament creation form: rake must be strictly less than the amount for each entry type where both are set. This prevents a zero or negative prize pool contribution per entry.

## i18n (`messages/en.json` + `messages/de.json`)

| Old key                        | New key                         | EN value         | DE value         |
|--------------------------------|---------------------------------|------------------|------------------|
| `tournament_buy_in_fee_label`  | `tournament_buy_in_rake_label`  | "Buy-in rake"    | "Buy-in Rake"    |
| `tournament_rebuy_fee_label`   | `tournament_rebuy_rake_label`   | "Rebuy rake"     | "Rebuy Rake"     |
| `tournament_addon_fee_label`   | `tournament_addon_rake_label`   | "Add-on rake"    | "Add-on Rake"    |
| `tournament_fees_label`        | `tournament_rake_label`         | "Rake"           | "Rake"           |

After editing message files, run `npm run build` to regenerate Paraglide output.

## Tournament Creation Form (`new/+page.svelte`)

- Form field `name` attributes: `buy_in_fee` → `buy_in_rake`, `rebuy_fee` → `rebuy_rake`, `addon_fee` → `addon_rake`
- Label i18n calls updated to new keys
- Validation: add rake < amount check per entry type
- Pass rake values to updated `calculatePrizePool` on submission

## Tests (`tests/unit/tournaments.test.ts`)

- Update import: `calculateTotalFees` → `calculateTotalRake`
- Update `calculatePrizePool` call sites to pass rake arguments (default 0 for existing tests)
- Rename `calculateTotalFees` describe block to `calculateTotalRake`
- Add new `calculatePrizePool` tests that verify rake deduction (e.g. 4 players × (€20 - €2) = €72 prize pool)

## Out of Scope

- Tournament detail page (`[id]/+page.svelte`) does not currently display fee/rake — no changes needed there unless it references these fields.
- Clock page (`clock/+page.ts`) — check for any references; update if found.
