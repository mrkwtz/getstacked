# Tournament Fee Split Design

**Date:** 2026-04-03

## Problem

Admins need to split tournament entry amounts (buy-in, rebuy, addon) into two parts: one that goes into the prize pool and one that is a fee for the tournament host. Currently, the full amount goes into the prize pool. Payouts must only be calculated from the prize pool portion.

## Design

### Database Changes

**Rename column:**
- `buy_in` → `buy_in_amount` (align naming with `rebuy_amount`, `addon_amount`)
- Migration: `ALTER TABLE tournaments RENAME COLUMN buy_in TO buy_in_amount` (metadata-only, no data loss)

**New nullable columns** (stored in cents, default `null`):
- `buy_in_fee`
- `rebuy_fee`
- `addon_fee`

The existing `buy_in_amount`, `rebuy_amount`, `addon_amount` columns represent the **prize pool portion only**. The total a player pays for any entry type = pool amount + fee.

After migration, regenerate TypeScript types with Supabase CLI and update the `Tournament` convenience type.

### Business Logic (`src/lib/tournaments.ts`)

**Unchanged functions:**
- `calculatePrizePool` — already receives pool-only amounts, no changes needed
- `formatPrizePoolBreakdown` — returns per-type pool breakdown, unchanged
- `calculatePayouts` — receives prize pool total (already fee-free), unchanged
- `validatePayouts` — unrelated to fees, unchanged

**New function:**
```typescript
export function calculateTotalFees(
  playerCount: number,
  buyInFee: number,
  totalRebuys: number,
  rebuyFee: number,
  addonCount: number,
  addonFee: number
): number {
  return playerCount * buyInFee + totalRebuys * rebuyFee + addonCount * addonFee;
}
```

### Tournament Creation Form (`tournaments/new/+page.svelte`)

Each amount field gets a companion fee field beside it:
- **Buy-in amount** (required) + **Buy-in fee** (optional, default blank/0)
- **Rebuy amount** (required when format=rebuy) + **Rebuy fee** (optional)
- **Addon amount** (required when format=rebuy) + **Addon fee** (optional)

Fee fields accept `min="0" step="0.01"`. Blank or 0 means no fee. Stored in cents like other monetary values.

The rebuy/addon fee fields live inside the existing red-bordered format options section.

### Tournament Detail Page (`tournaments/[id]/+page.svelte`)

**Prize pool breakdown** currently shows lines like:
```
4 x €20.00 (Buy-in) = €80.00
2 x €20.00 (Rebuy) = €40.00
Prize pool: €120.00
```

Updated to add a fees summary line at the bottom:
```
4 x €20.00 (Buy-in) = €80.00
2 x €20.00 (Rebuy) = €40.00
Fees: €30.00
Prize pool: €120.00
```

The "Fees" line shows the aggregated total from `calculateTotalFees`. It only appears when total fees > 0. The prize pool total remains the sum of pool amounts only — payouts are unaffected.

### Data Flow

The page loader (`tournaments/[id]/+page.ts`) already calls `calculatePrizePool` with the pool-only amounts. It will additionally call `calculateTotalFees` to pass the fees total to the page for display.

### Codebase Rename: `buy_in` → `buy_in_amount`

All references to the old column name must be updated across:
- `src/lib/types.ts` (after regeneration)
- `src/lib/tournaments.ts` (function parameters — currently named `buyIn`, can stay as-is since they're not column references)
- `src/routes/[club]/admin/tournaments/new/+page.svelte` (form field name, insert payload)
- `src/routes/[club]/admin/tournaments/[id]/+page.ts` (load function)
- `src/routes/[club]/admin/tournaments/[id]/+page.svelte` (template references to `t.buy_in`)
- `tests/unit/tournaments.test.ts` (no changes needed — tests use function params, not column names)

### i18n

New message keys (EN / DE):
- `tournament_buy_in_fee_label`: "Buy-in fee" / "Buy-in-Gebühr"
- `tournament_rebuy_fee_label`: "Rebuy fee" / "Rebuy-Gebühr"
- `tournament_addon_fee_label`: "Add-on fee" / "Add-on-Gebühr"
- `tournament_fees_label`: "Fees" / "Gebühren"
